"use client";

// 최근 입장 강의: 사용자가 동의한 경우에만 이 브라우저(localStorage)에 저장. 서버로 보내지 않음.
const KEY = "linkpium:recent";
const CONSENT = "linkpium:remember";
const MAX = 5;

export type RecentEntry = { token: string; title: string; at: number };

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, v: string | null) {
  try {
    if (v === null) localStorage.removeItem(key);
    else localStorage.setItem(key, v);
  } catch {
    /* 사생활 보호 모드 등 */
  }
}

export function getRememberConsent(): boolean {
  return safeGet(CONSENT) === "1";
}

export function setRememberConsent(on: boolean) {
  safeSet(CONSENT, on ? "1" : null);
  if (!on) safeSet(KEY, null);
}

export function getRecent(): RecentEntry[] {
  try {
    const arr = JSON.parse(safeGet(KEY) ?? "[]");
    return Array.isArray(arr) ? arr.filter((e) => e && typeof e.token === "string").slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function rememberVisit(token: string, title: string) {
  if (!getRememberConsent()) return;
  const list = getRecent().filter((e) => e.token !== token);
  list.unshift({ token, title, at: Date.now() });
  safeSet(KEY, JSON.stringify(list.slice(0, MAX)));
}

export function forgetVisit(token: string) {
  safeSet(KEY, JSON.stringify(getRecent().filter((e) => e.token !== token)));
}
