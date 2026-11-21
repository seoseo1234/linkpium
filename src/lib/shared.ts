// 클라이언트·서버 공용 타입과 검증 함수. Firebase 의존성 없음(테스트 가능).

export type SessionStatus = "draft" | "live" | "ended" | "closed";
export type PostType = "link" | "prompt" | "notice";

export const POST_TYPES: PostType[] = ["link", "prompt", "notice"];
export const SESSION_STATUSES: SessionStatus[] = ["draft", "live", "ended", "closed"];

export const LIMITS = {
  title: 200,
  description: 1000,
  content: 20000,
  url: 2000,
} as const;

/** 공백·하이픈을 지운 6자리 숫자면 반환, 아니면 null */
export function normalizeJoinCode(input: string): string | null {
  const stripped = String(input ?? "").replace(/[\s\-]/g, "");
  return /^\d{6}$/.test(stripped) ? stripped : null;
}

/** 482716 → "482 716" (프로젝터 가독성) */
export function formatJoinCode(code: string): string {
  return code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
}

/** http/https 만 허용. javascript:, data: 등 위험 스킴 차단 */
export function isSafeHttpUrl(value: string): boolean {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > LIMITS.url) return false;
  try {
    const u = new URL(trimmed);
    return (u.protocol === "https:" || u.protocol === "http:") && !!u.hostname;
  } catch {
    return false;
  }
}

/** 참여자가 볼 수 있는 상태인지 (Firestore 규칙과 동일한 로직을 유지할 것) */
export function isBoardReadable(status: SessionStatus, readableAfterEnd: boolean): boolean {
  if (status === "closed") return false;
  if (status === "ended") return readableAfterEnd;
  return true;
}

/** 새 게시가 가능한 상태 */
export function canPost(status: SessionStatus): boolean {
  return status === "live" || status === "draft";
}

export function urlHost(value: string): string {
  try {
    return new URL(value).host;
  } catch {
    return value;
  }
}

/** 제목이 비었을 때 화면용 대체 제목 */
export function displayTitle(post: { type: PostType; title: string; content: string }): string {
  if (post.title.trim()) return post.title;
  if (post.type === "link") return urlHost(post.content);
  const firstLine = post.content.split("\n").find((l) => l.trim()) ?? "";
  if (firstLine) return firstLine.length > 60 ? firstLine.slice(0, 60) + "…" : firstLine;
  return post.type === "prompt" ? "프롬프트" : "공지";
}

export type PostInput = { type: PostType; title: string; content: string };

/** 게시물 입력 검증. 오류 메시지(한국어) 또는 정리된 값 반환 */
export function validatePostInput(raw: unknown): { ok: true; value: PostInput } | { ok: false; error: string } {
  const r = (raw ?? {}) as Record<string, unknown>;
  const type = r.type as PostType;
  if (!POST_TYPES.includes(type)) return { ok: false, error: "게시물 유형이 올바르지 않습니다." };
  const title = typeof r.title === "string" ? r.title.trim() : "";
  const content = typeof r.content === "string" ? (type === "link" ? r.content.trim() : r.content) : "";
  if (title.length > LIMITS.title) return { ok: false, error: `제목은 ${LIMITS.title}자 이하로 입력하세요.` };
  if (content.length > LIMITS.content) return { ok: false, error: `내용은 ${LIMITS.content}자 이하로 입력하세요.` };
  if (type === "link") {
    if (!isSafeHttpUrl(content)) return { ok: false, error: "http:// 또는 https:// 로 시작하는 올바른 주소를 입력하세요." };
  } else if (type === "prompt") {
    if (!content.trim()) return { ok: false, error: "프롬프트 내용을 입력하세요." };
  } else {
    if (!content.trim() && !title) return { ok: false, error: "공지 제목이나 내용을 입력하세요." };
  }
  return { ok: true, value: { type, title, content } };
}

export type SessionPatch = {
  title?: string;
  description?: string;
  driveUrl?: string | null;
  status?: SessionStatus;
  readableAfterEnd?: boolean;
};

export function validateSessionPatch(raw: unknown, { requireTitle = false } = {}):
  | { ok: true; value: SessionPatch }
  | { ok: false; error: string } {
  const r = (raw ?? {}) as Record<string, unknown>;
  const out: SessionPatch = {};
  if ("title" in r || requireTitle) {
    const t = typeof r.title === "string" ? r.title.trim() : "";
    if (!t) return { ok: false, error: "강의 제목을 입력하세요." };
    if (t.length > LIMITS.title) return { ok: false, error: `제목은 ${LIMITS.title}자 이하로 입력하세요.` };
    out.title = t;
  }
  if ("description" in r) {
    const d = typeof r.description === "string" ? r.description.trim() : "";
    if (d.length > LIMITS.description) return { ok: false, error: `설명은 ${LIMITS.description}자 이하로 입력하세요.` };
    out.description = d;
  }
  if ("driveUrl" in r) {
    const v = typeof r.driveUrl === "string" ? r.driveUrl.trim() : "";
    if (v && !isSafeHttpUrl(v)) return { ok: false, error: "드라이브 링크는 https:// 로 시작하는 주소여야 합니다." };
    out.driveUrl = v || null;
  }
  if ("status" in r) {
    if (!SESSION_STATUSES.includes(r.status as SessionStatus)) return { ok: false, error: "상태 값이 올바르지 않습니다." };
    out.status = r.status as SessionStatus;
  }
  if ("readableAfterEnd" in r) {
    if (typeof r.readableAfterEnd !== "boolean") return { ok: false, error: "종료 후 열람 설정이 올바르지 않습니다." };
    out.readableAfterEnd = r.readableAfterEnd;
  }
  return { ok: true, value: out };
}

/** 게시물 정렬: 고정 먼저, 그다음 최신순 */
export function sortPosts<T extends { isPinned: boolean; createdAtMs: number }>(posts: T[]): T[] {
  return [...posts].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return b.createdAtMs - a.createdAtMs;
  });
}

export const STATUS_LABEL: Record<SessionStatus, string> = {
  draft: "준비 중",
  live: "진행 중",
  ended: "종료",
  closed: "접근 차단",
};

export const TYPE_LABEL: Record<PostType, string> = {
  link: "링크",
  prompt: "프롬프트",
  notice: "공지",
};
