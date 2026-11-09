// GET /auth/<provider>?next=/path — start a sign-in (or, when signed in,
// adding this provider to the account): remember state and the PKCE
// verifier in a short cookie, then send the person to the provider.
import { NextResponse, type NextRequest } from "next/server";
import { randomToken } from "@/lib/auth/crypto";
import { encodeFlow, FLOW_COOKIE, flowCookieOptions } from "@/lib/auth/flow-cookie";
import { authorizationUrl, configuredProviders, isProvider } from "@/lib/auth/providers";
import { safeNext } from "@/lib/auth/request";
import { appEnv, database } from "@/lib/server/env";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  const back = (error: string) => NextResponse.redirect(new URL(`/signin?error=${error}&next=${encodeURIComponent(next)}`, request.url), 303);

  const [env, db] = await Promise.all([appEnv(), database()]);
  if (!isProvider(provider) || !db || !configuredProviders(env, true).includes(provider)) return back("unavailable");

  const origin = request.nextUrl.origin;
  const redirectUri = `${origin}/auth/${provider}/callback`;
  const state = randomToken(24);
  const verifier = randomToken(48);
  let url: string;
  try {
    url = await authorizationUrl(provider, { env, db, redirectUri, state, verifier });
  } catch {
    return back("provider_down");
  }
  const res = NextResponse.redirect(url, 303);
  res.cookies.set(FLOW_COOKIE, encodeFlow({ provider, state, verifier, next }), flowCookieOptions(request.nextUrl.protocol === "https:"));
  return res;
}
