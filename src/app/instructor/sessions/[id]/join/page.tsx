"use client";

import { use, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { InstructorGate } from "@/components/InstructorGate";
import { FullMessage, Logo, QrImage } from "@/components/ui";
import { directLink, siteHost } from "@/lib/firebase-client";
import { useInstructorSession } from "@/lib/realtime";
import { formatJoinCode } from "@/lib/shared";

/** S05 프로젝터용 입장 안내 */
export default function ProjectorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <InstructorGate>{(user) => <Projector id={id} user={user} />}</InstructorGate>;
}

function Projector({ id, user }: { id: string; user: User }) {
  const { session, error } = useInstructorSession(id, user.uid);
  const [host, setHost] = useState("");
  const [isFull, setIsFull] = useState(false);

  useEffect(() => setHost(siteHost()), []);
  useEffect(() => {
    const on = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  useEffect(() => {
    if (session) document.title = `입장 안내 · ${session.title}`;
  }, [session]);

  if (error) return <FullMessage title={error} />;
  if (!session) return <FullMessage title="불러오는 중…" />;

  return (
    <main className="relative flex min-h-dvh flex-col bg-white px-[5vw] py-[4vh] text-ink">
      <div className="flex items-center justify-between">
        <Logo href={null} />
        {!isFull && (
          <button
            type="button"
            className="rounded-xl border border-line px-4 py-2 text-sm font-semibold hover:bg-brand-50"
            onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}
          >
            ⛶ 전체 화면
          </button>
        )}
      </div>

      <div className="grid flex-1 items-center gap-[4vw] lg:grid-cols-[1fr_auto]">
        <div>
          <p className="text-[clamp(1.25rem,2.2vw,2.25rem)] font-bold text-brand-700">{session.title}</p>

          <p className="mt-[3vh] text-[clamp(1rem,1.6vw,1.6rem)] font-semibold text-ink-muted">① 노트북 브라우저 주소창에 입력</p>
          <p className="break-all font-extrabold leading-none tracking-tight text-[clamp(3rem,8.5vw,9rem)]">{host}</p>

          <p className="mt-[4vh] text-[clamp(1rem,1.6vw,1.6rem)] font-semibold text-ink-muted">② 강의 코드 입력</p>
          <p className="font-mono font-extrabold leading-none tracking-[0.12em] text-brand-600 text-[clamp(2.5rem,7vw,7.5rem)]">
            {formatJoinCode(session.joinCode)}
          </p>
          {session.status !== "live" && session.status !== "draft" && (
            <p className="mt-6 inline-block rounded-xl bg-amber-100 px-4 py-2 text-lg font-semibold text-amber-800">현재 강의가 종료(또는 차단) 상태입니다.</p>
          )}
        </div>

        <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-line p-[2vw]">
          <QrImage value={directLink(session.publicToken)} size={260} className="size-[clamp(160px,20vw,320px)]" />
          <p className="text-center text-[clamp(0.9rem,1.2vw,1.2rem)] font-semibold text-ink-muted">
            스마트폰은
            <br />
            QR코드로 바로 입장
          </p>
        </div>
      </div>

      <p className="text-center text-[clamp(0.9rem,1.2vw,1.25rem)] text-ink-muted">회원가입·로그인 없이 바로 입장합니다 · 새 자료는 새로고침 없이 나타나요</p>
    </main>
  );
}
