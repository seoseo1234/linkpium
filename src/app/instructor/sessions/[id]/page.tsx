"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { User } from "firebase/auth";
import { useAuth } from "@/components/AuthProvider";
import { InstructorGate } from "@/components/InstructorGate";
import { CopyButton, FullMessage, Logo, Modal, QrImage, StatusBadge, btn, inputCls, timeLabel } from "@/components/ui";
import { directLink } from "@/lib/firebase-client";
import { useInstructorPosts, useInstructorSession, type InstructorSession, type Post } from "@/lib/realtime";
import { TYPE_LABEL, canPost, displayTitle, formatJoinCode, isSafeHttpUrl, sortPosts, type PostType } from "@/lib/shared";

/** S03 강사 공유 보드 */
export default function InstructorBoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <InstructorGate>{(user) => <InstructorBoard id={id} user={user} />}</InstructorGate>;
}

function InstructorBoard({ id, user }: { id: string; user: User }) {
  const { session, error } = useInstructorSession(id, user.uid);
  const posts = useInstructorPosts(session?.publicToken);
  const [focus, setFocus] = useState(false);

  useEffect(() => {
    if (session) document.title = `${session.title} · 강사 · 링크피움`;
  }, [session]);

  if (error)
    return <FullMessage title={error} action={<Link className={btn.secondary} href="/dashboard">내 강의 목록</Link>} />;
  if (!session) return <FullMessage title="불러오는 중…" />;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
          {!focus && <Logo href="/dashboard" />}
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <StatusBadge status={session.status} />
            <h1 className="truncate text-lg font-bold">{session.title}</h1>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-canvas px-3 py-1.5">
            <span className="text-xs text-ink-muted">입장 코드</span>
            <strong className="font-mono text-xl tracking-wider">{formatJoinCode(session.joinCode)}</strong>
          </div>
          <Link href={`/instructor/sessions/${id}/join`} target="_blank" className={btn.secondary}>
            🖥 입장 안내 화면
          </Link>
          <button type="button" className={btn.ghost} onClick={() => setFocus((f) => !f)} aria-pressed={focus}>
            {focus ? "집중 모드 끄기" : "집중 모드"}
          </button>
        </div>
      </header>

      <main className={`mx-auto grid max-w-6xl gap-6 px-5 py-6 ${focus ? "" : "lg:grid-cols-[1fr_320px]"}`}>
        <div className="min-w-0 space-y-6">
          <Composer session={session} />
          <History session={session} posts={posts} />
        </div>
        {!focus && <SidePanel session={session} />}
      </main>
    </div>
  );
}

/* ───────────────────────── 자료 등록 ───────────────────────── */

const TAB_HINT: Record<PostType, { title: string; content: string }> = {
  link: { title: "예: 이미지 생성 사이트 (비우면 주소로 표시)", content: "https://" },
  prompt: { title: "예: 수업 지도안 작성 프롬프트 (선택)", content: "여러 줄 프롬프트를 붙여넣으세요. 줄바꿈과 특수문자가 그대로 전달됩니다." },
  notice: { title: "예: 지금부터 5분간 이미지 만들기 실습", content: "추가 안내 (선택)" },
};

function Composer({ session }: { session: InstructorSession }) {
  const { api } = useAuth();
  const [type, setType] = useState<PostType>("prompt");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const contentRef = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const allowed = canPost(session.status);

  useEffect(() => {
    if (msg?.kind !== "ok") return;
    const t = setTimeout(() => setMsg(null), 3000);
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
      setMsg({ kind: "ok", text: `✓ ${TYPE_LABEL[type]}을(를) 공유했습니다. 참여자 화면에 바로 나타납니다.` });
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

  return (
    <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm" aria-labelledby="composer-h">
      <h2 id="composer-h" className="sr-only">
        자료 등록
      </h2>
      <div role="tablist" aria-label="자료 유형" className="mb-4 inline-flex rounded-2xl bg-canvas p-1">
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
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${type === t ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink"}`}
          >
            {t === "link" ? "🔗 " : t === "prompt" ? "✨ " : "📢 "}
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
            <input
              ref={contentRef}
              className={inputCls}
              type="url"
              aria-label="링크 주소"
              placeholder={TAB_HINT.link.content}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              autoFocus
            />
            <input className={inputCls} aria-label="제목" placeholder={TAB_HINT.link.title} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </>
        ) : (
          <>
            <input className={inputCls} aria-label="제목" placeholder={TAB_HINT[type].title} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
            <textarea
              ref={contentRef}
              className={`${inputCls} ${type === "prompt" ? "font-mono text-sm" : ""}`}
              aria-label="내용"
              rows={type === "prompt" ? 8 : 3}
              placeholder={TAB_HINT[type].content}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              autoFocus
            />
          </>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy || !allowed} className={`${btn.primary} px-7 py-3.5 text-lg shadow-md shadow-brand-500/20`}>
            {busy ? "공유 중…" : "지금 공유하기"}
          </button>
          <kbd className="hidden text-xs text-ink-muted sm:inline">Ctrl + Enter</kbd>
          <span aria-live="polite" className={`text-sm font-medium ${msg?.kind === "err" ? "text-red-700" : "text-brand-700"}`}>
            {!allowed ? "종료된 강의입니다. 오른쪽 설정에서 강의를 다시 열면 공유할 수 있어요." : msg?.text}
          </span>
        </div>
      </form>
    </section>
  );
}

/* ───────────────────────── 공유 기록 ───────────────────────── */

function History({ session, posts }: { session: InstructorSession; posts: Post[] | null }) {
  const sorted = posts ? sortPosts(posts) : null;
  const drafts = sorted?.filter((p) => !p.published).length ?? 0;
  return (
    <section aria-labelledby="history-h">
      <div className="mb-3 flex items-baseline gap-2">
        <h2 id="history-h" className="text-lg font-bold">
          공유 기록
        </h2>
        {sorted && <span className="text-sm text-ink-muted">{sorted.length}개{drafts ? ` · 비공개 초안 ${drafts}개` : ""}</span>}
      </div>
      {sorted === null ? (
        <div className="h-24 animate-pulse rounded-2xl bg-black/5" />
      ) : sorted.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-line p-8 text-center text-ink-muted">아직 공유한 자료가 없습니다.</p>
      ) : (
        <ul className="space-y-3">
          {sorted.map((p) => (
            <HistoryItem key={p.id} post={p} sessionId={session.id} />
          ))}
        </ul>
      )}
    </section>
  );
}

function HistoryItem({ post, sessionId }: { post: Post; sessionId: string }) {
  const { api } = useAuth();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
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
    <li className={`rounded-2xl border bg-surface p-4 ${post.published ? "border-line" : "border-dashed border-amber-300 bg-amber-50/40"}`}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-canvas px-2 py-0.5 font-semibold">{TYPE_LABEL[post.type]}</span>
        {post.isPinned && <span className="font-semibold text-brand-700">📌 고정</span>}
        {!post.published && <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">비공개 초안</span>}
        <time className="text-ink-muted">{post.pending ? "게시 중…" : timeLabel(post.createdAtMs)}</time>
        <div className="ml-auto flex flex-wrap gap-0.5">
          {!post.published && (
            <button type="button" className={`${btn.primary} px-3 py-1 text-xs`} disabled={busy} onClick={() => patch({ published: true })}>
              지금 공개
            </button>
          )}
          <button type="button" className={btn.ghost} disabled={busy} onClick={() => patch({ isPinned: !post.isPinned })}>
            {post.isPinned ? "고정 해제" : "고정"}
          </button>
          <button type="button" className={btn.ghost} disabled={busy} onClick={() => setEditing(true)}>
            수정
          </button>
          {post.published && (
            <button type="button" className={btn.ghost} disabled={busy} onClick={() => patch({ published: false })}>
              숨기기
            </button>
          )}
          <button
            type="button"
            className={btn.danger}
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
      </div>
      <p className="mt-1.5 font-semibold">{displayTitle(post)}</p>
      {post.type === "link" ? (
        isSafeHttpUrl(post.content) ? (
          <a href={post.content} target="_blank" rel="noopener noreferrer" className="block truncate text-sm text-sky-700 underline-offset-2 hover:underline">
            {post.content}
          </a>
        ) : null
      ) : (
        post.content && <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-ink-muted">{post.content}</p>
      )}
      {err && <p role="alert" className="mt-2 text-sm text-red-700">{err}</p>}
      <EditPostModal open={editing} onClose={() => setEditing(false)} post={post} onSave={async (b) => { await api(path, { method: "PATCH", body: b }); }} />
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
        {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
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

/* ───────────────────────── 접속 정보 · 설정 ───────────────────────── */

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
      <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm">
        <h2 className="mb-3 font-bold">참여 방법</h2>
        <div className="space-y-2">
          <CopyButton text={link} label="🔗 참여자용 직접 링크 복사" className={`${btn.secondary} w-full`} />
          <CopyButton text={session.joinCode} label="🔢 입장 코드 복사" className={`${btn.secondary} w-full`} />
          <button type="button" className={`${btn.secondary} w-full`} onClick={() => setQrOpen(true)}>
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

      <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm">
        <h2 className="mb-1 font-bold">📁 기본 자료 (구글 드라이브)</h2>
        <p className="mb-3 text-xs text-ink-muted">참여자 화면 맨 위에 항상 고정됩니다.</p>
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

      <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm">
        <h2 className="mb-3 font-bold">강의 상태</h2>
        <div className="space-y-2">
          {session.status === "live" || session.status === "draft" ? (
            <button
              type="button"
              className={`${btn.secondary} w-full`}
              disabled={!!busy}
              onClick={() => {
                if (!confirm("강의를 종료할까요?\n참여자는 기존 자료를 계속 읽을 수 있고, 새 자료는 올릴 수 없습니다.")) return;
                run("status", () => patchSession({ status: "ended" }), "강의를 종료했습니다.");
              }}
            >
              강의 종료
            </button>
          ) : (
            <button type="button" className={`${btn.secondary} w-full`} disabled={!!busy} onClick={() => run("status", () => patchSession({ status: "live" }), "강의를 다시 열었습니다.")}>
              강의 다시 열기
            </button>
          )}
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
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">참여자 접근이 차단된 상태입니다.</p>
          )}
          <label className="flex cursor-pointer items-start gap-2 pt-1 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-brand-500"
              checked={session.readableAfterEnd}
              disabled={!!busy}
              onChange={(e) => run("status", () => patchSession({ readableAfterEnd: e.target.checked }))}
            />
            <span>
              종료 후에도 참여자가 자료 열람 가능
              <span className="block text-xs text-ink-muted">끄면 강의 종료 시 참여자 접근이 막힙니다.</span>
            </span>
          </label>
          <button type="button" className={`${btn.ghost} w-full`} onClick={() => setSettingsOpen(true)}>
            제목·설명 수정
          </button>
        </div>
      </section>

      {msg && (
        <p role="status" className={`rounded-xl px-3 py-2 text-sm ${msg.kind === "ok" ? "bg-brand-50 text-brand-700" : "bg-red-50 text-red-700"}`}>
          {msg.text}
        </p>
      )}

      <p className="px-2 text-xs leading-relaxed text-ink-muted">
        코드나 링크를 아는 사람은 누구나 볼 수 있습니다. 개인정보나 비공개 자료는 올리지 마세요.
      </p>

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
        <textarea className={inputCls} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} aria-label="설명" maxLength={1000} placeholder="설명 (선택)" />
        {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
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
