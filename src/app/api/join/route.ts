import { HttpError, handle, ok, readJson } from "@/lib/server/http";
import { assertNotLimited, clientKey, recordFailure } from "@/lib/server/rateLimit";
import { refs } from "@/lib/server/sessions";
import { isBoardReadable, normalizeJoinCode, type SessionStatus } from "@/lib/shared";

export const runtime = "nodejs";

/** POST /api/join {code} → { publicToken } */
export const POST = handle(async (req: Request) => {
  const key = clientKey(req);
  await assertNotLimited(key);

  const body = (await readJson(req)) as { code?: unknown };
  const code = normalizeJoinCode(String(body?.code ?? ""));
  if (!code) throw new HttpError(400, "숫자 6자리를 입력하세요.", { reason: "invalid_format" });

  const r = refs();
  const mapping = (await r.joinCode(code).get()).data() as { publicToken: string } | undefined;
  if (!mapping) {
    await recordFailure(key);
    throw new HttpError(404, "존재하지 않는 강의 코드입니다. 숫자를 다시 확인하세요.", { reason: "not_found" });
  }

  const board = (await r.board(mapping.publicToken).get()).data() as
    | { status: SessionStatus; readableAfterEnd: boolean }
    | undefined;
  if (!board) {
    await recordFailure(key);
    throw new HttpError(404, "존재하지 않는 강의 코드입니다. 숫자를 다시 확인하세요.", { reason: "not_found" });
  }
  if (!isBoardReadable(board.status, board.readableAfterEnd)) {
    throw new HttpError(403, "종료되어 접근이 차단된 강의입니다. 강사님께 문의하세요.", { reason: "closed" });
  }
  return ok({ publicToken: mapping.publicToken, url: `/s/${mapping.publicToken}` });
});
