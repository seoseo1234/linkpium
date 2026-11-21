import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeJoinCode,
  formatJoinCode,
  isSafeHttpUrl,
  isBoardReadable,
  validatePostInput,
  validateSessionPatch,
  sortPosts,
  displayTitle,
} from "../src/lib/shared.ts";

test("normalizeJoinCode ignores spaces and hyphens", () => {
  assert.equal(normalizeJoinCode("482716"), "482716");
  assert.equal(normalizeJoinCode(" 482 716 "), "482716");
  assert.equal(normalizeJoinCode("482-716"), "482716");
  assert.equal(normalizeJoinCode("48271"), null);
  assert.equal(normalizeJoinCode("4827166"), null);
  assert.equal(normalizeJoinCode("48a716"), null);
  assert.equal(normalizeJoinCode(""), null);
});

test("formatJoinCode", () => {
  assert.equal(formatJoinCode("482716"), "482 716");
});

test("isSafeHttpUrl blocks dangerous schemes", () => {
  assert.ok(isSafeHttpUrl("https://example.com"));
  assert.ok(isSafeHttpUrl("http://example.com/a?b=c"));
  assert.ok(!isSafeHttpUrl("javascript:alert(1)"));
  assert.ok(!isSafeHttpUrl("data:text/html,hi"));
  assert.ok(!isSafeHttpUrl("ftp://example.com"));
  assert.ok(!isSafeHttpUrl("example.com"));
  assert.ok(!isSafeHttpUrl(""));
});

test("isBoardReadable", () => {
  assert.ok(isBoardReadable("live", true));
  assert.ok(isBoardReadable("draft", false));
  assert.ok(isBoardReadable("ended", true));
  assert.ok(!isBoardReadable("ended", false));
  assert.ok(!isBoardReadable("closed", true));
});

test("validatePostInput", () => {
  assert.equal(validatePostInput({ type: "link", title: "", content: "javascript:x" }).ok, false);
  assert.equal(validatePostInput({ type: "link", title: "a", content: " https://a.com " }).ok, true);
  assert.equal(validatePostInput({ type: "prompt", title: "", content: "   " }).ok, false);
  const p = validatePostInput({ type: "prompt", title: "t", content: "line1\n  line2\n" });
  assert.ok(p.ok && p.value.content === "line1\n  line2\n", "prompt content keeps whitespace");
  assert.equal(validatePostInput({ type: "notice", title: "", content: "" }).ok, false);
  assert.equal(validatePostInput({ type: "bogus", title: "a", content: "b" }).ok, false);
});

test("validateSessionPatch", () => {
  assert.equal(validateSessionPatch({}, { requireTitle: true }).ok, false);
  assert.equal(validateSessionPatch({ driveUrl: "javascript:1" }).ok, false);
  const r = validateSessionPatch({ driveUrl: "" });
  assert.ok(r.ok && r.value.driveUrl === null);
  assert.equal(validateSessionPatch({ status: "nope" }).ok, false);
});

test("sortPosts pins first then newest", () => {
  const out = sortPosts([
    { id: "a", isPinned: false, createdAtMs: 1 },
    { id: "b", isPinned: true, createdAtMs: 0 },
    { id: "c", isPinned: false, createdAtMs: 5 },
  ]);
  assert.deepEqual(out.map((p) => p.id), ["b", "c", "a"]);
});

test("displayTitle fallbacks", () => {
  assert.equal(displayTitle({ type: "link", title: "", content: "https://x.com/a" }), "x.com");
  assert.equal(displayTitle({ type: "prompt", title: "", content: "\nhello\nworld" }), "hello");
});
