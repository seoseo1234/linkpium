import "server-only";
import { randomBytes, randomInt } from "node:crypto";

/** 100000~999999 균등 무작위 (선행 0 코드는 프로젝터에서 혼동될 수 있어 제외) */
export function generateJoinCode(): string {
  return String(randomInt(100000, 1000000));
}

/** 128bit URL-safe 토큰 — 직접 링크용, 추측 불가 */
export function generatePublicToken(): string {
  return randomBytes(16).toString("base64url");
}
