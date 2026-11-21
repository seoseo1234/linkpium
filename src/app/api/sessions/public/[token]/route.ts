import { handle, ok } from "@/lib/server/http";
import { getReadableBoard } from "@/lib/server/publicBoard";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ token: string }> };

/** GET /api/sessions/public/:token — 공개 강의 정보 */
export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { token } = await params;
  const b = await getReadableBoard(token);
  return ok({ title: b.title, description: b.description, driveUrl: b.driveUrl, status: b.status });
});
