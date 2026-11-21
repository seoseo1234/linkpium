import { requireInstructor } from "@/lib/server/auth";
import { handle, ok } from "@/lib/server/http";
import { regenerateCode } from "@/lib/server/sessions";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** POST — 새 6자리 코드 발급, 이전 코드는 즉시 무효 */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const me = await requireInstructor(req);
  const { id } = await params;
  return ok({ joinCode: await regenerateCode(id, me.uid) });
});
