import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppMap } from "@/components/app-map";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SupportLinks } from "@/components/support-links";
import { buildSupportLinks } from "@/lib/auth/support";
import { followState, handsFor, voteState, type Hand } from "@/lib/auth/reactions";
import { currentSession } from "@/lib/auth/request";
import { database } from "@/lib/server/env";
import { initials, loadBuild, loadDirectory, maintainsOf } from "@/lib/directory";
import { ORUNBASE } from "@/lib/links";
import { ROLE_GUIDE, ROLE_LABEL } from "@/lib/roles";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;
type Search = Promise<{ error?: string }>;

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
  const b = await loadBuild(slug);
  if (b === null) notFound();
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
  const [dir, db, session] = await Promise.all([loadDirectory(), database(), currentSession()]);
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
        <section className="build-head">
          <span className="tile-lg mono">{initials(b.slug)}</span>
          <div className="build-id">
            <div className="build-name">
              <h1>{b.slug}</h1>
              {label ? <span className="pill">{label}</span> : null}
              {b.licence ? <span className="pill mono">{b.licence}</span> : null}
              {b.liveUrl ? <span className="pill live">● Live</span> : null}
            </div>
            <p className="build-tag">{b.tagline}</p>
            <div className="build-links">
              {b.repoUrl ? <a className="link" href={b.repoUrl}>{b.repoUrl.replace(/^https?:\/\//, "")}</a> : <span className="muted">No public repo linked yet</span>}
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
            <a className="btn btn-accent" href={ORUNBASE}>Fork &amp; deploy</a>
          </div>
        </section>

        <div className="build-grid">
          <div className="build-main">
            <AppMap slug={b.slug} initials={initials(b.slug)} pieces={b.pieces} />

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

            {b.pitch ? (
              <details className="panel pitch-panel">
                <summary className="panel-head">
                  <h2>The pitch</h2>
                  <span className="link">Read it</span>
                </summary>
                <div className="pitch">{b.pitch}</div>
              </details>
            ) : null}
          </div>

          <aside className="build-side">
            {support.length ? (
              <div className="panel">
                <SupportLinks links={support} title={`Support ${b.slug}`} />
              </div>
            ) : null}
            <div className="panel dark">
              <h2>Run your own copy</h2>
              <p>Fork to your GitHub and deploy to your own cloud on Orunbase. Your fork stays linked to {b.slug}.</p>
              <a className="btn btn-light" href={ORUNBASE}>Fork &amp; deploy on Orunbase</a>
            </div>

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

            <div className="panel">
              <div className="panel-head"><h2>Builders</h2></div>
              <p className="muted" style={{ margin: 0 }}>
                {b.maintainers ? `${b.maintainers} maintainers` : "Maintainers and contributors are pulled from the repo once it is linked."} Join by opening a PR on any open role.
              </p>
            </div>

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
