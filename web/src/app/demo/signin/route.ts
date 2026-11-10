// POST /demo/signin — become a demo account (OP-34). Stage only: refused
// unless DEMO_SIGNIN is on, and only for accounts whose id starts `demo-`.
import { NextResponse, type NextRequest } from "next/server";
import { demoAccounts, isDemoAccount } from "@/lib/auth/demo";
import { safeNext, sameOrigin } from "@/lib/auth/request";
import { createSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { appEnv, database, demoSignIn } from "@/lib/server/env";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new NextResponse("Forbidden", { status: 403 });
  const [env, db] = await Promise.all([appEnv(), database()]);
  if (!db || !demoSignIn(env)) return new NextResponse("Not found", { status: 404 });
  const form = await request.formData().catch(() => null);
  const account = typeof form?.get("account") === "string" ? (form!.get("account") as string) : "";
  const next = safeNext(typeof form?.get("next") === "string" ? (form!.get("next") as string) : "/");
  if (!isDemoAccount(account) || !(await demoAccounts(db)).some((a) => a.accountId === account)) {
    return NextResponse.redirect(new URL("/demo?error=1", request.url), 303);
  }
  const session = await createSession(db, account);
  const res = NextResponse.redirect(new URL(next, request.url), 303);
  res.cookies.set(SESSION_COOKIE, session.token, sessionCookieOptions(request.nextUrl.protocol === "https:"));
  return res;
}
