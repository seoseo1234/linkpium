import { requireInstructor } from "@/lib/server/auth";
import { HttpError, handle, ok, readJson } from "@/lib/server/http";
import { deleteSession, getOwnedSession, serializeSession, updateSession } from "@/lib/server/sessions";
import { validateSessionPatch } from "@/lib/shared";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (req: Request, { params }: Ctx) => {
  const me = await requireInstructor(req);
  const { id } = await params;
  return ok({ session: serializeSession(id, await getOwnedSession(id, me.uid)) });
});

/** PATCH {title?, description?, driveUrl?, status?, readableAfterEnd?} */
export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const me = await requireInstructor(req);
  const { id } = await params;
  const v = validateSessionPatch(await readJson(req));
  if (!v.ok) throw new HttpError(400, v.error);
  await updateSession(id, me.uid, v.value);
  return ok({ session: serializeSession(id, await getOwnedSession(id, me.uid)) });
});

export const DELETE = handle(async (req: Request, { params }: Ctx) => {
  const me = await requireInstructor(req);
  const { id } = await params;
  await deleteSession(id, me.uid);
  return ok({ ok: true });
});
