"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(config.apiKey && config.projectId);

let app: FirebaseApp | undefined;

function firebaseApp(): FirebaseApp {
  if (!firebaseConfigured) throw new Error("Firebase 환경변수(NEXT_PUBLIC_FIREBASE_*)가 설정되지 않았습니다.");
  if (!app) app = getApps().length ? getApp() : initializeApp(config);
  return app;
}

export const clientAuth = (): Auth => getAuth(firebaseApp());
export const clientDb = (): Firestore => getFirestore(firebaseApp());

/** 참여자에게 안내할 공통 주소 (환경변수 우선, 없으면 현재 주소) */
export function siteOrigin(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
  if (env) return env;
  return typeof window !== "undefined" ? window.location.origin : "";
}

export function siteHost(): string {
  try {
    return new URL(siteOrigin()).host;
  } catch {
    return siteOrigin();
  }
}

export function directLink(publicToken: string): string {
  return `${siteOrigin()}/s/${publicToken}`;
}
