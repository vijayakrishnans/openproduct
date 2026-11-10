import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/person-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { demoAccounts } from "@/lib/auth/demo";
import { safeNext } from "@/lib/auth/request";
import { appEnv, database, demoSignIn } from "@/lib/server/env";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Try a demo account", robots: { index: false } };

/** Pick a demo account and look around as them (OP-34). Stage only. */
export default async function DemoPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const q = await searchParams;
  const [env, db] = await Promise.all([appEnv(), database()]);
  if (!db || !demoSignIn(env)) notFound();
  const accounts = await demoAccounts(db);
  const next = safeNext(q.next);

  return (
    <>
      <SiteHeader />
      <main className="wrap section demo-page">
        <span className="chip">STAGE · DEMO</span>
        <h1>Look around as a demo builder</h1>
        <p className="sub">
          Pick anyone below and you&apos;re signed in as them, with no GitHub or Orunbase account needed. Everything signed-in works:
          your account page, writing posts and discussions, upvoting, following, raising a hand for a seat, and listing a build. The
          moderator can hide posts and sees the reports queue. This exists on stage only; the real site never offers it.
        </p>
        {q.error ? <p className="auth-error" role="alert">That demo account doesn&apos;t exist. Pick one below.</p> : null}
        {accounts.length === 0 ? (
          <div className="unreachable">No demo accounts yet. Run <code>node scripts/seed-demo.mjs</code> against this database.</div>
        ) : (
          <ul className="demo-list">
            {accounts.map((a) => (
              <li key={a.accountId}>
                <form method="post" action="/demo/signin" className="demo-pick">
                  <input type="hidden" name="account" value={a.accountId} />
                  <input type="hidden" name="next" value={next} />
                  <button type="submit">
                    <Avatar handle={a.handle} size={44} />
                    <span className="demo-pick-text">
                      <strong>{a.name} {a.moderator ? <span className="pill">Moderator</span> : null}</strong>
                      <span className="mono muted">@{a.handle}</span>
                      {a.bio ? <span className="muted">{a.bio.replace(/^Demo profile\.\s*/, "")}</span> : null}
                    </span>
                    <span className="demo-go">Sign in →</span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
