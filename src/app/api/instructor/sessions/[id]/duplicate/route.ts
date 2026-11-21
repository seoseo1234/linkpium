import { requireInstructor } from "@/lib/server/auth";
import { handle, ok } from "@/lib/server/http";
import { duplicateSession, getOwnedSession, serializeSession } from "@/lib/server/sessions";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** POST — 새 ID/링크/코드로 복제, 게시물은 비공개 초안 */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const me = await requireInstructor(req);
  const { id } = await params;
  const created = await duplicateSession(id, me);
  return ok({ session: serializeSession(created.id, await getOwnedSession(created.id, me.uid)) }, 201);
});
