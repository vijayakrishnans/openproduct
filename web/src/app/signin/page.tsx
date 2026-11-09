import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProviderMark } from "@/components/provider-mark";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { configuredProviders, PROVIDER_LABEL } from "@/lib/auth/providers";
import { currentSession, safeNext } from "@/lib/auth/request";
import { appEnv, database } from "@/lib/server/env";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

const ERRORS: Record<string, string> = {
  cancelled: "Sign-in was cancelled. Try again whenever you're ready.",
  expired: "That sign-in took too long or was opened in another browser. Start again.",
  unavailable: "That way of signing in isn't available right now.",
  provider_down: "We couldn't reach that provider. Try again in a minute, or use another way in.",
};

type Search = Promise<{ next?: string; error?: string }>;

export default async function SignInPage({ searchParams }: { searchParams: Search }) {
  const { next: rawNext, error } = await searchParams;
  const next = safeNext(rawNext);
  if (await currentSession()) redirect(next);
  const [env, db] = await Promise.all([appEnv(), database()]);
  const providers = configuredProviders(env, !!db);

  return (
    <>
      <SiteHeader />
      <main className="wrap section auth-page">
        <div className="auth-card panel">
          <h1>Sign in to openproduct</h1>
          <p className="sub">Claim your builder profile, add support links, and join the discussions.</p>
          {error && ERRORS[error] ? <p className="auth-error" role="alert">{ERRORS[error]}</p> : null}
          {providers.length === 0 ? (
            <p className="unreachable">Sign-in isn&apos;t switched on yet. Check back soon.</p>
          ) : (
            <div className="auth-buttons">
              {providers.map((p) => (
                <a key={p} className="btn btn-ghost auth-btn" href={`/auth/${p}?next=${encodeURIComponent(next)}`}>
                  <ProviderMark provider={p} />
                  Continue with {PROVIDER_LABEL[p]}
                </a>
              ))}
            </div>
          )}
          <p className="auth-fine">
            We keep your provider&apos;s account id, name and picture, and never show your email. You can delete your account at any time.
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
