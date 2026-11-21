"use client";

import { useState, type ReactNode } from "react";
import type { User } from "firebase/auth";
import { useAuth } from "./AuthProvider";
import { FullMessage, Logo, btn } from "./ui";
import { firebaseConfigured } from "@/lib/firebase-client";

/** 강사 화면 공통: 로그인 안 되어 있으면 Google 로그인 화면 */
export function InstructorGate({ children }: { children: (user: User) => ReactNode }) {
  const { user, loading, signIn } = useAuth();
  const [err, setErr] = useState<string | null>(null);

  if (!firebaseConfigured)
    return <FullMessage title="Firebase 설정이 필요합니다." body={<>.env.local 에 NEXT_PUBLIC_FIREBASE_* 값을 넣고 서버를 다시 시작하세요.</>} />;
  if (loading) return <FullMessage title="불러오는 중…" />;
  if (user) return <>{children(user)}</>;

  return (
    <main className="grid min-h-dvh place-items-center warm-blobs p-6">
      <div className="w-full max-w-sm card p-8 text-center">
        <div className="mb-6 flex justify-center">
          <Logo size="lg" stacked href={null} />
        </div>
        <h1 className="text-xl font-bold">강사 로그인</h1>
        <p className="mt-1 text-sm text-ink-muted">강의 공간을 만들고 자료를 공유하려면 로그인하세요.</p>
        <button
          type="button"
          className={`${btn.secondary} mt-6 w-full py-3 text-base`}
          onClick={async () => {
            setErr(null);
            try {
              await signIn();
            } catch (e) {
              const code = (e as { code?: string }).code ?? "unknown";
              console.error("[login]", e);
              if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") setErr(loginErrorMessage(code));
            }
          }}
        >
          <GoogleIcon /> Google 계정으로 로그인
        </button>
        {err && (
          <p role="alert" className="mt-3 text-sm text-bloom-600">
            {err}
          </p>
        )}
        <p className="mt-6 text-xs text-ink-muted">참여자(선생님)는 로그인 없이 코드로 입장합니다.</p>
      </div>
    </main>
  );
}

/** Firebase 로그인 오류 코드 → 안내 문구. 원인 파악을 위해 코드도 함께 표시 */
function loginErrorMessage(code: string): string {
  const host = typeof window !== "undefined" ? window.location.host : "";
  const known: Record<string, string> = {
    "auth/popup-blocked": "팝업이 차단되었습니다. 브라우저 주소창 오른쪽에서 팝업을 허용해 주세요.",
    "auth/unauthorized-domain": `이 주소(${host})가 Firebase 승인된 도메인에 없습니다. Firebase 콘솔 → Authentication → 설정 → 승인된 도메인에 추가하세요.`,
    "auth/operation-not-allowed": "Firebase에서 Google 로그인이 꺼져 있습니다. Authentication → 로그인 방법에서 Google을 사용 설정하세요.",
    "auth/network-request-failed": "네트워크 연결을 확인한 뒤 다시 시도하세요.",
    "auth/too-many-requests": "로그인 시도가 너무 많습니다. 잠시 후 다시 시도하세요.",
    "auth/invalid-api-key": "Firebase API 키가 올바르지 않습니다. 환경변수 NEXT_PUBLIC_FIREBASE_API_KEY를 확인하세요.",
    "auth/api-key-not-valid.-please-pass-a-valid-api-key.": "Firebase API 키가 올바르지 않습니다. 환경변수 NEXT_PUBLIC_FIREBASE_API_KEY를 확인하세요.",
  };
  return `${known[code] ?? "로그인하지 못했습니다. 다시 시도하세요."} (오류 코드: ${code})`;
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
