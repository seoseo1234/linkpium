import { FieldValue } from "firebase-admin/firestore";
import { requireInstructor } from "@/lib/server/auth";
import { HttpError, handle, ok, readJson } from "@/lib/server/http";
import { getOwnedSession, refs, serializePost, type PostDoc } from "@/lib/server/sessions";
import { validatePostInput } from "@/lib/shared";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; postId: string }> };

async function load(req: Request, params: Ctx["params"]) {
  const me = await requireInstructor(req);
  const { id, postId } = await params;
  const s = await getOwnedSession(id, me.uid);
  const ref = refs().posts(s.publicToken).doc(postId);
  const cur = (await ref.get()).data() as PostDoc | undefined;
  if (!cur) throw new HttpError(404, "게시물을 찾을 수 없습니다.");
  return { ref, cur };
}

/** PATCH {title?, content?, isPinned?, published?} — 수정/고정/공개 */
export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const { ref, cur } = await load(req, params);
  const body = ((await readJson(req)) ?? {}) as Record<string, unknown>;
  const update: Record<string, unknown> = {};

  if ("title" in body || "content" in body) {
    const v = validatePostInput({
      type: cur.type,
      title: "title" in body ? body.title : cur.title,
      content: "content" in body ? body.content : cur.content,
    });
    if (!v.ok) throw new HttpError(400, v.error);
    update.title = v.value.title;
    update.content = v.value.content;
  }
  if ("isPinned" in body) {
    if (typeof body.isPinned !== "boolean") throw new HttpError(400, "고정 값이 올바르지 않습니다.");
    update.isPinned = body.isPinned;
  }
  if ("published" in body) {
    if (typeof body.published !== "boolean") throw new HttpError(400, "공개 값이 올바르지 않습니다.");
    update.published = body.published;
    // 초안을 처음 공개할 때는 "새 자료"로 보이도록 게시 시각을 갱신
    if (body.published && !cur.published) update.createdAt = FieldValue.serverTimestamp();
  }
  if (!Object.keys(update).length) throw new HttpError(400, "변경할 내용이 없습니다.");
  update.updatedAt = FieldValue.serverTimestamp();
  await ref.update(update);
  return ok({ post: serializePost(ref.id, (await ref.get()).data() as PostDoc) });
});

export const DELETE = handle(async (req: Request, { params }: Ctx) => {
  const { ref } = await load(req, params);
  await ref.delete();
  return ok({ ok: true });
});
