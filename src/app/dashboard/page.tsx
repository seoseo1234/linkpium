"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "firebase/auth";
import { useAuth } from "@/components/AuthProvider";
import { InstructorGate } from "@/components/InstructorGate";
import { CopyButton, Logo, Modal, Sprout, StatusBadge, btn, dateLabel, inputCls, timeLabel } from "@/components/ui";
import { directLink } from "@/lib/firebase-client";
import { useMySessions, type InstructorSession } from "@/lib/realtime";
import { formatJoinCode } from "@/lib/shared";

/** S02 강사 대시보드 */
export default function DashboardPage() {
  return <InstructorGate>{(user) => <Dashboard user={user} />}</InstructorGate>;
}

const THUMBS = [
  { icon: "🤖", bg: "from-sky-100 to-brand-100" },
  { icon: "📚", bg: "from-sprout-100 to-brand-100" },
  { icon: "💡", bg: "from-brand-200 to-brand-100" },
  { icon: "🌱", bg: "from-sprout-100 to-brand-50" },
  { icon: "🎨", bg: "from-bloom-50 to-brand-100" },
];

function thumbFor(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return THUMBS[h % THUMBS.length]!;
}

function Dashboard({ user }: { user: User }) {
  const { logOut } = useAuth();
  const sessions = useMySessions(user.uid);
  const [creating, setCreating] = useState(false);
  const name = user.displayName || user.email?.split("@")[0] || "강사";

  return (
    <div className="flex min-h-dvh">
      {/* 사이드바 */}
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-line bg-brand-50/60 px-4 py-6 md:flex">
        <div className="flex justify-center">
          <Logo size="lg" stacked href="/dashboard" />
        </div>
        <nav className="mt-8 space-y-1" aria-label="강사 메뉴">
          <Link href="/dashboard" aria-current="page" className="flex items-center gap-2.5 rounded-xl bg-brand-400 px-3 py-2.5 font-bold text-cocoa-900">
            <span aria-hidden>🏠</span> 내 강의
          </Link>
          <Link href="/" className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 font-semibold text-cocoa-700 hover:bg-brand-100">
            <span aria-hidden>🔢</span> 참여자 입장 화면
          </Link>
        </nav>
        <div className="mt-auto flex items-center gap-2.5 rounded-xl px-2 py-2">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-200 font-bold text-cocoa-900" aria-hidden>
            {name.slice(0, 1)}
          </span>
          <div className="min-w-0 text-sm">
            <p className="truncate font-bold">{name}님</p>
            <button type="button" onClick={logOut} className="text-xs text-ink-muted hover:text-cocoa-900 hover:underline">
              로그아웃
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* 모바일 상단바 */}
        <header className="flex items-center gap-3 border-b border-line bg-surface px-5 py-3 md:hidden">
          <Logo href="/dashboard" />
          <button type="button" className={`${btn.ghost} ml-auto`} onClick={logOut}>
            로그아웃
          </button>
        </header>

        <main className="mx-auto max-w-4xl px-5 py-8">
          <section className="card relative mb-8 overflow-hidden p-6 sm:p-8">
            <div className="absolute -right-6 -top-6 size-40 rounded-full bg-brand-100" aria-hidden />
            <Sprout className="absolute right-6 top-4 h-24 sm:right-10 sm:h-28" />
            <p className="relative text-xl font-extrabold leading-snug text-cocoa-900 sm:text-2xl">
              안녕하세요, {name}님!
              <br />
              오늘도 의미 있는 연수가 되길 바랍니다 😊
            </p>
            <button type="button" className={`${btn.primary} relative mt-6 px-5 py-3`} onClick={() => setCreating(true)}>
              ＋ 새 강의 만들기
            </button>
          </section>

          <h1 className="mb-3 text-lg font-extrabold">내 강의 목록</h1>

          {sessions === null ? (
            <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="h-32 animate-pulse rounded-3xl bg-brand-100/50" />)}</div>
          ) : sessions.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-brand-200 p-12 text-center">
              <p className="text-lg font-bold">아직 만든 강의가 없어요.</p>
              <p className="mt-1 text-ink-muted">첫 강의를 만들면 6자리 입장 코드와 참여 링크가 바로 생깁니다.</p>
              <button type="button" className={`${btn.primary} mt-6`} onClick={() => setCreating(true)}>
                ＋ 새 강의 만들기
              </button>
            </div>
          ) : (
            <ul className="grid gap-3">
              {sessions.map((s) => (
                <SessionRow key={s.id} s={s} />
              ))}
            </ul>
          )}
        </main>
      </div>

      <CreateSessionModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function SessionRow({ s }: { s: InstructorSession }) {
  const { api } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const thumb = thumbFor(s.id);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <li className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-4">
        <div aria-hidden className={`grid size-20 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-4xl ${thumb.bg}`}>
          {thumb.icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/instructor/sessions/${s.id}`} className="truncate text-lg font-extrabold hover:text-brand-700">
              {s.title}
            </Link>
            <StatusBadge status={s.status} />
          </div>
          <p className="mt-0.5 text-sm text-ink-muted">
            {dateLabel(s.createdAtMs)} {timeLabel(s.createdAtMs)} 생성
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <CopyButton
              text={directLink(s.publicToken)}
              label={<>🔗 참여 링크 복사</>}
              className="inline-flex items-center rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-cocoa-700 hover:bg-brand-50"
            />
          </div>
        </div>

        <div className="rounded-xl bg-brand-100 px-3 py-1.5 text-center">
          <p className="text-[11px] font-semibold text-cocoa-700">입장 코드</p>
          <p className="font-mono text-xl font-extrabold tracking-wider text-cocoa-900">{formatJoinCode(s.joinCode)}</p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Link href={`/instructor/sessions/${s.id}`} className={btn.secondary}>
            관리
          </Link>
          <button
            type="button"
            className={btn.secondary}
            disabled={!!busy}
            onClick={() =>
              run("dup", async () => {
                const r = await api<{ session: { id: string } }>(`/api/instructor/sessions/${s.id}/duplicate`, { method: "POST" });
                router.push(`/instructor/sessions/${r.session.id}`);
              })
            }
          >
            {busy === "dup" ? "복제 중…" : "복제"}
          </button>
          <button
            type="button"
            className={btn.danger}
            disabled={!!busy}
            onClick={() => {
              if (!confirm(`"${s.title}" 강의를 삭제할까요?\n게시물과 참여 링크·코드가 모두 사라지며 되돌릴 수 없습니다.`)) return;
              run("del", () => api(`/api/instructor/sessions/${s.id}`, { method: "DELETE" }).then(() => undefined));
            }}
          >
            {busy === "del" ? "삭제 중…" : "삭제"}
          </button>
        </div>
      </div>
      {err && (
        <p role="alert" className="mt-2 text-sm text-bloom-600">
          {err}
        </p>
      )}
    </li>
  );
}

function CreateSessionModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { api } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [driveUrl, setDriveUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ session: { id: string } }>("/api/instructor/sessions", {
        method: "POST",
        body: { title, description, driveUrl },
      });
      router.push(`/instructor/sessions/${r.session.id}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="새 강의 만들기">
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-bold">강의 제목 *</span>
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: AI 이미지 제작 연수" required autoFocus maxLength={200} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold">설명 (선택)</span>
          <textarea className={inputCls} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} placeholder="예: ○○초등학교 · 14:00 ~ 16:00" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold">구글 드라이브 폴더 링크 (선택)</span>
          <input className={inputCls} type="url" value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)} placeholder="https://drive.google.com/drive/folders/…" />
          <span className="mt-1 block text-xs text-ink-muted">참여자 화면 맨 위에 항상 고정됩니다. 열람 권한은 드라이브 공유 설정을 따릅니다.</span>
        </label>
        {err && <p role="alert" className="text-sm text-bloom-600">{err}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={btn.secondary} onClick={onClose}>
            취소
          </button>
          <button type="submit" className={btn.primary} disabled={busy || !title.trim()}>
            {busy ? "만드는 중…" : "강의 만들기"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
