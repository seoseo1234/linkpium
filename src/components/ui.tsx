"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { STATUS_LABEL, type SessionStatus } from "@/lib/shared";

/** 시안의 새싹 심볼 */
export function Sprout({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <path d="M31 58c0-12 .5-22 1-30" stroke="#3f8f2a" strokeWidth="4.5" strokeLinecap="round" fill="none" />
      <path d="M31.5 30C30 17 20 9 5 11c1 14 11 22 26.5 19z" fill="#5cb83a" />
      <path d="M31.5 30C30 17 20 9 5 11c9 3 18 10 26.5 19z" fill="#43982a" />
      <path d="M32.5 28C34 15 44 7 59 9c-1 14-11 22-26.5 19z" fill="#7ccf4f" />
      <path d="M32.5 28C34 15 44 7 59 9c-9 3-18 10-26.5 19z" fill="#5cb83a" />
    </svg>
  );
}

export function Logo({ size = "md", href = "/", stacked = false }: { size?: "md" | "lg" | "xl"; href?: string | null; stacked?: boolean }) {
  const sym = { md: "size-8", lg: "size-11", xl: "size-20" }[size];
  const word = { md: "text-lg", lg: "text-2xl", xl: "text-5xl" }[size];
  const sub = { md: "text-[10px]", lg: "text-xs", xl: "text-xl" }[size];
  const inner = (
    <span className={`inline-flex items-center font-extrabold tracking-tight text-cocoa-900 ${stacked ? "flex-col gap-0.5" : "gap-2"}`}>
      <Sprout className={sym} />
      <span className={`flex flex-col leading-none ${stacked ? "items-center" : ""}`}>
        <span className={word}>링크피움</span>
        <span className={`${sub} mt-0.5 font-semibold text-cocoa-700`}>(LinkPium)</span>
      </span>
    </span>
  );
  return href ? (
    <Link href={href} className="rounded-lg" aria-label="링크피움 홈">
      {inner}
    </Link>
  ) : (
    inner
  );
}

export function StatusBadge({ status }: { status: SessionStatus }) {
  const cls: Record<SessionStatus, string> = {
    draft: "bg-stone-100 text-stone-600",
    live: "bg-brand-300 text-cocoa-900",
    ended: "bg-stone-100 text-stone-600",
    closed: "bg-bloom-50 text-bloom-600",
  };
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${cls[status]}`}>
      {status === "live" && <span className="size-1.5 rounded-full bg-sprout-600" aria-hidden />}
      {STATUS_LABEL[status]}
    </span>
  );
}

const btnBase =
  "inline-flex items-center justify-center gap-1.5 rounded-xl font-bold transition disabled:cursor-not-allowed disabled:opacity-50";

export const btn = {
  primary: `${btnBase} bg-brand-400 text-cocoa-900 shadow-[0_4px_12px_-4px_rgb(246_176_11/0.55)] hover:bg-brand-500 px-4 py-2.5`,
  secondary: `${btnBase} border border-brand-200 bg-surface text-cocoa-700 hover:bg-brand-50 px-3.5 py-2`,
  ghost: `${btnBase} font-semibold text-ink-muted hover:bg-brand-50 hover:text-cocoa-900 px-2.5 py-1.5 text-sm`,
  danger: `${btnBase} font-semibold text-bloom-600 hover:bg-bloom-50 px-2.5 py-1.5 text-sm`,
  stop: `${btnBase} bg-bloom-500 text-white hover:bg-bloom-600 px-4 py-2`,
};

export const inputCls =
  "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-base outline-none transition placeholder:text-ink-muted/60 focus:border-brand-500 focus:ring-2 focus:ring-brand-200";

/** 클립보드 복사. 실패하면 대상 요소의 텍스트를 선택해 수동 복사를 돕는다 */
export async function copyText(text: string, fallbackEl?: HTMLElement | null): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 아래 대체 경로 */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const okay = document.execCommand("copy");
    document.body.removeChild(ta);
    if (okay) return true;
  } catch {
    /* 아래 수동 선택 */
  }
  if (fallbackEl) {
    const range = document.createRange();
    range.selectNodeContents(fallbackEl);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }
  return false;
}

export function CopyButton({
  text,
  label,
  className = btn.secondary,
  fallbackRef,
}: {
  text: string;
  label: ReactNode;
  className?: string;
  fallbackRef?: React.RefObject<HTMLElement | null>;
}) {
  const [state, setState] = useState<"idle" | "done" | "fail">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        const okay = await copyText(text, fallbackRef?.current);
        setState(okay ? "done" : "fail");
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setState("idle"), 2500);
      }}
    >
      <span aria-live="polite">
        {state === "done" ? "✓ 복사됨" : state === "fail" ? "선택됨 — Ctrl+C 로 복사하세요" : label}
      </span>
    </button>
  );
}

export function QrImage({ value, size = 240, className }: { value: string; size?: number; className?: string }) {
  const [src, setSrc] = useState<string>("");
  useEffect(() => {
    if (!value) return;
    QRCode.toDataURL(value, { width: size * 2, margin: 1, errorCorrectionLevel: "M" })
      .then(setSrc)
      .catch(() => setSrc(""));
  }, [value, size]);
  if (!src) return <div style={{ width: size, height: size }} className={`animate-pulse rounded-lg bg-black/5 ${className ?? ""}`} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} width={size} height={size} alt="참여 링크 QR코드" className={className} />;
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[min(92vw,520px)] rounded-2xl bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/40"
    >
      <div className="p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" className={btn.ghost} onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

export function FullMessage({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <main className="warm-blobs grid min-h-dvh place-items-center p-6">
      <div className="max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <Logo size="lg" stacked />
        </div>
        <h1 className="text-xl font-bold">{title}</h1>
        {body && <div className="mt-2 text-ink-muted">{body}</div>}
        {action && <div className="mt-6">{action}</div>}
      </div>
    </main>
  );
}

/** "방금 전", "2분 전", "3시간 전", 그 이상은 날짜 */
export function relativeTime(ms: number | null, now = Date.now()): string {
  if (!ms) return "방금 전";
  const sec = Math.max(0, Math.round((now - ms) / 1000));
  if (sec < 60) return "방금 전";
  if (sec < 3600) return `${Math.floor(sec / 60)}분 전`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}시간 전`;
  return timeLabel(ms);
}

/** 1분마다 다시 그려 상대 시간을 갱신 */
export function useMinuteTick(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export function dateLabel(ms: number | null): string {
  if (!ms) return "";
  return new Date(ms).toLocaleDateString("ko-KR", { year: "numeric", month: "numeric", day: "numeric", weekday: "short" });
}

export function timeLabel(ms: number | null): string {
  if (!ms) return "방금";
  const d = new Date(ms);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" })
    : d.toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
