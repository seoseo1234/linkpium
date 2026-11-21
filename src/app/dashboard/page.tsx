"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "firebase/auth";
import { useAuth } from "@/components/AuthProvider";
import { InstructorGate } from "@/components/InstructorGate";
import { CopyButton, Logo, Modal, StatusBadge, btn, inputCls, timeLabel } from "@/components/ui";
import { directLink } from "@/lib/firebase-client";
import { useMySessions, type InstructorSession } from "@/lib/realtime";
import { formatJoinCode } from "@/lib/shared";

/** S02 강사 대시보드 */
export default function DashboardPage() {
  return <InstructorGate>{(user) => <Dashboard user={user} />}</InstructorGate>;
}

function Dashboard({ user }: { user: User }) {
  const { logOut } = useAuth();
  const sessions = useMySessions(user.uid);
  const [creating, setCreating] = useState(false);

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-5 py-3">
          <Logo href="/dashboard" />
          <span className="ml-auto hidden text-sm text-ink-muted sm:inline">{user.email}</span>
          <button type="button" className={btn.ghost} onClick={logOut}>
            로그아웃
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">내 강의</h1>
            <p className="text-sm text-ink-muted">강의마다 독립된 공유 공간과 입장 코드가 발급됩니다.</p>
          </div>
          <button type="button" className={`${btn.primary} px-5 py-3`} onClick={() => setCreating(true)}>
            ＋ 새 강의 만들기
          </button>
        </div>

        {sessions === null ? (
          <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-black/5" />)}</div>
        ) : sessions.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-line p-12 text-center">
            <p className="text-lg font-semibold">아직 만든 강의가 없어요.</p>
            <p className="mt-1 text-ink-muted">첫 강의를 만들면 6자리 입장 코드와 참여 링크가 바로 생깁니다.</p>
            <button type="button" className={`${btn.primary} mt-6`} onClick={() => setCreating(true)}>
              새 강의 만들기
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

      <CreateSessionModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function SessionRow({ s }: { s: InstructorSession }) {
  const { api } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

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
    <li className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={s.status} />
            <span className="text-xs text-ink-muted">{timeLabel(s.createdAtMs)} 생성</span>
          </div>
          <Link href={`/instructor/sessions/${s.id}`} className="mt-1 block truncate text-lg font-bold hover:text-brand-700">
            {s.title}
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-muted">
            <span>
              입장 코드 <strong className="font-mono text-base tracking-wider text-ink">{formatJoinCode(s.joinCode)}</strong>
            </span>
            <CopyButton text={directLink(s.publicToken)} label="참여 링크 복사" className={btn.ghost} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Link href={`/instructor/sessions/${s.id}`} className={btn.primary}>
            관리하기
          </Link>
          <button
            type="button"
            className={btn.ghost}
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
        <p role="alert" className="mt-2 text-sm text-red-700">
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
          <span className="mb-1 block text-sm font-semibold">강의 제목 *</span>
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: AI 이미지 제작 연수" required autoFocus maxLength={200} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">설명 (선택)</span>
          <textarea className={inputCls} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} placeholder="예: ○○초등학교 · 2교시" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">구글 드라이브 폴더 링크 (선택)</span>
          <input className={inputCls} type="url" value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)} placeholder="https://drive.google.com/drive/folders/…" />
          <span className="mt-1 block text-xs text-ink-muted">참여자 화면 맨 위에 항상 고정됩니다. 열람 권한은 드라이브 공유 설정을 따릅니다.</span>
        </label>
        {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
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
