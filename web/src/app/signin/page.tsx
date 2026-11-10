import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProviderMark } from "@/components/provider-mark";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { emailConfigured } from "@/lib/auth/email-link";
import { configuredProviders, PROVIDER_LABEL } from "@/lib/auth/providers";
import { currentSession, safeNext } from "@/lib/auth/request";
import { appEnv, database, demoSignIn } from "@/lib/server/env";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

const ERRORS: Record<string, string> = {
  cancelled: "Sign-in was cancelled. Try again whenever you're ready.",
  expired: "That sign-in took too long or was opened in another browser. Start again.",
  unavailable: "That way of signing in isn't available right now.",
  provider_down: "We couldn't reach that provider. Try again in a minute, or use another way in.",
  bad_email: "That doesn't look like an email address.",
  email_down: "We couldn't send the email just now. Try again in a minute, or use another way in.",
  link_used: "That sign-in link has been used or has expired. Ask for a new one.",
};

type Search = Promise<{ next?: string; error?: string; sent?: string }>;

export default async function SignInPage({ searchParams }: { searchParams: Search }) {
  const { next: rawNext, error, sent } = await searchParams;
  const next = safeNext(rawNext);
  if (await currentSession()) redirect(next);
  const [env, db] = await Promise.all([appEnv(), database()]);
  const providers = configuredProviders(env, !!db);
  const byEmail = !!db && emailConfigured(env);

  return (
    <>
      <SiteHeader />
      <main className="wrap section auth-page">
        <div className="auth-card panel">
          <h1>Sign in to openproduct</h1>
          <p className="sub">Claim your builder profile, add support links, and join the discussions.</p>
          {error && ERRORS[error] ? <p className="auth-error" role="alert">{ERRORS[error]}</p> : null}
          {demoSignIn(env) ? (
            <Link className="btn btn-dark auth-btn" href={`/demo?next=${encodeURIComponent(next)}`}>Try a demo account</Link>
          ) : null}
          {sent ? (
            <p className="auth-ok" role="status">Check your inbox. If that address can get mail, a sign-in link is on its way; it works once, for 15 minutes.</p>
          ) : null}
          {providers.length === 0 && !byEmail ? (
            demoSignIn(env) ? null : <p className="unreachable">Sign-in isn&apos;t switched on yet. Check back soon.</p>
          ) : (
            <div className="auth-buttons">
              {providers.map((p) => (
                <a key={p} className="btn btn-ghost auth-btn" href={`/auth/${p}?next=${encodeURIComponent(next)}`}>
                  <ProviderMark provider={p} />
                  Continue with {PROVIDER_LABEL[p]}
                </a>
              ))}
              {byEmail ? (
                <form method="post" action="/auth/email" className="auth-email">
                  <input type="hidden" name="next" value={next} />
                  <label>
                    <span>Or get a sign-in link by email</span>
                    <input type="email" name="email" required autoComplete="email" maxLength={254} placeholder="you@example.com" />
                  </label>
                  <button className="btn btn-dark" type="submit">Email me a link</button>
                </form>
              ) : null}
            </div>
          )}
          <p className="auth-fine">
            We keep your provider&apos;s account id, name and picture, and never show your email. An email link signs you in with that address alone; we never match it to other accounts. You can delete your account at any time.
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
