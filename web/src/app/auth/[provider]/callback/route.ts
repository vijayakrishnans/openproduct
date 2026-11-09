// GET /auth/<provider>/callback — the provider sends the person back here.
// Check the state against the flow cookie, trade the code (with the PKCE
// verifier) for who signed in, then sign in, create, or link.
import { NextResponse, type NextRequest } from "next/server";
import { resolveSignIn } from "@/lib/auth/accounts";
import { safeEqual } from "@/lib/auth/crypto";
import { decodeFlow, FLOW_COOKIE } from "@/lib/auth/flow-cookie";
import { completeSignIn, isProvider } from "@/lib/auth/providers";
import { createSession, SESSION_COOKIE, sessionCookieOptions, validateSession } from "@/lib/auth/session";
import { appEnv, database } from "@/lib/server/env";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const secure = request.nextUrl.protocol === "https:";
  const flow = decodeFlow(request.cookies.get(FLOW_COOKIE)?.value);
  const to = (path: string) => {
    const res = NextResponse.redirect(new URL(path, request.url), 303);
    res.cookies.set(FLOW_COOKIE, "", { path: "/auth", maxAge: 0, httpOnly: true, secure, sameSite: "lax" });
    return res;
  };
  const fail = (error: string) => to(`/signin?error=${error}${flow ? `&next=${encodeURIComponent(flow.next)}` : ""}`);

  const q = request.nextUrl.searchParams;
  if (q.get("error")) return fail("cancelled");
  const state = q.get("state");
  const code = q.get("code");
  if (!isProvider(provider) || !flow || flow.provider !== provider || !state || !code || !safeEqual(state, flow.state)) {
    return fail("expired");
  }

  const [env, db] = await Promise.all([appEnv(), database()]);
  if (!db) return fail("unavailable");

  let profile;
  try {
    profile = await completeSignIn(provider, {
      env,
      db,
      redirectUri: `${request.nextUrl.origin}/auth/${provider}/callback`,
      code,
      verifier: flow.verifier,
    });
  } catch {
    return fail("provider_down");
  }

  const current = await validateSession(db, request.cookies.get(SESSION_COOKIE)?.value).catch(() => null);
  const outcome = await resolveSignIn(db, provider, profile, current?.account.id ?? null);
  if (outcome.kind === "taken") return to(`/account?error=taken&provider=${provider}`);
  if (outcome.kind === "linked" || outcome.kind === "already-linked") return to(`/account?added=${provider}`);

  const session = await createSession(db, outcome.accountId);
  const res = to(outcome.created ? `/account?welcome=1&next=${encodeURIComponent(flow.next)}` : flow.next);
  res.cookies.set(SESSION_COOKIE, session.token, sessionCookieOptions(secure));
  return res;
}
