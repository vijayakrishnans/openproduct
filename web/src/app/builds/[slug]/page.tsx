import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AppMap } from "@/components/app-map";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SupportLinks } from "@/components/support-links";
import { buildSupportLinks } from "@/lib/auth/support";
import { followState, handsFor, voteState, type Hand } from "@/lib/auth/reactions";
import { currentSession } from "@/lib/auth/request";
import { getListing, isMaintainer, listingToDetail, missingForPublish, type Listing } from "@/lib/auth/listings";
import { isStale, refreshStats, statsOf, type ListingStats } from "@/lib/auth/listing-stats";
import { rolesOf } from "@/lib/auth/listing-roles";
import { PostBody } from "@/components/post-body";
import { parseBody } from "@/lib/body";
import { buildersByGithubLogins } from "@/lib/auth/listing-team";
import { redirectFor } from "@/lib/auth/listing-lifecycle";
import { isModerator, moderatorsFor } from "@/lib/auth/discussions";
import { githubDepsFor } from "@/lib/auth/github-prs";
import { appEnv } from "@/lib/server/env";
import Link from "next/link";
import { database } from "@/lib/server/env";
import { ago, initials, loadBuild, loadDirectory, maintainsOf } from "@/lib/directory";
import { ORUNBASE } from "@/lib/links";
import { ROLE_GUIDE, ROLE_LABEL } from "@/lib/roles";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;
type Search = Promise<{ error?: string; from?: string; reported?: string }>;

/** A small same-origin form for a toggle on this page; signed-out visitors go to sign in first. */
function Act({ action, fields, next, className, children, label }: { action: string; fields: Record<string, string>; next: string; className: string; children: React.ReactNode; label?: string }) {
  return (
    <form method="post" action="/act" className="act-form">
      <input type="hidden" name="action" value={action} />
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <input type="hidden" name="next" value={next} />
      <button type="submit" className={className} aria-label={label}>{children}</button>
    </form>
  );
}

/** "just now" or "3h ago". */
const when = (iso: string) => {
  const a = ago(iso);
  return a === "now" ? "just now" : `${a} ago`;
};

/** Drawn, not an emoji: some systems have no emoji font and show an empty box. */
function HandIcon() {
  return (
    <svg className="hand-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8" />
      <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
    </svg>
  );
}

function Hands({ hands }: { hands: Hand[] }) {
  if (!hands.length) return null;
  return (
    <p className="hands">
      <span className="muted">Raised a hand:</span>{" "}
      {hands.map((h, i) => (
        <span key={h.handle}>
          {i ? ", " : ""}
          <a className="link" href={`/builders/${encodeURIComponent(h.handle)}`}>{h.mine ? "you" : h.name}</a>
        </span>
      ))}
    </p>
  );
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  return { title: slug };
}

export default async function BuildPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { slug } = await params;
  const q = await searchParams;
  const [remote, db0, session0] = await Promise.all([loadBuild(slug), database(), currentSession()]);
  // Not on openproduct.live: a build listed here (list-your-build D1). A draft
  // is shown only to its maintainers; a hidden listing to nobody.
  let listing: Listing | null = null;
  let stats: ListingStats | null = null;
  let moderator = false;
  // `?from=here` shows this site's listing even when openproduct.live later took the slug (D1).
  if ((remote === null || remote === "unreachable" || q.from === "here") && db0) {
    const l = await getListing(db0, slug).catch(() => null);
    const mine = !!l && isMaintainer(l, session0?.account.id);
    // LB6: a hidden listing is a 404 to everyone but moderators.
    moderator = !!session0 && (await isModerator(db0, session0.account.id, moderatorsFor(await appEnv())).catch(() => false));
    if (l && (l.state === "published" || (mine && l.state !== "hidden") || (moderator && l.state === "hidden"))) {
      // LB2: the repo's numbers, refreshed here when an hour old (one repo, a few calls).
      stats = await statsOf(db0, l.slug).catch(() => null);
      if (isStale(stats)) stats = await refreshStats(db0, l.slug, l.repo, githubDepsFor(await appEnv())).catch(() => stats);
      // A repo gone private or deleted takes the listing down for everyone but its maintainers.
      if (stats?.status !== "missing" || mine) listing = l;
    }
  }
  const seats = listing && db0 ? await rolesOf(db0, listing.slug, { skills: listing.stack }).catch(() => []) : [];
  // LB4: the repo's contributors who are builders here, and how many others.
  const contributorsHere = listing && db0 && stats?.contributors.length ? await buildersByGithubLogins(db0, stats.contributors).catch(() => []) : [];
  const b = listing ? listingToDetail(listing, stats, seats) : q.from === "here" ? null : remote;
  if (b === null) {
    // LB6: a renamed listing's old address forwards for 30 days.
    const moved = db0 ? await redirectFor(db0, slug).catch(() => null) : null;
    if (moved) redirect(`/builds/${moved}`);
    notFound();
  }
  if (b === "unreachable") {
    return (
      <>
        <SiteHeader current="/" />
        <main className="wrap section">
          <div className="unreachable">
            This build could not be read just now. Try again in a minute.
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }
  const [dir, db, session] = [await loadDirectory(), db0, session0];
  const manage = listing && isMaintainer(listing, session?.account.id) ? listing : null;
  const me = session?.account.id ?? null;
  const none = { count: 0, mine: false };
  const [support, votes, follows, hands] = db
    ? await Promise.all([
        buildSupportLinks(db, b.slug, maintainsOf).catch(() => []),
        voteState(db, b.slug, me).catch(() => none),
        followState(db, "build", b.slug, me).catch(() => none),
        handsFor(db, b.slug, me).catch(() => new Map<string, Hand[]>()),
      ])
    : [[], none, none, new Map<string, Hand[]>()];
  const label = dir.ok ? (dir.topics.find((t) => t.value === b.category)?.label ?? b.category) : b.category;
  const here = `/builds/${b.slug}`;
  return (
    <>
      <SiteHeader current="/" />
      <main className="wrap">
        <nav className="crumbs" aria-label="Breadcrumb">
          <a href="/">Builds</a> <span>/</span> <span>{b.slug}</span>
        </nav>
        {listing?.state === "hidden" ? (
          <div className="listing-bar is-draft" role="status">
            <span><b>Hidden by a moderator.</b> Nobody else can see this build.</span>
            <form method="post" action="/list/write">
              <input type="hidden" name="action" value="listing-restore" />
              <input type="hidden" name="slug" value={listing.slug} />
              <button className="btn btn-ghost" type="submit">Restore</button>
            </form>
          </div>
        ) : null}
        {q.reported ? <p className="auth-ok" role="status">Thanks. A moderator will take a look.</p> : null}
        {manage && stats?.status === "missing" ? (
          <div className="listing-bar is-draft" role="alert">
            <span><b>We can&apos;t see the repo.</b> GitHub says {manage.repo} is private or gone, so this build is out of Open builds until it&apos;s public again.</span>
          </div>
        ) : null}
        {manage ? (
          <div className={`listing-bar${manage.state === "published" ? "" : " is-draft"}`} role="status">
            <span>
              {manage.state === "published" ? (
                <><b>Your listing is live.</b> Edit it, or take it back to a draft, from its settings.</>
              ) : (
                <><b>Draft: only you can see this.</b> {missingForPublish(manage).length ? `Still to do: ${missingForPublish(manage).join(", ").toLowerCase()}.` : "Ready to publish."}</>
              )}
            </span>
            <Link className="btn btn-dark" href={`/list/${manage.slug}`}>Listing settings</Link>
          </div>
        ) : null}
        <section className="build-head">
          <span className="tile-lg mono">{initials(b.slug)}</span>
          <div className="build-id">
            <div className="build-name">
              <h1>{b.slug}</h1>
              {label ? <span className="pill">{label}</span> : null}
              {b.licence ? <span className="pill mono">{b.licence}</span> : null}
              {b.archived ? <span className="pill">Archived</span> : null}
              {b.liveUrl ? <span className="pill live">● Live</span> : null}
            </div>
            <p className="build-tag">{b.tagline}</p>
            <div className="build-links">
              {b.repoUrl ? <a className="link" href={b.repoUrl}>{b.repoUrl.replace(/^https?:\/\//, "")}</a> : <span className="muted">No public repo linked yet</span>}
              {listing?.liveUrl ? <a className="link" href={listing.liveUrl} target="_blank" rel="noopener noreferrer nofollow">Open the live app ↗</a> : null}
              {b.publishedAt ? <span className="muted">listed {new Date(b.publishedAt).toISOString().slice(0, 10)}</span> : null}
            </div>
          </div>
          <div className="build-actions">
            <Act action="vote" fields={{ slug: b.slug }} next={here} className={`btn btn-ghost${votes.mine ? " is-on" : ""}`} label={votes.mine ? "Remove your upvote" : "Upvote"}>
              ⌃ {votes.mine ? "Upvoted" : "Upvote"} · {b.upvotes + votes.count}
            </Act>
            <Act action="follow" fields={{ kind: "build", key: b.slug }} next={here} className={`btn btn-ghost${follows.mine ? " is-on" : ""}`}>
              {follows.mine ? "✓ Following" : "Follow"}{follows.count ? ` · ${follows.count}` : ""}
            </Act>
            {listing && !listing.workspaceRef ? null : <a className="btn btn-accent" href={ORUNBASE}>Fork &amp; deploy</a>}
          </div>
        </section>

        <div className="build-grid">
          <div className="build-main">
            {listing ? (
              <div className="panel">
                {listing.coverKey ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="listing-cover" src={`/${listing.coverKey}`} alt={`${listing.slug}: cover image`} />
                ) : null}
                <div className="panel-head"><h2>About</h2><span className="pill">Listed here</span></div>
                <p style={{ margin: 0 }}>{listing.description ?? "The maintainers haven't written more yet."}</p>
                {listing.stack.length ? (
                  <div className="skills" style={{ marginTop: 12 }}>
                    <span className="muted">Stack</span>
                    {listing.stack.map((t) => <span key={t} className="skill mono">{t}</span>)}
                  </div>
                ) : null}
                {stats?.status === "ok" ? (
                  <p className="listing-activity">
                    <b>{stats.changes7d}</b> {stats.changes7d === 1 ? "commit" : "commits"} to the default branch in the last 7 days
                    {stats.lastCommitAt ? <> · last {when(stats.lastCommitAt)}</> : null}
                    {stats.languages.length ? <> · written in {stats.languages.join(", ")}</> : null}
                  </p>
                ) : null}
                <p className="sample-tag">Read from the repo on GitHub{stats ? `, ${when(stats.fetchedAt)}` : ""}. Nothing here is typed in by hand.</p>
              </div>
            ) : (
              <AppMap slug={b.slug} initials={initials(b.slug)} pieces={b.pieces} />
            )}

            {listing ? null : (
            <div className="panel">
              <div className="panel-head">
                <div>
                  <h2>Build log</h2>
                  <div className="sub">Written from merged PRs and deploys. The maker can pin a note on top.</div>
                </div>
                <span className="mono muted">{b.changes7d} changes · 7d</span>
              </div>
              <div className="pinned">
                <div className="kicker mono">PINNED BY THE MAKER</div>
                {b.pinned}
              </div>
              <ul className="log">
                {b.log.map((e, i) => (
                  <li key={i}>
                    <span className="mono muted">{e.ago}</span>
                    <span className={`tag tag-${e.kind}`}>{e.kind}</span>
                    <span>{e.text}</span>
                  </li>
                ))}
              </ul>
              <div className="sample-tag">Sample: the API has no build log yet.</div>
            </div>
            )}

            {b.pitch ? (
              <details className="panel pitch-panel" open={!!listing}>
                <summary className="panel-head">
                  <h2>The pitch</h2>
                  <span className="link">Read it</span>
                </summary>
                {listing ? (
                  <div className="pitch listing-pitch"><PostBody nodes={parseBody(b.pitch, { headings: true })} /></div>
                ) : (
                  <div className="pitch">{b.pitch}</div>
                )}
              </details>
            ) : null}
          </div>

          <aside className="build-side">
            {support.length ? (
              <div className="panel">
                <SupportLinks links={support} title={`Support ${b.slug}`} />
              </div>
            ) : null}
            {listing && !listing.workspaceRef ? null : (
            <div className="panel dark">
              <h2>Run your own copy</h2>
              <p>Fork to your GitHub and deploy to your own cloud on Orunbase. Your fork stays linked to {b.slug}.</p>
              <a className="btn btn-light" href={ORUNBASE}>Fork &amp; deploy on Orunbase</a>
            </div>
            )}

            <div className="panel" id="roles">
              <div className="panel-head">
                <h2>Open roles</h2>
                {b.roles.length ? <span className="count">{b.roles.length} open</span> : null}
              </div>
              {q.error ? <p className="auth-error" role="alert">{q.error.slice(0, 200)}</p> : null}
              {b.roles.length ? (
                <div className="roles">
                  {b.roles.map((r) => (
                    <div className="role" key={r.id}>
                      <span className={`role-type t-${r.type}`}>{ROLE_LABEL[r.type]}</span>
                      <strong>{r.title}</strong>
                      {r.description ? <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>{r.description}</p> : null}
                      <p className="role-guide"><b>A good first PR:</b> {ROLE_GUIDE[r.type].firstPr}</p>
                      {r.skills.length ? (
                        <div className="skills"><span className="muted">First PR in</span>{r.skills.map((s) => <span key={s} className="skill mono">{s}</span>)}</div>
                      ) : null}
                      {r.commitment ? <span className="muted" style={{ fontSize: 13 }}>{r.commitment}</span> : null}
                      <Hands hands={hands.get(r.id) ?? []} />
                      <div className="role-acts">
                        {b.repoUrl ? (
                          <a className="btn btn-dark role-claim" href={b.repoUrl} target="_blank" rel="noopener noreferrer">Claim with a PR →</a>
                        ) : null}
                        <Act
                          action="hand"
                          fields={{ slug: b.slug, role: r.id }}
                          next={`${here}#roles`}
                          className={`btn ${b.repoUrl ? "btn-ghost" : "btn-dark"} role-claim${(hands.get(r.id) ?? []).some((h) => h.mine) ? " is-on" : ""}`}
                        >
                          {(hands.get(r.id) ?? []).some((h) => h.mine) ? "✓ Hand raised" : <><HandIcon /> Raise your hand</>}
                        </Act>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted">No open roles right now.</p>
              )}
            </div>

            {listing ? (
              <div className="panel">
                <div className="panel-head"><h2>Builders</h2></div>
                <p className="builders-line">
                  <span className="muted">Maintained by </span>
                  {listing.maintainers.map((m, i) => (
                    <span key={m.accountId}>
                      {i ? ", " : ""}
                      {m.handle ? <Link className="link" href={`/builders/${m.handle}`}>@{m.handle}</Link> : "someone"}
                    </span>
                  ))}
                </p>
                {stats?.contributors.length ? (
                  <p className="builders-line">
                    <span className="muted">{stats.contributors.length} {stats.contributors.length === 1 ? "contributor" : "contributors"} on GitHub</span>
                    {contributorsHere.length ? (
                      <>
                        <span className="muted">, including </span>
                        {contributorsHere.map((c, i) => (
                          <span key={c.handle}>
                            {i ? ", " : ""}
                            <Link className="link" href={`/builders/${c.handle}`}>@{c.handle}</Link>
                          </span>
                        ))}
                      </>
                    ) : null}
                  </p>
                ) : null}
              </div>
            ) : null}
            {listing ? null : (
            <div className="panel">
              <div className="panel-head"><h2>Builders</h2></div>
              <p className="muted" style={{ margin: 0 }}>
                {b.maintainers ? `${b.maintainers} ${b.maintainers === 1 ? "maintainer" : "maintainers"}.` : "Maintainers and contributors are pulled from the repo once it is linked."} Join by opening a PR on any open role.
              </p>
            </div>
            )}

            {listing && session && listing.state === "published" && (!manage || moderator) ? (
              <div className="listing-report">
                {!manage ? (
                  <form method="post" action="/list/write">
                    <input type="hidden" name="action" value="report" />
                    <input type="hidden" name="slug" value={listing.slug} />
                    <button className="text-btn" type="submit">Report this build</button>
                  </form>
                ) : null}
                {moderator ? (
                  <form method="post" action="/list/write">
                    <input type="hidden" name="action" value="listing-hide" />
                    <input type="hidden" name="slug" value={listing.slug} />
                    <button className="text-btn danger" type="submit">Hide (moderator)</button>
                  </form>
                ) : null}
              </div>
            ) : null}

            <div className="panel">
              <div className="panel-head"><h2>Embed this build</h2></div>
              <p className="muted" style={{ marginTop: 0 }}>A live badge for your README that shows changes and open roles.</p>
              <span className="embed mono">
                <i className="brand-dot" /> openproduct · {b.changes7d} changes · {b.roles.length} roles
              </span>
            </div>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
