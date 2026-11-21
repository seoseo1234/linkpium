import { requireInstructor } from "@/lib/server/auth";
import { HttpError, handle, ok, readJson } from "@/lib/server/http";
import { createSession, refs, serializeSession, type SessionDoc } from "@/lib/server/sessions";
import { adminDb } from "@/lib/server/admin";
import { validateSessionPatch } from "@/lib/shared";

export const runtime = "nodejs";

/** GET /api/instructor/sessions — 내 강의 목록 */
export const GET = handle(async (req: Request) => {
  const me = await requireInstructor(req);
  const snap = await adminDb().collection("sessions").where("ownerId", "==", me.uid).get();
  const sessions = snap.docs
    .map((d) => serializeSession(d.id, d.data() as SessionDoc))
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  return ok({ sessions });
});

/** POST /api/instructor/sessions {title, description?, driveUrl?} */
export const POST = handle(async (req: Request) => {
  const me = await requireInstructor(req);
  const v = validateSessionPatch(await readJson(req), { requireTitle: true });
  if (!v.ok) throw new HttpError(400, v.error);
  const created = await createSession(me, {
    title: v.value.title!,
    description: v.value.description,
    driveUrl: v.value.driveUrl,
  });
  const doc = (await refs().session(created.id).get()).data() as SessionDoc;
  return ok({ session: serializeSession(created.id, doc) }, 201);
});
