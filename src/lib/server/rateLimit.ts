import "server-only";
import { createHash } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "./admin";
import { HttpError } from "./http";

/*
 * 코드 추측 방지. 한 학교 연수실 전체가 같은 공인 IP 를 쓸 수 있으므로
 * 성공 입장은 세지 않고 "실패"만 센다. 10분에 실패 30회를 넘기면 잠시 차단.
 * IP 는 솔트 해시로만 저장하고, expireAt 필드에 Firestore TTL 정책을 걸어 자동 삭제한다.
 */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILURES = 30;

type LimitDoc = { failures: number; windowStart: Timestamp };

export function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = fwd || req.headers.get("x-real-ip") || "unknown";
  const salt = process.env.RATE_LIMIT_SALT ?? "linkpeum";
  return createHash("sha256").update(salt + ip).digest("hex").slice(0, 32);
}

const ref = (key: string) => adminDb().collection("rateLimits").doc(key);

export async function assertNotLimited(key: string): Promise<void> {
  const d = (await ref(key).get()).data() as LimitDoc | undefined;
  if (!d) return;
  const elapsed = Date.now() - d.windowStart.toMillis();
  if (elapsed < WINDOW_MS && d.failures >= MAX_FAILURES) {
    const retryAfterSec = Math.ceil((WINDOW_MS - elapsed) / 1000);
    throw new HttpError(429, "입력 실패가 너무 많습니다. 잠시 후 다시 시도하세요.", { reason: "rate_limited", retryAfterSec });
  }
}

export async function recordFailure(key: string): Promise<void> {
  await adminDb().runTransaction(async (tx) => {
    const d = (await tx.get(ref(key))).data() as LimitDoc | undefined;
    const now = Date.now();
    const expireAt = Timestamp.fromMillis(now + WINDOW_MS * 2);
    if (!d || now - d.windowStart.toMillis() >= WINDOW_MS) {
      tx.set(ref(key), { failures: 1, windowStart: Timestamp.fromMillis(now), expireAt });
    } else {
      tx.update(ref(key), { failures: FieldValue.increment(1), expireAt });
    }
  });
}
