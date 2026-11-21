"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { STATUS_LABEL, type SessionStatus } from "@/lib/shared";

export function Logo({ size = "md", href = "/" }: { size?: "md" | "lg"; href?: string | null }) {
  // 브랜드 로고 파일이 들어오면 이 컴포넌트만 교체
  const inner = (
    <span className={`inline-flex items-center gap-2 font-extrabold tracking-tight ${size === "lg" ? "text-3xl" : "text-lg"}`}>
      <span aria-hidden className={`grid place-items-center rounded-xl bg-brand-500 text-white ${size === "lg" ? "size-11 text-2xl" : "size-8 text-base"}`}>
        ✿
      </span>
      <span>
        링크<span className="text-brand-600">피움</span>
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
    draft: "bg-gray-100 text-gray-700",
    live: "bg-brand-100 text-brand-700",
    ended: "bg-amber-100 text-amber-800",
    closed: "bg-red-100 text-red-700",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls[status]}`}>
      {status === "live" && <span className="size-1.5 rounded-full bg-brand-500" aria-hidden />}
      {STATUS_LABEL[status]}
    </span>
  );
}

const btnBase =
  "inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

export const btn = {
  primary: `${btnBase} bg-brand-500 text-white hover:bg-brand-600 px-4 py-2.5`,
  secondary: `${btnBase} border border-line bg-surface text-ink hover:bg-brand-50 px-3.5 py-2`,
  ghost: `${btnBase} text-ink-muted hover:bg-black/5 hover:text-ink px-2.5 py-1.5 text-sm`,
  danger: `${btnBase} text-red-700 hover:bg-red-50 px-2.5 py-1.5 text-sm`,
};

export const inputCls =
  "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-base outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200";

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
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <h1 className="text-xl font-bold">{title}</h1>
        {body && <div className="mt-2 text-ink-muted">{body}</div>}
        {action && <div className="mt-6">{action}</div>}
      </div>
    </main>
  );
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
