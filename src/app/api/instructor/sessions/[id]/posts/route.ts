import { FieldValue } from "firebase-admin/firestore";
import { requireInstructor } from "@/lib/server/auth";
import { HttpError, handle, ok, readJson } from "@/lib/server/http";
import { getOwnedSession, refs, serializePost, type PostDoc } from "@/lib/server/sessions";
import { canPost, validatePostInput } from "@/lib/shared";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (req: Request, { params }: Ctx) => {
  const me = await requireInstructor(req);
  const { id } = await params;
  const s = await getOwnedSession(id, me.uid);
  const snap = await refs().posts(s.publicToken).orderBy("createdAt", "desc").get();
  return ok({ posts: snap.docs.map((d) => serializePost(d.id, d.data() as PostDoc)) });
});

/** POST {type, title, content} — 즉시 공개 */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const me = await requireInstructor(req);
  const { id } = await params;
  const s = await getOwnedSession(id, me.uid);
  if (!canPost(s.status)) throw new HttpError(409, "종료된 강의에는 새 자료를 올릴 수 없습니다. 먼저 강의를 다시 여세요.");
  const v = validatePostInput(await readJson(req));
  if (!v.ok) throw new HttpError(400, v.error);
  const ref = refs().posts(s.publicToken).doc();
  await ref.create({
    ...v.value,
    isPinned: false,
    published: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  const doc = (await ref.get()).data() as PostDoc;
  return ok({ post: serializePost(ref.id, doc) }, 201);
});
