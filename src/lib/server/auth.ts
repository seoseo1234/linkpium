import "server-only";
import { adminAuth } from "./admin";
import { HttpError } from "./http";

export type Instructor = { uid: string; email: string | null; name: string | null };

/** Authorization: Bearer <Firebase ID token> 검증 */
export async function requireInstructor(req: Request): Promise<Instructor> {
  const header = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(header);
  if (!m) throw new HttpError(401, "로그인이 필요합니다.");
  try {
    const decoded = await adminAuth().verifyIdToken(m[1]!);
    return { uid: decoded.uid, email: decoded.email ?? null, name: (decoded.name as string | undefined) ?? null };
  } catch {
    throw new HttpError(401, "로그인이 만료되었습니다. 다시 로그인하세요.");
  }
}
