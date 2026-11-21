"use client";

import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, query, where, type DocumentData, type Timestamp } from "firebase/firestore";
import { clientDb } from "./firebase-client";
import { sortPosts, type PostType, type SessionStatus } from "./shared";

export type Post = {
  id: string;
  type: PostType;
  title: string;
  content: string;
  isPinned: boolean;
  published: boolean;
  createdAtMs: number;
  /** 서버 타임스탬프가 아직 확정되지 않은 경우 */
  pending: boolean;
};

export type Board = {
  title: string;
  description: string;
  driveUrl: string | null;
  status: SessionStatus;
  readableAfterEnd: boolean;
};

export type InstructorSession = Board & {
  id: string;
  publicToken: string;
  joinCode: string;
  ownerId: string;
  createdAtMs: number;
};

export type Connection = "connecting" | "online" | "offline";

const tsMs = (t: Timestamp | null | undefined) => (t && typeof t.toMillis === "function" ? t.toMillis() : 0);

function toPost(id: string, d: DocumentData): Post {
  return {
    id,
    type: d.type,
    title: d.title ?? "",
    content: d.content ?? "",
    isPinned: !!d.isPinned,
    published: !!d.published,
    createdAtMs: tsMs(d.createdAt) || Date.now(),
    pending: !d.createdAt,
  };
}

/**
 * Firestore onSnapshot = 실시간 동기화 + 자동 재연결 + 재연결 시 최신 상태 복구.
 * fromCache 메타데이터로 연결 상태를 추정한다.
 */
export function usePublicBoard(token: string) {
  const [board, setBoard] = useState<Board | null>(null);
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [error, setError] = useState<"not_found" | "closed" | "unknown" | null>(null);
  const [connection, setConnection] = useState<Connection>("connecting");

  useEffect(() => {
    const db = clientDb();
    const unsubBoard = onSnapshot(
      doc(db, "boards", token),
      { includeMetadataChanges: true },
      (snap) => {
        if (!snap.exists()) {
          // 캐시만 보고 판단하지 않도록 서버 응답일 때만 not_found
          if (!snap.metadata.fromCache) setError("not_found");
          return;
        }
        setBoard(snap.data() as Board);
        setConnection(snap.metadata.fromCache ? "offline" : "online");
      },
      (err) => setError(err.code === "permission-denied" ? "closed" : "unknown"),
    );
    const unsubPosts = onSnapshot(
      query(collection(db, "boards", token, "posts"), where("published", "==", true)),
      { includeMetadataChanges: true },
      (snap) => {
        setPosts(sortPosts(snap.docs.map((d) => toPost(d.id, d.data()))));
        setConnection(snap.metadata.fromCache ? "offline" : "online");
      },
      (err) => setError(err.code === "permission-denied" ? "closed" : "unknown"),
    );
    const onOffline = () => setConnection("offline");
    window.addEventListener("offline", onOffline);
    return () => {
      unsubBoard();
      unsubPosts();
      window.removeEventListener("offline", onOffline);
    };
  }, [token]);

  return { board, posts, error, connection };
}

export function useInstructorSession(id: string, uid: string | undefined) {
  const [session, setSession] = useState<InstructorSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      doc(clientDb(), "sessions", id),
      (snap) => {
        const d = snap.data();
        if (!d) return setError("강의를 찾을 수 없습니다.");
        setSession({
          id: snap.id,
          publicToken: d.publicToken,
          joinCode: d.joinCode,
          ownerId: d.ownerId,
          title: d.title,
          description: d.description ?? "",
          driveUrl: d.driveUrl ?? null,
          status: d.status,
          readableAfterEnd: d.readableAfterEnd !== false,
          createdAtMs: tsMs(d.createdAt),
        });
      },
      (err) => setError(err.code === "permission-denied" ? "강의를 찾을 수 없거나 권한이 없습니다." : "불러오기에 실패했습니다."),
    );
  }, [id, uid]);
  return { session, error };
}

export function useInstructorPosts(publicToken: string | undefined) {
  const [posts, setPosts] = useState<Post[] | null>(null);
  useEffect(() => {
    if (!publicToken) return;
    return onSnapshot(collection(clientDb(), "boards", publicToken, "posts"), (snap) =>
      setPosts(snap.docs.map((d) => toPost(d.id, d.data())).sort((a, b) => b.createdAtMs - a.createdAtMs)),
    );
  }, [publicToken]);
  return posts;
}

export function useMySessions(uid: string | undefined) {
  const [sessions, setSessions] = useState<InstructorSession[] | null>(null);
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(query(collection(clientDb(), "sessions"), where("ownerId", "==", uid)), (snap) =>
      setSessions(
        snap.docs
          .map((s) => {
            const d = s.data();
            return {
              id: s.id,
              publicToken: d.publicToken,
              joinCode: d.joinCode,
              ownerId: d.ownerId,
              title: d.title,
              description: d.description ?? "",
              driveUrl: d.driveUrl ?? null,
              status: d.status,
              readableAfterEnd: d.readableAfterEnd !== false,
              createdAtMs: tsMs(d.createdAt) || Date.now(),
            } satisfies InstructorSession;
          })
          .sort((a, b) => b.createdAtMs - a.createdAtMs),
      ),
    );
  }, [uid]);
  return sessions;
}
