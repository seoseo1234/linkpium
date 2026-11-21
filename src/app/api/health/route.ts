import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 배포 진단용. 비밀값은 내보내지 않고 "설정됨 여부"만 보여준다.
 * firebase-admin 을 동적으로 불러와, 모듈 로드 단계에서 실패해도 원인을 JSON 으로 확인할 수 있다.
 */
export async function GET() {
  const env = Object.fromEntries(
    [
      "NEXT_PUBLIC_FIREBASE_API_KEY",
      "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
      "FIREBASE_PROJECT_ID",
      "FIREBASE_CLIENT_EMAIL",
      "FIREBASE_PRIVATE_KEY",
      "NEXT_PUBLIC_SITE_URL",
      "RATE_LIMIT_SALT",
    ].map((k) => [k, Boolean(process.env[k])]),
  );
  const pk = process.env.FIREBASE_PRIVATE_KEY ?? "";
  const keyShape = {
    hasBegin: pk.includes("BEGIN PRIVATE KEY"),
    hasEscapedNewlines: pk.includes("\\n"),
    hasRealNewlines: pk.includes("\n"),
    wrappedInQuotes: pk.startsWith('"') || pk.startsWith("'"),
  };

  const steps: Record<string, string> = {};
  const attempt = async (name: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      steps[name] = "ok";
      return true;
    } catch (e) {
      steps[name] = `${(e as Error)?.name ?? "Error"}: ${String((e as Error)?.message ?? e).slice(0, 400)}`;
      return false;
    }
  };

  (await attempt("import firebase-admin/app", () => import("firebase-admin/app"))) &&
    (await attempt("import firebase-admin/auth", () => import("firebase-admin/auth"))) &&
    (await attempt("import firebase-admin/firestore", () => import("firebase-admin/firestore"))) &&
    (await attempt("init admin", async () => {
      const { adminDb } = await import("@/lib/server/admin");
      adminDb();
    })) &&
    (await attempt("firestore read", async () => {
      const { adminDb } = await import("@/lib/server/admin");
      await adminDb().collection("joinCodes").limit(1).get();
    }));

  return NextResponse.json({ node: process.version, env, keyShape, steps }, { headers: { "Cache-Control": "no-store" } });
}
