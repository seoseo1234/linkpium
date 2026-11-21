"use client";

import { useRef, useState } from "react";
import { CopyButton, btn, timeLabel } from "./ui";
import { TYPE_LABEL, displayTitle, isSafeHttpUrl } from "@/lib/shared";
import type { Post } from "@/lib/realtime";

const TYPE_STYLE = {
  link: { icon: "🔗", chip: "bg-brand-100 text-cocoa-700", bar: "border-l-brand-400" },
  prompt: { icon: "✨", chip: "bg-sprout-100 text-sprout-700", bar: "border-l-sprout-500" },
  notice: { icon: "📢", chip: "bg-bloom-50 text-bloom-600", bar: "border-l-bloom-400" },
} as const;

const LONG_PROMPT = 700;

/** 참여자용 게시물 카드 */
export function PostCard({ post, isNew }: { post: Post; isNew?: boolean }) {
  const s = TYPE_STYLE[post.type];
  const title = displayTitle(post);
  const preRef = useRef<HTMLPreElement>(null);
  const [expanded, setExpanded] = useState(false);
  const isLong = post.type === "prompt" && post.content.length > LONG_PROMPT;

  return (
    <article
      className={`card border-l-4 ${s.bar} p-5 ${isNew ? "animate-bloom ring-2 ring-brand-300" : ""}`}
      aria-label={`${TYPE_LABEL[post.type]}: ${title}`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-full px-2 py-0.5 font-semibold ${s.chip}`}>
          <span aria-hidden>{s.icon}</span> {TYPE_LABEL[post.type]}
        </span>
        {post.isPinned && <span className="rounded-full bg-brand-300 px-2 py-0.5 font-bold text-cocoa-900">📌 고정</span>}
        {isNew && <span className="rounded-full bg-bloom-500 px-2 py-0.5 font-bold text-white">NEW</span>}
        <time className="ml-auto text-ink-muted">{timeLabel(post.createdAtMs)}</time>
      </div>

      <h3 className="text-lg font-bold leading-snug">{title}</h3>

      {post.type === "link" &&
        (isSafeHttpUrl(post.content) ? (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <a href={post.content} target="_blank" rel="noopener noreferrer nofollow" className={`${btn.primary} py-2.5`}>
              사이트 열기 <span aria-hidden>↗</span>
              <span className="sr-only">(새 탭)</span>
            </a>
            <span className="min-w-0 flex-1 truncate text-sm text-ink-muted" title={post.content}>
              {post.content}
            </span>
            <CopyButton text={post.content} label="주소 복사" className={btn.ghost} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-bloom-600">열 수 없는 주소입니다.</p>
        ))}

      {post.type === "prompt" && (
        <>
          <div className="relative mt-3">
            <pre
              ref={preRef}
              className={`overflow-x-auto whitespace-pre-wrap rounded-xl bg-brand-50 p-4 font-mono text-sm leading-relaxed select-all sm:select-text ${
                isLong && !expanded ? "max-h-64 overflow-hidden" : ""
              }`}
            >
              {post.content}
            </pre>
            {isLong && !expanded && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 rounded-b-xl bg-gradient-to-t from-brand-50" />
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <CopyButton text={post.content} label="📋 프롬프트 전체 복사" className={`${btn.primary} py-2.5`} fallbackRef={preRef} />
            {isLong && (
              <button type="button" className={btn.ghost} onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
                {expanded ? "접기" : "전체 보기"}
              </button>
            )}
          </div>
        </>
      )}

      {post.type === "notice" && post.content && (
        <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed">{post.content}</p>
      )}
    </article>
  );
}
