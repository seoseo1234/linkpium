"use client";

import { useLayoutEffect, useRef, useState } from "react";

/** 줄바꿈 없이 한 줄로 표시하고, 칸보다 길면 글자 크기를 줄여 맞춘다 (프로젝터 주소용) */
export function FitOneLine({ text, maxRem, className }: { text: string; maxRem: number; className?: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState<number | null>(null);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const span = textRef.current;
    if (!box || !span) return;
    const fit = () => {
      const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const maxPx = maxRem * rootPx;
      // 현재 크기에서 잰 너비를 최대 크기 기준으로 환산 (글자 너비는 크기에 비례)
      const curPx = parseFloat(getComputedStyle(span).fontSize) || rootPx;
      const widthAtMax = (span.offsetWidth * maxPx) / curPx;
      setSize(Math.floor(Math.min(maxPx, (maxPx * box.clientWidth * 0.97) / Math.max(widthAtMax, 1))));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    window.addEventListener("resize", fit);
    document.addEventListener("fullscreenchange", fit);
    document.fonts?.ready.then(fit).catch(() => {});
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fit);
      document.removeEventListener("fullscreenchange", fit);
    };
  }, [text, maxRem]);

  return (
    <div ref={boxRef} className={`w-full overflow-hidden whitespace-nowrap ${className ?? ""}`}>
      <span ref={textRef} style={size ? { fontSize: size } : { visibility: "hidden" }}>
        {text}
      </span>
    </div>
  );
}
