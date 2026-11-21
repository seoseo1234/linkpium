import "server-only";
import { NextResponse } from "next/server";

export class HttpError extends Error {
  constructor(public status: number, message: string, public extra?: Record<string, unknown>) {
    super(message);
  }
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

/** 라우트 핸들러 래퍼: HttpError → JSON 오류, 그 밖의 예외 → 500 */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError) {
        return NextResponse.json({ error: e.message, ...e.extra }, { status: e.status, headers: { "Cache-Control": "no-store" } });
      }
      console.error(e);
      return NextResponse.json({ error: "서버 오류가 발생했습니다. 잠시 후 다시 시도하세요." }, { status: 500 });
    }
  };
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "요청 본문이 올바른 JSON 이 아닙니다.");
  }
}
