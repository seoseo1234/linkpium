"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo, btn } from "@/components/ui";
import { normalizeJoinCode } from "@/lib/shared";
import { forgetVisit, getRecent, getRememberConsent, setRememberConsent, type RecentEntry } from "@/lib/recent";

/** S01 공통 입장 화면 */
export default function JoinPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState(false);
  const [recent, setRecent] = useState<RecentEntry[]>([]);

  useEffect(() => {
    setRemember(getRememberConsent());
    setRecent(getRecent());
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const normalized = normalizeJoinCode(code);
    if (!normalized) {
      setError("강사님이 알려주신 숫자 6자리를 입력하세요.");
      inputRef.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: normalized }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string; retryAfterSec?: number };
      if (!res.ok || !data.url) {
        let msg = data.error ?? "입장하지 못했습니다. 잠시 후 다시 시도하세요.";
        if (res.status === 429 && data.retryAfterSec) msg += ` (약 ${Math.ceil(data.retryAfterSec / 60)}분 후)`;
        setError(msg);
        inputRef.current?.select();
        return;
      }
      setRememberConsent(remember);
      router.push(data.url);
    } catch {
      setError("네트워크에 연결할 수 없습니다. 인터넷 연결을 확인하고 다시 시도하세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="warm-blobs flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-end px-5 py-4">
        <Link href="/dashboard" className="rounded-lg px-2 py-1 text-sm font-semibold text-ink-muted underline-offset-4 hover:text-cocoa-900 hover:underline">
          강사 로그인
        </Link>
      </header>

      <main className="flex flex-1 items-start justify-center px-5 pt-[4vh] pb-16">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center text-center">
            <Logo size="xl" stacked href={null} />
            <p className="mt-4 text-lg font-semibold text-cocoa-700">링크 하나로 피어나는 배움</p>
          </div>

          <form onSubmit={submit} noValidate className="card p-6 sm:p-8">
            <h1 className="flex items-center justify-center gap-2 text-lg font-bold text-cocoa-900">
              <span className="grid size-6 place-items-center rounded-full bg-brand-400 text-sm">#</span>
              입장 코드를 입력하세요
            </h1>
            <label htmlFor="code" className="mt-1 block text-center text-sm text-ink-muted">
              강사님이 알려주신 <strong className="text-ink">숫자 6자리</strong>를 입력하세요.
            </label>
            <input
              ref={inputRef}
              id="code"
              name="code"
              autoFocus
              inputMode="numeric"
              autoComplete="off"
              enterKeyHint="go"
              maxLength={9}
              placeholder="000 000"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/[^\d\s-]/g, ""));
                setError(null);
              }}
              aria-invalid={!!error}
              aria-describedby={error ? "code-error" : undefined}
              className="mt-4 w-full rounded-2xl border-2 border-brand-200 bg-brand-50 py-4 text-center font-mono text-4xl font-extrabold tracking-[0.3em] text-cocoa-900 outline-none transition placeholder:text-cocoa-700/20 focus:border-brand-500 focus:bg-surface sm:text-5xl"
            />
            {error && (
              <p id="code-error" role="alert" className="mt-3 rounded-xl bg-bloom-50 px-3 py-2 text-center text-sm font-semibold text-bloom-600">
                {error}
              </p>
            )}
            <button type="submit" disabled={busy} className={`${btn.primary} mt-5 w-full py-4 text-lg`}>
              {busy ? "확인 중…" : "입장하기"}
            </button>
            <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 text-sm text-ink-muted">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="size-4 accent-brand-600"
              />
              이 브라우저에 최근 입장한 강의 기억하기
            </label>
          </form>

          {recent.length > 0 && (
            <section className="mt-8" aria-labelledby="recent-h">
              <h2 id="recent-h" className="mb-2 text-sm font-semibold text-ink-muted">
                최근 입장한 강의
              </h2>
              <ul className="space-y-2">
                {recent.map((r) => (
                  <li key={r.token} className="flex items-center gap-2 rounded-2xl border border-line bg-surface pr-2">
                    <Link href={`/s/${r.token}`} className="flex-1 truncate rounded-2xl px-4 py-3 font-semibold hover:text-brand-700">
                      {r.title || "강의 공유 보드"}
                    </Link>
                    <button
                      type="button"
                      className={btn.ghost}
                      aria-label={`${r.title} 기록 지우기`}
                      onClick={() => {
                        forgetVisit(r.token);
                        setRecent(getRecent());
                      }}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="mt-10 text-center text-xs leading-relaxed text-ink-muted">
            회원가입이나 개인정보 입력 없이 이용합니다.
            <br />
            코드나 링크를 아는 사람은 누구나 볼 수 있는 공유 공간이에요.
          </p>
        </div>
      </main>
    </div>
  );
}
