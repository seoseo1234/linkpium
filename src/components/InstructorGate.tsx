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
              const code = (e as { code?: string }).code;
              if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request")
                setErr(code === "auth/popup-blocked" ? "팝업이 차단되었습니다. 브라우저에서 팝업을 허용해 주세요." : "로그인하지 못했습니다. 다시 시도하세요.");
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
