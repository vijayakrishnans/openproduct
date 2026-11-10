// POST /auth/email — send a one-time sign-in link (BP3). The answer is the
// same whether or not the address has an account, so the form can't be
// used to find out who's signed up.
import { NextResponse, type NextRequest } from "next/server";
import { createEmailLink, emailConfigured, normalizeEmail, signInEmail } from "@/lib/auth/email-link";
import { safeNext, sameOrigin } from "@/lib/auth/request";
import { appEnv, database } from "@/lib/server/env";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new NextResponse("Forbidden", { status: 403 });
  const form = await request.formData().catch(() => null);
  const raw = typeof form?.get("email") === "string" ? (form!.get("email") as string) : "";
  const next = safeNext(typeof form?.get("next") === "string" ? (form!.get("next") as string) : "/");
  // From the account page (adding email to an account), answer there.
  const page = form?.get("from") === "account" ? "/account" : "/signin";
  const go = (q: Record<string, string>) => NextResponse.redirect(new URL(`${page}?${new URLSearchParams(page === "/signin" ? { ...q, next } : q)}`, request.url), 303);

  const [env, db] = await Promise.all([appEnv(), database()]);
  if (!db || !emailConfigured(env)) return go({ error: "unavailable" });
  const email = normalizeEmail(raw);
  if (!email) return go({ error: "bad_email" });

  const link = await createEmailLink(db, email, next);
  // Over the limit: say "sent" anyway. The earlier links still work.
  if (link.ok) {
    const url = `${request.nextUrl.origin}/signin/email?token=${link.token}`;
    try {
      await env.EMAIL!.send({ from: { email: env.EMAIL_FROM!, name: "openproduct" }, to: email, ...signInEmail(url) });
    } catch {
      return go({ error: "email_down" });
    }
  }
  return go({ sent: "1" });
}
