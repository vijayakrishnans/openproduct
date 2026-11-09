import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppMap } from "@/components/app-map";
import { McpPanel } from "@/components/mcp-panel";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { initials, loadBuild, loadDirectory } from "@/lib/directory";
import { OPENPRODUCT, ORUNBASE } from "@/lib/links";
import { ROLE_GUIDE, ROLE_LABEL } from "@/lib/roles";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  return { title: slug };
}

export default async function BuildPage({ params }: { params: Params }) {
  const { slug } = await params;
  const b = await loadBuild(slug);
  if (b === null) notFound();
  if (b === "unreachable") {
    return (
      <>
        <SiteHeader current="/" />
        <main className="wrap section">
          <div className="unreachable">
            This build could not be read just now. It is listed at{" "}
            <a className="link" href={`${OPENPRODUCT}/${slug}`}>openproduct.live/{slug}</a>.
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }
  const dir = await loadDirectory();
  const label = dir.ok ? (dir.topics.find((t) => t.value === b.category)?.label ?? b.category) : b.category;
  const listing = `${OPENPRODUCT}/${b.slug}`;
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
              <a className="link" href={listing}>Public listing on openproduct.live</a>
              {b.publishedAt ? <span className="muted">listed {new Date(b.publishedAt).toISOString().slice(0, 10)}</span> : null}
            </div>
          </div>
          <div className="build-actions">
            <a className="btn btn-ghost" href={listing}>⌃ Upvote · {b.upvotes}</a>
            <a className="btn btn-ghost" href={listing}>Follow</a>
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

            <McpPanel slug={b.slug} />

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
                      <a className="btn btn-dark role-claim" href={b.repoUrl ?? listing} target="_blank" rel="noopener noreferrer">
                        {b.repoUrl ? "Claim with a PR" : "Claim this seat"} →
                      </a>
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
