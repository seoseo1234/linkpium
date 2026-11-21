"use client";

import { use, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { InstructorGate } from "@/components/InstructorGate";
import { FullMessage, Logo, QrImage, Sprout } from "@/components/ui";
import { directLink, siteHost } from "@/lib/firebase-client";
import { useInstructorSession } from "@/lib/realtime";
import { formatJoinCode } from "@/lib/shared";

/** S05 프로젝터용 입장 안내 */
export default function ProjectorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <InstructorGate>{(user) => <Projector id={id} user={user} />}</InstructorGate>;
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <p className="flex items-center justify-center gap-3 text-[clamp(1.1rem,2vw,2rem)] font-bold text-cocoa-900">
      <span className="grid size-[1.6em] place-items-center rounded-full bg-brand-400 text-[0.85em]">{n}</span>
      {children}
    </p>
  );
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
    <main className="warm-blobs relative flex min-h-dvh flex-col items-center bg-canvas px-[4vw] py-[3vh] text-ink">
      {!isFull && (
        <button
          type="button"
          className="absolute right-5 top-5 rounded-xl border border-brand-200 bg-surface px-4 py-2 text-sm font-bold text-cocoa-700 hover:bg-brand-50"
          onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}
        >
          ⛶ 전체 화면
        </button>
      )}

      <div className="flex flex-col items-center text-center">
        <div className="[&_svg]:size-[clamp(3.5rem,7vw,7rem)] [&_span]:text-[clamp(2rem,4.5vw,4.5rem)]">
          <Logo size="xl" stacked href={null} />
        </div>
        <p className="mt-[1.5vh] text-[clamp(1.1rem,2vw,2rem)] font-bold text-cocoa-700">{session.title}</p>
      </div>

      <div className="mt-[3vh] flex w-full max-w-[1500px] flex-1 flex-wrap items-center justify-center gap-[3vw]">
        <div className="card min-w-0 flex-1 basis-[560px] px-[3vw] py-[4vh]">
          <Step n={1}>노트북에서 접속하세요</Step>
          <p className="mt-[1vh] break-all text-center font-extrabold leading-tight tracking-tight text-brand-600 text-[clamp(2.75rem,7.5vw,8.5rem)]">
            {host}
          </p>

          <hr className="my-[3vh] border-line" />

          <Step n={2}>입장 코드를 입력하세요</Step>
          <div className="mt-[1.5vh] flex justify-center">
            <p className="rounded-2xl bg-brand-200 px-[2.5vw] py-[0.5vh] font-mono font-extrabold leading-none tracking-[0.12em] text-cocoa-900 text-[clamp(3rem,8vw,9rem)]">
              {formatJoinCode(session.joinCode)}
            </p>
          </div>
          {session.status !== "live" && session.status !== "draft" && (
            <p className="mt-[2vh] text-center text-lg font-bold text-bloom-600">현재 강의가 종료(또는 차단) 상태입니다.</p>
          )}
        </div>

        <div className="card flex flex-col items-center gap-3 p-[2vw]">
          <QrImage value={directLink(session.publicToken)} size={260} className="size-[clamp(150px,17vw,300px)]" />
          <p className="text-center text-[clamp(0.9rem,1.2vw,1.2rem)] font-bold text-cocoa-700">
            스마트폰은
            <br />
            QR코드로 바로 입장
          </p>
        </div>
      </div>

      <p className="mt-[3vh] flex items-center gap-2 text-center font-hand text-[clamp(1.6rem,2.6vw,2.8rem)] leading-tight text-cocoa-700">
        ‘배움이 연결되는 순간, 링크피움과 함께하세요!’
        <Sprout className="size-[1.2em]" />
      </p>
    </main>
  );
}
