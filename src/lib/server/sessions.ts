import "server-only";
import { randomUUID } from "node:crypto";
import { FieldValue, Timestamp, type Firestore, type Transaction } from "firebase-admin/firestore";
import { adminDb } from "./admin";
import { generateJoinCode, generatePublicToken } from "./codes";
import { HttpError } from "./http";
import type { PostType, SessionPatch, SessionStatus } from "@/lib/shared";

/*
 * Firestore 구조
 *  sessions/{sessionId}            강사 전용(소유자만 읽기). joinCode 등 전체 정보
 *  boards/{publicToken}            참여자 공개 정보 미러 (규칙: 열람 가능 상태일 때 get 허용, list 불가)
 *  boards/{publicToken}/posts/{id} 게시물 (규칙: published==true 이고 열람 가능할 때 읽기)
 *  joinCodes/{code}                코드 → 강의 매핑 (Admin 전용, 문서 ID 로 유일성 보장)
 *  rateLimits/{ipHash}             코드 입장 시도 제한 (Admin 전용)
 * 모든 쓰기는 서버 API(Admin SDK)로만 수행한다.
 */

export type SessionDoc = {
  ownerId: string;
  ownerEmail: string | null;
  publicToken: string;
  joinCode: string;
  title: string;
  description: string;
  driveUrl: string | null;
  status: SessionStatus;
  readableAfterEnd: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  endedAt: Timestamp | null;
};

export type PostDoc = {
  type: PostType;
  title: string;
  content: string;
  isPinned: boolean;
  published: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

const MAX_CODE_TRIES = 20;

export const refs = (db: Firestore = adminDb()) => ({
  session: (id: string) => db.collection("sessions").doc(id),
  board: (token: string) => db.collection("boards").doc(token),
  posts: (token: string) => db.collection("boards").doc(token).collection("posts"),
  joinCode: (code: string) => db.collection("joinCodes").doc(code),
});

/** 트랜잭션 안에서 아직 쓰이지 않은 코드를 찾아 예약한다 */
async function reserveCode(tx: Transaction, sessionId: string, publicToken: string): Promise<string> {
  const r = refs();
  for (let i = 0; i < MAX_CODE_TRIES; i++) {
    const code = generateJoinCode();
    const snap = await tx.get(r.joinCode(code));
    if (!snap.exists) {
      tx.create(r.joinCode(code), { sessionId, publicToken, createdAt: FieldValue.serverTimestamp() });
      return code;
    }
  }
  throw new HttpError(503, "입장 코드를 발급하지 못했습니다. 다시 시도하세요.");
}

type MirrorFields = Pick<SessionDoc, "ownerId" | "title" | "description" | "driveUrl" | "status" | "readableAfterEnd">;

function boardMirror(id: string, s: MirrorFields) {
  return {
    sessionId: id,
    ownerId: s.ownerId,
    title: s.title,
    description: s.description,
    driveUrl: s.driveUrl,
    status: s.status,
    readableAfterEnd: s.readableAfterEnd,
    updatedAt: FieldValue.serverTimestamp(),
  };
}

export async function createSession(
  owner: { uid: string; email: string | null },
  input: { title: string; description?: string; driveUrl?: string | null },
): Promise<{ id: string; publicToken: string; joinCode: string }> {
  const db = adminDb();
  const r = refs(db);
  const id = randomUUID();
  const publicToken = generatePublicToken();
  const base = {
    ownerId: owner.uid,
    ownerEmail: owner.email,
    publicToken,
    title: input.title,
    description: input.description ?? "",
    driveUrl: input.driveUrl ?? null,
    status: "live" as SessionStatus,
    readableAfterEnd: true,
  };
  const joinCode = await db.runTransaction(async (tx) => {
    const code = await reserveCode(tx, id, publicToken);
    tx.create(r.session(id), {
      ...base,
      joinCode: code,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      endedAt: null,
    });
    tx.create(r.board(publicToken), boardMirror(id, base));
    return code;
  });
  return { id, publicToken, joinCode };
}

/** 소유권 검사 후 강의 문서 반환. 남의 강의면 존재 여부도 숨기려고 404 */
export async function getOwnedSession(id: string, uid: string): Promise<SessionDoc> {
  const snap = await refs().session(id).get();
  const data = snap.data() as SessionDoc | undefined;
  if (!data || data.ownerId !== uid) throw new HttpError(404, "강의를 찾을 수 없습니다.");
  return data;
}

export async function updateSession(id: string, uid: string, patch: SessionPatch): Promise<void> {
  const db = adminDb();
  const r = refs(db);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(r.session(id));
    const cur = snap.data() as SessionDoc | undefined;
    if (!cur || cur.ownerId !== uid) throw new HttpError(404, "강의를 찾을 수 없습니다.");
    const next = { ...cur, ...patch };
    const update: Record<string, unknown> = { ...patch, updatedAt: FieldValue.serverTimestamp() };
    if (patch.status && patch.status !== cur.status) {
      if (patch.status === "ended") update.endedAt = FieldValue.serverTimestamp();
      if (patch.status === "live" || patch.status === "draft") update.endedAt = null;
    }
    tx.update(r.session(id), update);
    tx.set(r.board(cur.publicToken), boardMirror(id, next), { merge: true });
  });
}

export async function deleteSession(id: string, uid: string): Promise<void> {
  const db = adminDb();
  const r = refs(db);
  const s = await getOwnedSession(id, uid);
  // 코드·공개 보드를 먼저 끊어 참여자 접근을 즉시 막고, 게시물은 재귀 삭제
  await r.joinCode(s.joinCode).delete();
  await db.recursiveDelete(r.board(s.publicToken));
  await r.session(id).delete();
}

export async function regenerateCode(id: string, uid: string): Promise<string> {
  const db = adminDb();
  const r = refs(db);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(r.session(id));
    const cur = snap.data() as SessionDoc | undefined;
    if (!cur || cur.ownerId !== uid) throw new HttpError(404, "강의를 찾을 수 없습니다.");
    const code = await reserveCode(tx, id, cur.publicToken);
    tx.delete(r.joinCode(cur.joinCode)); // 이전 코드 효력 종료
    tx.update(r.session(id), { joinCode: code, updatedAt: FieldValue.serverTimestamp() });
    return code;
  });
}

/** 강의 복제: 새 ID/토큰/코드, 게시물은 비공개 초안으로 복사. 접속 정보는 복제하지 않음 */
export async function duplicateSession(id: string, owner: { uid: string; email: string | null }) {
  const db = adminDb();
  const r = refs(db);
  const src = await getOwnedSession(id, owner.uid);
  const created = await createSession(owner, {
    title: `${src.title} (복제)`.slice(0, 200),
    description: src.description,
    driveUrl: src.driveUrl,
  });
  const posts = await r.posts(src.publicToken).get();
  const writer = db.bulkWriter();
  posts.docs.forEach((d) => {
    const p = d.data() as PostDoc;
    writer.create(r.posts(created.publicToken).doc(), {
      type: p.type,
      title: p.title,
      content: p.content,
      isPinned: p.isPinned,
      published: false,
      createdAt: p.createdAt,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  await writer.close();
  return created;
}

const ms = (t: Timestamp | null | undefined) => (t && typeof t.toMillis === "function" ? t.toMillis() : null);

export function serializeSession(id: string, s: SessionDoc) {
  return {
    id,
    publicToken: s.publicToken,
    joinCode: s.joinCode,
    title: s.title,
    description: s.description,
    driveUrl: s.driveUrl,
    status: s.status,
    readableAfterEnd: s.readableAfterEnd,
    createdAt: ms(s.createdAt),
    updatedAt: ms(s.updatedAt),
    endedAt: ms(s.endedAt),
  };
}

export function serializePost(id: string, p: PostDoc) {
  return {
    id,
    type: p.type,
    title: p.title,
    content: p.content,
    isPinned: p.isPinned,
    published: p.published,
    createdAt: ms(p.createdAt),
    updatedAt: ms(p.updatedAt),
  };
}
