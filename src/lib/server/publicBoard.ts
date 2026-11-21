import "server-only";
import { HttpError } from "./http";
import { refs, serializePost, type PostDoc } from "./sessions";
import { isBoardReadable, sortPosts, type SessionStatus } from "@/lib/shared";

type BoardDoc = {
  title: string;
  description: string;
  driveUrl: string | null;
  status: SessionStatus;
  readableAfterEnd: boolean;
};

const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

export async function getReadableBoard(token: string): Promise<BoardDoc> {
  if (!TOKEN_RE.test(token)) throw new HttpError(404, "강의를 찾을 수 없습니다.", { reason: "not_found" });
  const b = (await refs().board(token).get()).data() as BoardDoc | undefined;
  if (!b) throw new HttpError(404, "강의를 찾을 수 없습니다.", { reason: "not_found" });
  if (!isBoardReadable(b.status, b.readableAfterEnd)) {
    throw new HttpError(403, "종료되어 접근이 차단된 강의입니다.", { reason: "closed" });
  }
  return b;
}

export async function getPublicPosts(token: string) {
  const snap = await refs().posts(token).where("published", "==", true).get();
  const posts = snap.docs.map((d) => serializePost(d.id, d.data() as PostDoc));
  return sortPosts(posts.map((p) => ({ ...p, createdAtMs: p.createdAt ?? 0 }))).map(({ createdAtMs: _, ...p }) => p);
}
