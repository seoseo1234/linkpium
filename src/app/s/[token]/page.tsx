"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { PostCard } from "@/components/PostCard";
import { FullMessage, Logo, btn } from "@/components/ui";
import { firebaseConfigured } from "@/lib/firebase-client";
import { usePublicBoard, type Connection } from "@/lib/realtime";
import { rememberVisit } from "@/lib/recent";
import { TYPE_LABEL, displayTitle, isSafeHttpUrl, type PostType } from "@/lib/shared";

const NEW_HIGHLIGHT_MS = 60_000;

/** S04 참여자 공유 보드 */
export default function ParticipantBoardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  if (!firebaseConfigured) return <FullMessage title="서비스 설정이 아직 완료되지 않았습니다." />;
  return <Board token={token} />;
}

function Board({ token }: { token: string }) {
  const { board, posts, error, connection } = usePublicBoard(token);
  const [filter, setFilter] = useState<PostType | "all">("all");

  // 새 자료 감지: 첫 로드 이후 추가된 id
  const seen = useRef<Set<string> | null>(null);
  const [newIds, setNewIds] = useState<Map<string, number>>(new Map());
  const [unseenBelow, setUnseenBelow] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!posts) return;
    if (seen.current === null) {
      seen.current = new Set(posts.map((p) => p.id));
      return;
    }
    const fresh = posts.filter((p) => !seen.current!.has(p.id));
    if (!fresh.length) return;
    fresh.forEach((p) => seen.current!.add(p.id));
    const now = Date.now();
    setNewIds((m) => {
      const next = new Map(m);
      fresh.forEach((p) => next.set(p.id, now));
      return next;
    });
    // 읽던 위치는 그대로 두고 배너로 알린다 (브라우저 scroll anchoring 이 위치 유지)
    if (window.scrollY > 160) setUnseenBelow((n) => n + fresh.length);
    const first = fresh[0]!;
    setToast(`새 ${TYPE_LABEL[first.type]}: ${displayTitle(first)}${fresh.length > 1 ? ` 외 ${fresh.length - 1}개` : ""}`);
  }, [posts]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!newIds.size) return;
    const t = setInterval(() => {
      const cutoff = Date.now() - NEW_HIGHLIGHT_MS;
      setNewIds((m) => new Map([...m].filter(([, at]) => at > cutoff)));
    }, 10_000);
    return () => clearInterval(t);
  }, [newIds.size]);

  useEffect(() => {
    const onScroll = () => window.scrollY < 120 && setUnseenBelow(0);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (board) {
      document.title = `${board.title} · 링크피움`;
      rememberVisit(token, board.title);
    }
  }, [board, token]);

  const visible = useMemo(() => (posts ?? []).filter((p) => filter === "all" || p.type === filter), [posts, filter]);

  if (error === "closed")
    return (
      <FullMessage
        title="접근이 차단된 강의입니다."
        body="강의가 종료되어 강사님이 열람을 막았거나 삭제했습니다."
        action={<Link className={btn.secondary} href="/">다른 코드로 입장</Link>}
      />
    );
  if (error === "not_found")
    return (
      <FullMessage
        title="강의를 찾을 수 없습니다."
        body="링크가 정확한지 확인하거나 강의 코드로 입장해 주세요."
        action={<Link className={btn.secondary} href="/">코드로 입장</Link>}
      />
    );
  if (error === "unknown")
    return (
      <FullMessage
        title="자료를 불러오지 못했습니다."
        body="잠시 후 다시 시도하세요."
        action={<button className={btn.primary} onClick={() => location.reload()}>다시 시도</button>}
      />
    );

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Logo />
          <div className="ml-auto">
            <ConnectionDot state={connection} />
          </div>
        </div>
      </header>

      {toast && (
        <div role="status" aria-live="polite" className="fixed inset-x-0 top-16 z-30 flex justify-center px-4">
          <div className="animate-bloom max-w-xl truncate rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white shadow-lg">
            ✿ {toast}
          </div>
        </div>
      )}

      {unseenBelow > 0 && (
        <div className="fixed inset-x-0 top-28 z-30 flex justify-center">
          <button
            type="button"
            className="animate-bloom rounded-full bg-bloom-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg hover:bg-bloom-400"
            onClick={() => {
              window.scrollTo({ top: 0, behavior: "smooth" });
              setUnseenBelow(0);
            }}
          >
            ↑ 새 자료 {unseenBelow}개
          </button>
        </div>
      )}

      <main className="mx-auto max-w-3xl px-4 pb-24 pt-6">
        {!board ? (
          <BoardSkeleton />
        ) : (
          <>
            <section className="mb-6">
              {board.status === "ended" && (
                <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">종료된 강의입니다. 공개된 자료는 계속 볼 수 있어요.</p>
              )}
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{board.title}</h1>
              {board.description && <p className="mt-1 whitespace-pre-wrap text-ink-muted">{board.description}</p>}
              {board.driveUrl && isSafeHttpUrl(board.driveUrl) && (
                <a
                  href={board.driveUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="mt-4 flex items-center gap-3 rounded-2xl border-2 border-brand-200 bg-brand-50 p-4 font-semibold text-brand-700 transition hover:border-brand-500"
                >
                  <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-xl shadow-sm">📁</span>
                  <span className="flex-1">
                    기본 실습 자료 열기 (구글 드라이브)
                    <span className="block text-xs font-normal text-ink-muted">발표 자료·실습 파일은 여기에 있어요</span>
                  </span>
                  <span aria-hidden>↗</span>
                  <span className="sr-only">(새 탭)</span>
                </a>
              )}
            </section>

            <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="자료 유형 필터">
              {(["all", "prompt", "link", "notice"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={filter === f}
                  onClick={() => setFilter(f)}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
                    filter === f ? "bg-ink text-white" : "border border-line bg-surface text-ink-muted hover:text-ink"
                  }`}
                >
                  {f === "all" ? "전체" : TYPE_LABEL[f]}
                </button>
              ))}
            </div>

            {posts === null ? (
              <BoardSkeleton />
            ) : visible.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-line p-10 text-center text-ink-muted">
                {posts.length === 0 ? (
                  <>
                    아직 공유된 자료가 없어요.
                    <br />
                    강사님이 자료를 올리면 <strong className="text-ink">새로고침 없이</strong> 여기에 나타납니다.
                  </>
                ) : (
                  "이 유형의 자료가 없어요."
                )}
              </div>
            ) : (
              <ul className="space-y-4">
                {visible.map((p) => (
                  <li key={p.id}>
                    <PostCard post={p} isNew={newIds.has(p.id)} />
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-12 text-center text-xs leading-relaxed text-ink-muted">
              이 페이지를 북마크하면 강의가 끝난 뒤에도 다시 볼 수 있어요.
              <br />
              복사해 간 자료는 강사가 삭제해도 회수되지 않습니다.
            </p>
          </>
        )}
      </main>
    </div>
  );
}

function ConnectionDot({ state }: { state: Connection }) {
  const map = {
    online: { c: "bg-brand-500", t: "실시간 연결됨" },
    connecting: { c: "bg-amber-400 animate-pulse", t: "연결 중…" },
    offline: { c: "bg-red-500 animate-pulse", t: "연결 끊김 · 재연결 중" },
  }[state];
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-canvas px-3 py-1 text-xs font-medium text-ink-muted" role="status">
      <span className={`size-2 rounded-full ${map.c}`} aria-hidden />
      {map.t}
    </span>
  );
}

function BoardSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-32 animate-pulse rounded-2xl bg-black/5" />
      ))}
    </div>
  );
}
