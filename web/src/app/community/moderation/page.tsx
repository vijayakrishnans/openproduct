import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { openReports } from "@/lib/auth/discussions";
import { viewer } from "@/lib/auth/viewer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Moderation", robots: { index: false } };

/** Reported threads and posts, for moderators. Everyone else gets a 404. */
export default async function ModerationPage() {
  const v = await viewer();
  if (!v.session) redirect("/signin?next=/community/moderation");
  if (!v.moderator || !v.db) notFound();
  const reports = await openReports(v.db);

  return (
    <>
      <SiteHeader current="/community" />
      <main className="wrap section account-page">
        <Link className="link" href="/community">← Community</Link>
        <h1>Moderation</h1>
        <p className="sub">Open reports on threads, replies and builder posts, most reported first. Hiding resolves a report; a hidden post can be restored from its thread.</p>
        {reports.length === 0 ? (
          <div className="unreachable">No open reports.</div>
        ) : (
          reports.map((r) => (
            <section key={`${r.kind}:${r.id}`} className="panel account-section">
              <div className="panel-head">
                <div>
                  <h2>
                    <Link href={r.href}>{r.title || "(untitled)"}</Link>
                  </h2>
                  <p className="sub">
                    {r.kind === "thread" ? "The whole thread" : r.kind === "article" ? "A builder's post" : "A reply"} · {r.reports} {r.reports === 1 ? "report" : "reports"}
                    {r.hidden ? " · hidden" : ""}
                  </p>
                </div>
              </div>
              {r.excerpt ? <p className="mod-excerpt">{r.excerpt}</p> : null}
              {r.reasons.length ? <ul className="mod-reasons">{r.reasons.map((x, i) => <li key={i}>{x}</li>)}</ul> : null}
              <form method="post" action={r.kind === "article" ? "/posts/write" : "/community/post"} className="account-actions">
                {r.kind === "article" ? (
                  <input type="hidden" name="id" value={r.id} />
                ) : (
                  <>
                    <input type="hidden" name="thread" value={r.threadId ?? ""} />
                    <input type="hidden" name="kind" value={r.kind} />
                    {r.kind === "post" ? <input type="hidden" name="post" value={r.id} /> : null}
                  </>
                )}
                <input type="hidden" name="from" value="moderation" />
                <button className="btn btn-danger" type="submit" name="action" value="hide">Hide</button>
                <button className="btn btn-ghost" type="submit" name="action" value="restore">Keep it up</button>
              </form>
            </section>
          ))
        )}
      </main>
      <SiteFooter />
    </>
  );
}
