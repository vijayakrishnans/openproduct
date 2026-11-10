import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ProviderMark } from "@/components/provider-mark";
import { SupportForm } from "@/components/support-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { identitiesOf } from "@/lib/auth/accounts";
import { builderOfAccount, MAX_BIO, MAX_DISPLAY_NAME } from "@/lib/auth/builders";
import { configuredProviders, PROVIDER_LABEL } from "@/lib/auth/providers";
import { currentSession, safeNext } from "@/lib/auth/request";
import { maintainedBuilds, supportLinksOf } from "@/lib/auth/support";
import { loadDirectory, maintainsOf } from "@/lib/directory";
import { followingOf } from "@/lib/auth/reactions";
import { appEnv, database } from "@/lib/server/env";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your account", robots: { index: false } };

type Search = Promise<{ welcome?: string; next?: string; added?: string; error?: string; provider?: string; message?: string; saved?: string }>;

export default async function AccountPage({ searchParams }: { searchParams: Search }) {
  const q = await searchParams;
  const session = await currentSession();
  if (!session) redirect("/signin?next=/account");
  const [env, db] = await Promise.all([appEnv(), database()]);
  if (!db) redirect("/signin");
  const [identities, builder] = await Promise.all([identitiesOf(db, session.account.id), builderOfAccount(db, session.account.id)]);
  const [ownLinks, builds] = builder
    ? await Promise.all([supportLinksOf(db, { kind: "builder", key: builder.handle }), maintainedBuilds(db, session.account.id, maintainsOf)])
    : [null, [] as string[]];
  // Drafts have no build page yet, so they get no link.
  const listed = builds.length ? await loadDirectory().then((d) => new Set(d.ok ? d.builds.map((x) => x.slug) : [])) : new Set<string>();
  const buildLinks = await Promise.all(builds.map(async (slug) => ({ slug, ...(await supportLinksOf(db, { kind: "build", key: slug })) })));
  const following = await followingOf(db, session.account.id).catch(() => []);
  const linked = new Set(identities.map((i) => i.provider));
  const addable = configuredProviders(env, true).filter((p) => !linked.has(p));
  const next = q.next ? safeNext(q.next) : null;

  return (
    <>
      <SiteHeader />
      <main className="wrap section account-page">
        <h1>Your account</h1>
        {q.welcome ? (
          <p className="auth-ok" role="status">
            Welcome. You&apos;re signed in.{" "}
            {next && next !== "/" ? <Link className="link" href={next}>Carry on where you were</Link> : null}
          </p>
        ) : null}
        {q.added ? <p className="auth-ok" role="status">{PROVIDER_LABEL[q.added as keyof typeof PROVIDER_LABEL] ?? "That provider"} is now a way into this account.</p> : null}
        {q.saved ? <p className="auth-ok" role="status">Saved.</p> : null}
        {q.error === "taken" ? (
          <p className="auth-error" role="alert">
            That {PROVIDER_LABEL[q.provider as keyof typeof PROVIDER_LABEL] ?? ""} account already belongs to another openproduct account. Sign in with it to use that account, or delete that account first.
          </p>
        ) : null}
        {q.error === "refused" && q.message ? <p className="auth-error" role="alert">{q.message.slice(0, 200)}</p> : null}

        <section className="panel account-section" id="profile">
          <div className="panel-head">
            <div>
              <h2>Builder profile</h2>
              <p className="sub">Your public page on openproduct.</p>
            </div>
            {builder ? <Link className="btn btn-ghost" href={`/builders/${builder.handle}`}>View your page</Link> : null}
          </div>
          {!builder ? (
            <div className="account-empty">
              <p>
                Already on openproduct.live? Open your builder page and choose <b>Claim this profile</b>. That works when you&apos;ve signed in with the GitHub account your profile links to.
              </p>
              <p>New here? Start a profile with a handle of your own.</p>
              <div className="account-actions">
                <Link className="btn btn-dark" href="/builders/new">Start your builder profile</Link>
                <Link className="btn btn-ghost" href="/builders">Find your profile</Link>
              </div>
            </div>
          ) : builder.kind === "claimed" ? (
            <p>
              You&apos;ve claimed <b>@{builder.handle}</b>. Its name, bio and builds come from openproduct.live. Support links, posts and discussions you add here will appear on it.
            </p>
          ) : (
            <form method="post" action="/account/profile" className="account-form">
              <input type="hidden" name="mode" value="update" />
              <p className="mono handle">@{builder.handle}</p>
              <label>
                Name
                <input name="displayName" required maxLength={MAX_DISPLAY_NAME} defaultValue={builder.displayName ?? ""} />
              </label>
              <label>
                Bio
                <textarea name="bio" rows={4} maxLength={MAX_BIO} defaultValue={builder.bio ?? ""} />
              </label>
              <button className="btn btn-dark" type="submit">Save profile</button>
            </form>
          )}
        </section>

        {builder && ownLinks ? (
          <section className="panel account-section" id="support">
            <div className="panel-head">
              <div>
                <h2>Support links</h2>
                <p className="sub">Where people can pay you, shown on your builder page.</p>
              </div>
            </div>
            <SupportForm kind="builder" ownerKey={builder.handle} links={ownLinks.links} label="Your profile" />
          </section>
        ) : null}

        {buildLinks.map((b) => (
          <section className="panel account-section" id={`build-${b.slug}`} key={b.slug}>
            <div className="panel-head">
              <div>
                <h2>Support {b.slug}</h2>
                <p className="sub">
                  You maintain this build.{" "}
                  {listed.has(b.slug) ? "These show on its build page." : "It's still a draft, so these show once it's listed with a tagline and category."}
                </p>
              </div>
              {listed.has(b.slug) ? (
                <Link className="btn btn-ghost" href={`/builds/${b.slug}`}>View build</Link>
              ) : (
                <span className="pill">Draft</span>
              )}
            </div>
            <SupportForm kind="build" ownerKey={b.slug} links={b.links} label={b.slug} />
          </section>
        ))}

        <section className="panel account-section" id="following">
          <div className="panel-head">
            <div>
              <h2>Following</h2>
              <p className="sub">Builds and builders you follow here.</p>
            </div>
          </div>
          {following.length ? (
            <ul className="following-list">
              {following.map((f) => (
                <li key={`${f.kind}:${f.key}`}>
                  <Link className="link" href={f.kind === "build" ? `/builds/${f.key}` : `/builders/${f.key}`}>
                    {f.kind === "build" ? f.key : `@${f.key}`}
                  </Link>
                  <span className="muted">{f.kind === "build" ? "build" : "builder"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted" style={{ margin: 0 }}>Nothing yet. Follow a build or a builder from its page.</p>
          )}
        </section>

        <section className="panel account-section">
          <div className="panel-head">
            <div>
              <h2>Ways to sign in</h2>
              <p className="sub">Any of these opens this same account.</p>
            </div>
          </div>
          <ul className="identity-list">
            {identities.map((i) => (
              <li key={i.provider}>
                <ProviderMark provider={i.provider} />
                <span>
                  <b>{PROVIDER_LABEL[i.provider]}</b>
                  {i.login ? <span className="mono"> @{i.login}</span> : null}
                </span>
              </li>
            ))}
          </ul>
          {addable.length > 0 ? (
            <div className="account-actions">
              {addable.map((p) => (
                <a key={p} className="btn btn-ghost" href={`/auth/${p}?next=/account`}>
                  <ProviderMark provider={p} /> Add {PROVIDER_LABEL[p]}
                </a>
              ))}
            </div>
          ) : null}
        </section>

        <section className="panel account-section danger">
          <h2>Delete your account</h2>
          <p className="sub">
            Removes your account, every way you sign in, your sessions and your builder profile here. Your openproduct.live profile isn&apos;t touched.
          </p>
          <form method="post" action="/account/delete" className="account-form">
            <label className="check">
              <input type="checkbox" name="confirm" required /> I understand this can&apos;t be undone
            </label>
            <button className="btn btn-danger" type="submit">Delete account</button>
          </form>
        </section>

        <form method="post" action="/signout" className="signout-form">
          <button className="btn btn-ghost" type="submit">Sign out</button>
        </form>
      </main>
      <SiteFooter />
    </>
  );
}
