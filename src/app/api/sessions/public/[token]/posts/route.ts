import { handle, ok } from "@/lib/server/http";
import { getPublicPosts, getReadableBoard } from "@/lib/server/publicBoard";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ token: string }> };

/** GET /api/sessions/public/:token/posts — 공개 게시물 (고정 → 최신순) */
export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { token } = await params;
  await getReadableBoard(token);
  return ok({ posts: await getPublicPosts(token) });
});
