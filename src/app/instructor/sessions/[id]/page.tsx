"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { User } from "firebase/auth";
import { useAuth } from "@/components/AuthProvider";
import { InstructorGate } from "@/components/InstructorGate";
import {
  CopyButton,
  FullMessage,
  Logo,
  Modal,
  QrImage,
  StatusBadge,
  btn,
  dateLabel,
  inputCls,
  relativeTime,
  useMinuteTick,
} from "@/components/ui";
import { directLink } from "@/lib/firebase-client";
import { useInstructorPosts, useInstructorSession, type InstructorSession, type Post } from "@/lib/realtime";
import { TYPE_LABEL, canPost, displayTitle, formatJoinCode, isSafeHttpUrl, sortPosts, type PostType } from "@/lib/shared";

/** S03 강사 공유 보드 */
export default function InstructorBoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <InstructorGate>{(user) => <InstructorBoard id={id} user={user} />}</InstructorGate>;
}

const TYPE_ICON: Record<PostType, string> = { link: "🔗", prompt: "✨", notice: "📢" };

function InstructorBoard({ id, user }: { id: string; user: User }) {
  const { api } = useAuth();
  const { session, error } = useInstructorSession(id, user.uid);
  const posts = useInstructorPosts(session?.publicToken);
  const [focus, setFocus] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);

  useEffect(() => {
    if (session) document.title = `${session.title} · 강사 · 링크피움`;
  }, [session]);

  if (error)
    return <FullMessage title={error} action={<Link className={btn.secondary} href="/dashboard">내 강의 목록</Link>} />;
  if (!session) return <FullMessage title="불러오는 중…" />;

  const isOpen = session.status === "live" || session.status === "draft";
  async function toggleStatus() {
    if (isOpen && !confirm("강의를 종료할까요?\n참여자는 기존 자료를 계속 읽을 수 있고, 새 자료는 올릴 수 없습니다.")) return;
    setStatusBusy(true);
    try {
      await api(`/api/instructor/sessions/${id}`, { method: "PATCH", body: { status: isOpen ? "ended" : "live" } });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setStatusBusy(false);
    }
  }

  return (
    <div className="warm-blobs min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
          <Logo href="/dashboard" />
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <StatusBadge status={session.status} />
            <h1 className="truncate text-lg font-extrabold">{session.title}</h1>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-brand-100 px-3 py-1">
            <span className="text-xs font-semibold text-cocoa-700">입장 코드</span>
            <strong className="font-mono text-xl font-extrabold tracking-wider text-cocoa-900">{formatJoinCode(session.joinCode)}</strong>
          </div>
          <Link href={`/instructor/sessions/${id}/join`} target="_blank" className={btn.secondary}>
            🖥 입장 안내 화면
          </Link>
          <button type="button" className={btn.ghost} onClick={() => setFocus((f) => !f)} aria-pressed={focus}>
            {focus ? "집중 모드 끄기" : "집중 모드"}
          </button>
          {session.status !== "closed" && (
            <button type="button" className={isOpen ? btn.stop : btn.primary} disabled={statusBusy} onClick={toggleStatus}>
              {isOpen ? "강의 종료" : "강의 다시 열기"}
            </button>
          )}
        </div>
      </header>

      <main className={`mx-auto grid max-w-6xl gap-5 px-5 py-6 ${focus ? "max-w-4xl" : "lg:grid-cols-[1fr_300px]"}`}>
        <div className="min-w-0 space-y-5">
          <Composer session={session} />
          <History session={session} posts={posts} />
        </div>
        {!focus && <SidePanel session={session} />}
      </main>
    </div>
  );
}

/* ───────────────────────── 실시간 공유하기 ───────────────────────── */

const TAB_HINT: Record<PostType, { title: string; content: string }> = {
  link: { title: "제목 (선택 · 비우면 주소로 표시)", content: "https://" },
  prompt: { title: "제목 (선택) 예: 수업 지도안 작성 프롬프트", content: "여러 줄 프롬프트를 붙여넣으세요. 줄바꿈과 특수문자가 그대로 전달됩니다." },
  notice: { title: "예: 지금부터 5분간 이미지 만들기 실습", content: "추가 안내 (선택)" },
};

function Composer({ session }: { session: InstructorSession }) {
  const { api } = useAuth();
  const [type, setType] = useState<PostType>("link");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const contentRef = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const allowed = canPost(session.status);

  useEffect(() => {
    if (msg?.kind !== "ok") return;
    const t = setTimeout(() => setMsg(null), 4000);
    return () => clearTimeout(t);
  }, [msg]);

  async function share() {
    if (busy || !allowed) return;
    setBusy(true);
    setMsg(null);
    try {
      await api(`/api/instructor/sessions/${session.id}/posts`, { method: "POST", body: { type, title, content } });
      setTitle("");
      setContent("");
      setMsg({ kind: "ok", text: "참여자들에게 즉시 전달되었습니다!" });
      contentRef.current?.focus();
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      share();
    }
  };

  const shareBtn = (
    <button type="submit" disabled={busy || !allowed} className={`${btn.primary} shrink-0 px-6 py-3 text-base`}>
      {busy ? "공유 중…" : "공유하기"}
    </button>
  );

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="composer-h">
      <h2 id="composer-h" className="mb-4 text-lg font-extrabold">
        실시간 공유하기
      </h2>
      <div role="tablist" aria-label="자료 유형" className="mb-4 grid grid-cols-3 gap-2">
        {(["link", "prompt", "notice"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={type === t}
            onClick={() => {
              setType(t);
              setMsg(null);
            }}
            className={`rounded-xl py-2.5 text-sm font-bold transition ${
              type === t ? "bg-brand-400 text-cocoa-900 shadow-[0_4px_12px_-4px_rgb(246_176_11/0.55)]" : "bg-canvas text-cocoa-700 hover:bg-brand-100"
            }`}
          >
            {TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          share();
        }}
        onKeyDown={onKeyDown}
        className="space-y-3"
      >
        {type === "link" ? (
          <>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span aria-hidden className="absolute left-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full bg-brand-100 text-sm">
                  🔗
                </span>
                <input
                  ref={contentRef}
                  className={`${inputCls} py-3 pl-12`}
                  type="url"
                  aria-label="링크 주소"
                  placeholder={TAB_HINT.link.content}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  autoFocus
                />
              </div>
              {shareBtn}
            </div>
            <input className={inputCls} aria-label="제목" placeholder={TAB_HINT.link.title} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </>
        ) : (
          <>
            <input className={inputCls} aria-label="제목" placeholder={TAB_HINT[type].title} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
            <textarea
              ref={contentRef}
              className={`${inputCls} ${type === "prompt" ? "font-mono text-sm" : ""}`}
              aria-label="내용"
              rows={type === "prompt" ? 7 : 3}
              placeholder={TAB_HINT[type].content}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end">{shareBtn}</div>
          </>
        )}

        <div aria-live="polite">
          {!allowed ? (
            <p className="rounded-xl bg-stone-100 px-4 py-3 text-center text-sm font-semibold text-stone-600">
              종료된 강의입니다. 위의 ‘강의 다시 열기’를 누르면 공유할 수 있어요.
            </p>
          ) : msg ? (
            <p
              className={`animate-bloom rounded-xl px-4 py-3 text-center text-sm font-bold ${
                msg.kind === "ok" ? "bg-brand-100 text-brand-700" : "bg-bloom-50 text-bloom-600"
              }`}
            >
              {msg.kind === "ok" ? "✓ " : ""}
              {msg.text}
            </p>
          ) : (
            <p className="text-right text-xs text-ink-muted">
              <kbd className="rounded border border-line bg-canvas px-1.5 py-0.5 font-sans">Ctrl</kbd> +{" "}
              <kbd className="rounded border border-line bg-canvas px-1.5 py-0.5 font-sans">Enter</kbd> 로 바로 공유
            </p>
          )}
        </div>
      </form>
    </section>
  );
}

/* ───────────────────────── 공유된 자료 ───────────────────────── */

function History({ session, posts }: { session: InstructorSession; posts: Post[] | null }) {
  const now = useMinuteTick();
  const sorted = posts ? sortPosts(posts) : null;
  const drafts = sorted?.filter((p) => !p.published).length ?? 0;
  return (
    <section className="card p-5 sm:p-6" aria-labelledby="history-h">
      <div className="mb-2 flex items-baseline gap-2">
        <h2 id="history-h" className="text-lg font-extrabold">
          공유된 자료
        </h2>
        {sorted && (
          <span className="text-sm text-ink-muted">
            {sorted.length}개{drafts ? ` · 비공개 초안 ${drafts}개` : ""}
          </span>
        )}
      </div>
      {sorted === null ? (
        <div className="h-24 animate-pulse rounded-2xl bg-brand-100/50" />
      ) : sorted.length === 0 ? (
        <p className="py-8 text-center text-ink-muted">아직 공유한 자료가 없습니다.</p>
      ) : (
        <ul className="divide-y divide-line">
          {sorted.map((p) => (
            <HistoryItem key={p.id} post={p} sessionId={session.id} now={now} />
          ))}
        </ul>
      )}
    </section>
  );
}

function HistoryItem({ post, sessionId, now }: { post: Post; sessionId: string; now: number }) {
  const { api } = useAuth();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const path = `/api/instructor/sessions/${sessionId}/posts/${post.id}`;

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setErr(null);
    try {
      await api(path, { method: "PATCH", body });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className={`py-3 ${post.published ? "" : "opacity-80"}`}>
      <div className="flex items-center gap-3">
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-100 text-base">
          {TYPE_ICON[post.type]}
        </span>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="min-w-0 flex-1 text-left">
          <span className="block truncate font-bold">{displayTitle(post)}</span>
        </button>
        <span className="hidden shrink-0 rounded-md bg-brand-100 px-2 py-0.5 text-xs font-bold text-cocoa-700 sm:inline">{TYPE_LABEL[post.type]}</span>
        {!post.published && <span className="shrink-0 rounded-md bg-stone-100 px-2 py-0.5 text-xs font-bold text-stone-600">비공개</span>}
        <time className="w-14 shrink-0 text-right text-xs text-ink-muted">{post.pending ? "게시 중" : relativeTime(post.createdAtMs, now)}</time>
        <button
          type="button"
          className={`grid size-8 shrink-0 place-items-center rounded-lg transition hover:bg-brand-50 ${post.isPinned ? "" : "opacity-30 grayscale hover:opacity-70"}`}
          disabled={busy}
          onClick={() => patch({ isPinned: !post.isPinned })}
          aria-pressed={post.isPinned}
          aria-label={post.isPinned ? "고정 해제" : "상단 고정"}
          title={post.isPinned ? "고정 해제" : "상단 고정"}
        >
          📌
        </button>
      </div>

      {open && (
        <div className="ml-12 mt-2 space-y-2">
          {post.type === "link" ? (
            isSafeHttpUrl(post.content) && (
              <a href={post.content} target="_blank" rel="noopener noreferrer" className="block truncate text-sm text-brand-700 underline-offset-2 hover:underline">
                {post.content}
              </a>
            )
          ) : (
            post.content && <p className="max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-canvas p-3 text-sm text-ink-muted">{post.content}</p>
          )}
        </div>
      )}

      <div className="ml-12 mt-1 flex flex-wrap gap-0.5">
        {!post.published && (
          <button type="button" className={`${btn.primary} px-3 py-1 text-xs`} disabled={busy} onClick={() => patch({ published: true })}>
            지금 공개
          </button>
        )}
        <button type="button" className={`${btn.ghost} px-2 py-0.5 text-xs`} disabled={busy} onClick={() => setEditing(true)}>
          수정
        </button>
        {post.published && (
          <button type="button" className={`${btn.ghost} px-2 py-0.5 text-xs`} disabled={busy} onClick={() => patch({ published: false })}>
            숨기기
          </button>
        )}
        <button
          type="button"
          className={`${btn.danger} px-2 py-0.5 text-xs`}
          disabled={busy}
          onClick={async () => {
            if (!confirm(`"${displayTitle(post)}" 을(를) 삭제할까요?\n참여자 화면에서도 즉시 사라집니다.`)) return;
            setBusy(true);
            try {
              await api(path, { method: "DELETE" });
            } catch (e) {
              setErr((e as Error).message);
              setBusy(false);
            }
          }}
        >
          삭제
        </button>
      </div>
      {err && <p role="alert" className="ml-12 mt-1 text-sm text-bloom-600">{err}</p>}
      <EditPostModal
        open={editing}
        onClose={() => setEditing(false)}
        post={post}
        onSave={async (b) => {
          await api(path, { method: "PATCH", body: b });
        }}
      />
    </li>
  );
}

function EditPostModal({
  open,
  onClose,
  post,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  post: Post;
  onSave: (body: { title: string; content: string }) => Promise<void>;
}) {
  const [title, setTitle] = useState(post.title);
  const [content, setContent] = useState(post.content);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle(post.title);
      setContent(post.content);
      setErr(null);
    }
  }, [open, post.title, post.content]);

  return (
    <Modal open={open} onClose={onClose} title={`${TYPE_LABEL[post.type]} 수정`}>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr(null);
          try {
            await onSave({ title, content });
            onClose();
          } catch (e) {
            setErr((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <input className={inputCls} aria-label="제목" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="제목" />
        {post.type === "link" ? (
          <input className={inputCls} type="url" aria-label="링크 주소" value={content} onChange={(e) => setContent(e.target.value)} />
        ) : (
          <textarea
            className={`${inputCls} ${post.type === "prompt" ? "font-mono text-sm" : ""}`}
            aria-label="내용"
            rows={post.type === "prompt" ? 10 : 4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        )}
        {err && <p role="alert" className="text-sm text-bloom-600">{err}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className={btn.secondary} onClick={onClose}>
            취소
          </button>
          <button type="submit" className={btn.primary} disabled={busy}>
            {busy ? "저장 중…" : "저장"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ───────────────────────── 참여 방법 · 강의 정보 ───────────────────────── */

function SidePanel({ session }: { session: InstructorSession }) {
  const { api } = useAuth();
  const link = directLink(session.publicToken);
  const [qrOpen, setQrOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [driveUrl, setDriveUrl] = useState(session.driveUrl ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => setDriveUrl(session.driveUrl ?? ""), [session.driveUrl]);

  async function run(label: string, fn: () => Promise<unknown>, okText?: string) {
    setBusy(label);
    setMsg(null);
    try {
      await fn();
      if (okText) setMsg({ kind: "ok", text: okText });
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }
  const patchSession = (body: Record<string, unknown>) => api(`/api/instructor/sessions/${session.id}`, { method: "PATCH", body });

  return (
    <aside className="space-y-4">
      <section className="card p-5">
        <h2 className="mb-3 text-lg font-extrabold">참여 방법</h2>
        <div className="mb-4 rounded-2xl bg-brand-100 py-3 text-center">
          <p className="text-xs font-semibold text-cocoa-700">입장 코드</p>
          <p className="font-mono text-4xl font-extrabold tracking-wider text-cocoa-900">{formatJoinCode(session.joinCode)}</p>
        </div>
        <div className="space-y-2">
          <CopyButton text={link} label="🔗 강의 링크 복사" className={`${btn.secondary} w-full py-2.5`} />
          <button type="button" className={`${btn.secondary} w-full py-2.5`} onClick={() => setQrOpen(true)}>
            ▦ QR코드 보기
          </button>
          <button
            type="button"
            className={`${btn.ghost} w-full`}
            disabled={!!busy}
            onClick={() => {
              if (!confirm("새 입장 코드를 발급할까요?\n이전 코드는 즉시 사용할 수 없게 됩니다. (직접 링크는 그대로 유지)")) return;
              run("code", () => api(`/api/instructor/sessions/${session.id}/regenerate-code`, { method: "POST" }), "새 코드를 발급했습니다.");
            }}
          >
            {busy === "code" ? "발급 중…" : "↻ 입장 코드 재발급"}
          </button>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-1 text-lg font-extrabold">📁 기본 자료</h2>
        <p className="mb-3 text-xs text-ink-muted">구글 드라이브 링크 · 참여자 화면 맨 위에 고정</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run("drive", () => patchSession({ driveUrl }), driveUrl ? "드라이브 링크를 저장했습니다." : "드라이브 링크를 지웠습니다.");
          }}
          className="space-y-2"
        >
          <input className={inputCls} type="url" value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)} placeholder="https://drive.google.com/…" aria-label="구글 드라이브 링크" />
          <button type="submit" className={`${btn.secondary} w-full`} disabled={!!busy || driveUrl === (session.driveUrl ?? "")}>
            {busy === "drive" ? "저장 중…" : "저장"}
          </button>
        </form>
      </section>

      <section className="card p-5">
        <h2 className="mb-3 text-lg font-extrabold">강의 정보</h2>
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <span aria-hidden>📅</span> {dateLabel(session.createdAtMs)} 생성
        </p>
        {session.description && <p className="mb-3 whitespace-pre-wrap text-sm text-ink-muted">{session.description}</p>}
        <div className="space-y-2">
          <button type="button" className={`${btn.ghost} w-full`} onClick={() => setSettingsOpen(true)}>
            제목·설명 수정
          </button>
          <label className="flex cursor-pointer items-start gap-2 py-1 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-brand-600"
              checked={session.readableAfterEnd}
              disabled={!!busy}
              onChange={(e) => run("status", () => patchSession({ readableAfterEnd: e.target.checked }))}
            />
            <span>
              종료 후에도 자료 열람 허용
              <span className="block text-xs text-ink-muted">끄면 강의 종료 시 참여자 접근이 막힙니다.</span>
            </span>
          </label>
          {session.status !== "closed" ? (
            <button
              type="button"
              className={`${btn.danger} w-full`}
              disabled={!!busy}
              onClick={() => {
                if (!confirm("참여자 접근을 차단할까요?\n코드·링크로 더 이상 볼 수 없게 됩니다. (나중에 다시 열 수 있음)")) return;
                run("status", () => patchSession({ status: "closed" }), "참여자 접근을 차단했습니다.");
              }}
            >
              참여자 접근 차단
            </button>
          ) : (
            <div className="space-y-2">
              <p className="rounded-xl bg-bloom-50 px-3 py-2 text-sm font-semibold text-bloom-600">참여자 접근이 차단된 상태입니다.</p>
              <button type="button" className={`${btn.secondary} w-full`} disabled={!!busy} onClick={() => run("status", () => patchSession({ status: "ended" }), "차단을 해제했습니다 (종료 상태).")}>
                차단 해제
              </button>
            </div>
          )}
        </div>
      </section>

      {msg && (
        <p role="status" className={`rounded-xl px-3 py-2 text-sm font-semibold ${msg.kind === "ok" ? "bg-brand-100 text-brand-700" : "bg-bloom-50 text-bloom-600"}`}>
          {msg.text}
        </p>
      )}

      <p className="px-2 text-xs leading-relaxed text-ink-muted">코드나 링크를 아는 사람은 누구나 볼 수 있습니다. 개인정보나 비공개 자료는 올리지 마세요.</p>

      <Modal open={qrOpen} onClose={() => setQrOpen(false)} title="참여 QR코드">
        <div className="flex flex-col items-center gap-3">
          <QrImage value={link} size={280} />
          <p className="break-all text-center text-sm text-ink-muted">{link}</p>
        </div>
      </Modal>
      <SessionSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} session={session} onSave={patchSession} />
    </aside>
  );
}

function SessionSettingsModal({
  open,
  onClose,
  session,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  session: InstructorSession;
  onSave: (b: Record<string, unknown>) => Promise<unknown>;
}) {
  const [title, setTitle] = useState(session.title);
  const [description, setDescription] = useState(session.description);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setTitle(session.title);
      setDescription(session.description);
      setErr(null);
    }
  }, [open, session.title, session.description]);
  return (
    <Modal open={open} onClose={onClose} title="강의 정보 수정">
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await onSave({ title, description });
            onClose();
          } catch (e) {
            setErr((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} aria-label="강의 제목" maxLength={200} required />
        <textarea className={inputCls} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} aria-label="설명" maxLength={1000} placeholder="설명 (선택) 예: 14:00 ~ 16:00" />
        {err && <p role="alert" className="text-sm text-bloom-600">{err}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className={btn.secondary} onClick={onClose}>
            취소
          </button>
          <button type="submit" className={btn.primary} disabled={busy || !title.trim()}>
            저장
          </button>
        </div>
      </form>
    </Modal>
  );
}
