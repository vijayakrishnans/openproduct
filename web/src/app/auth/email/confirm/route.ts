// POST /auth/email/confirm — use a one-time email link (BP3): sign in,
// create an account, or add email to the signed-in account.
import { NextResponse, type NextRequest } from "next/server";
import { resolveSignIn } from "@/lib/auth/accounts";
import { consumeEmailLink } from "@/lib/auth/email-link";
import { sameOrigin } from "@/lib/auth/request";
import { createSession, SESSION_COOKIE, sessionCookieOptions, validateSession } from "@/lib/auth/session";
import { database } from "@/lib/server/env";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new NextResponse("Forbidden", { status: 403 });
  const secure = request.nextUrl.protocol === "https:";
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url), 303);
  const form = await request.formData().catch(() => null);
  const token = typeof form?.get("token") === "string" ? (form!.get("token") as string) : "";

  const db = await database();
  if (!db) return to("/signin?error=unavailable");
  const link = await consumeEmailLink(db, token);
  if (!link) return to("/signin?error=link_used");

  // The address is the identity: whoever holds the inbox holds the link.
  const profile = { providerUserId: link.email, login: null, displayName: null, avatarUrl: null, email: link.email };
  const current = await validateSession(db, request.cookies.get(SESSION_COOKIE)?.value).catch(() => null);
  const outcome = await resolveSignIn(db, "email", profile, current?.account.id ?? null);
  if (outcome.kind === "taken") return to("/account?error=taken&provider=email");
  if (outcome.kind === "linked" || outcome.kind === "already-linked") return to("/account?added=email");

  const session = await createSession(db, outcome.accountId);
  const res = to(outcome.created ? `/account?welcome=1&next=${encodeURIComponent(link.next)}` : link.next);
  res.cookies.set(SESSION_COOKIE, session.token, sessionCookieOptions(secure));
  return res;
}
