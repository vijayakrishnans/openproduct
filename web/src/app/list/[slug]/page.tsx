import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TabBar } from "@/components/tab-bar";
import { getListing, isMaintainer, MAX_TAGLINE, missingForPublish, VERIFY_FILE } from "@/lib/auth/listings";
import { viewer } from "@/lib/auth/viewer";
import { loadDirectory } from "@/lib/directory";
import { MAX_ROLE_COMMITMENT, MAX_ROLE_DESCRIPTION, MAX_ROLE_TITLE, MAX_ROLES, rolesOf, type ListingRole } from "@/lib/auth/listing-roles";
import { ROLE_LABEL, ROLE_TYPES } from "@/lib/roles";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Listing settings", robots: { index: false } };

type Params = Promise<{ slug: string }>;
type Search = Promise<{ error?: string; created?: string; saved?: string; verified?: string; unpublished?: string; seat?: string }>;

const SEAT_DONE: Record<string, string> = { added: "Seat added.", saved: "Seat saved.", closed: "Seat closed.", reopened: "Seat reopened." };

/** The fields of a seat, for adding one or editing it. */
function SeatFields({ role }: { role?: ListingRole }) {
  return (
    <>
      <label>
        <span>Title</span>
        <input name="title" required maxLength={MAX_ROLE_TITLE} defaultValue={role?.title ?? ""} placeholder="Frontend engineer, Design partner, Growth lead…" />
      </label>
      <label>
        <span>Kind of seat</span>
        <select name="type" defaultValue={role?.type ?? ""}>
          <option value="">Work it out from the title</option>
          {ROLE_TYPES.map((t) => <option key={t} value={t}>{ROLE_LABEL[t]}</option>)}
        </select>
      </label>
      <label>
        <span>What it involves <span className="muted">(optional)</span></span>
        <textarea name="description" rows={3} maxLength={MAX_ROLE_DESCRIPTION} defaultValue={role?.description ?? ""} />
      </label>
      <label>
        <span>Time <span className="muted">(optional)</span></span>
        <input name="commitment" maxLength={MAX_ROLE_COMMITMENT} defaultValue={role?.commitment ?? ""} placeholder="A few hours a week" />
      </label>
    </>
  );
}

/** A listing's settings: proof of control, the fields, and publishing (LB1). Maintainers only. */
export default async function ListingSettings({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { slug } = await params;
  const q = await searchParams;
  const v = await viewer();
  if (!v.session) redirect(`/signin?next=${encodeURIComponent(`/list/${slug}`)}`);
  const l = v.db ? await getListing(v.db, slug) : null;
  if (!l || !isMaintainer(l, v.session.account.id)) notFound();
  const dir = await loadDirectory();
  const topics = dir.ok ? dir.topics : [];
  const missing = missingForPublish(l);
  const seats = v.db ? await rolesOf(v.db, l.slug, { withClosed: true }) : [];
  const fileUrl = `https://github.com/${l.repo}/new/HEAD?filename=${encodeURIComponent(VERIFY_FILE)}&value=${encodeURIComponent(l.verifyCode)}`;

  return (
    <>
      <SiteHeader current="/" />
      <main className="wrap section account-page list-settings">
        <Link className="link" href={`/builds/${l.slug}`}>← {l.state === "published" ? "View the build" : "Preview the draft"}</Link>
        <h1>{l.slug}</h1>
        <p className="sub">
          <a className="link" href={`https://github.com/${l.repo}`} target="_blank" rel="noopener noreferrer">github.com/{l.repo}</a>
          {" · "}
          <span className={`pill${l.state === "published" ? " live" : ""}`}>{l.state === "published" ? "● Published" : "Draft"}</span>
        </p>
        {q.created ? <p className="auth-ok" role="status">Listing created as a draft.{l.verified ? " You own the repo on GitHub, so it's verified already." : ""}</p> : null}
        {q.verified ? <p className="auth-ok" role="status">Verified. You can delete the {VERIFY_FILE} file now.</p> : null}
        {q.saved ? <p className="auth-ok" role="status">Saved.</p> : null}
        {q.unpublished ? <p className="auth-ok" role="status">Back to a draft. Only maintainers can see it.</p> : null}
        {q.error ? <p className="auth-error" role="alert">{q.error.slice(0, 300)}</p> : null}

        <section className="panel account-section">
          <div className="panel-head">
            <div>
              <h2>{l.verified ? "✓ You control this repo" : "Prove you control the repo"}</h2>
              <p className="sub">
                {l.verified
                  ? "Verified. Nobody else can list this repo."
                  : "Add a file named .openproduct to the repo's default branch, holding the code below. Only someone who can push to the repo can do that."}
              </p>
            </div>
          </div>
          {l.verified ? null : (
            <>
              <div className="verify-code">
                <span className="muted">File</span> <code>{VERIFY_FILE}</code>
                <span className="muted">Contents</span> <code>{l.verifyCode}</code>
              </div>
              <div className="account-actions">
                <a className="btn btn-ghost" href={fileUrl} target="_blank" rel="noopener noreferrer">Create the file on GitHub</a>
                <form method="post" action="/list/write">
                  <input type="hidden" name="action" value="verify" />
                  <input type="hidden" name="slug" value={l.slug} />
                  <button className="btn btn-dark" type="submit">Check again</button>
                </form>
              </div>
              <p className="support-hint">Signed in with the GitHub account that owns {l.repo.split("/")[0]}? &ldquo;Check again&rdquo; verifies you without the file.</p>
            </>
          )}
        </section>

        <section className="panel account-section">
          <h2>What people see</h2>
          <form method="post" action="/list/write" className="account-form">
            <input type="hidden" name="action" value="update" />
            <input type="hidden" name="slug" value={l.slug} />
            <label>
              <span>Tagline</span>
              <input name="tagline" maxLength={MAX_TAGLINE} defaultValue={l.tagline ?? ""} placeholder="What it does, in one line" />
            </label>
            <label>
              <span>Category</span>
              <select name="category" defaultValue={l.category ?? ""}>
                <option value="">Pick one</option>
                {topics.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>
            <label>
              <span>Stack <span className="muted">(comma-separated)</span></span>
              <input name="stack" defaultValue={l.stack.join(", ")} />
            </label>
            <button className="btn btn-ghost" type="submit">Save</button>
          </form>
        </section>

        <section className="panel account-section" id="seats">
          <div className="panel-head">
            <div>
              <h2>Open seats</h2>
              <p className="sub">The people you&apos;re looking for. Seats show on the build page, on Open roles and on the home page, and builders can raise a hand for one.</p>
            </div>
          </div>
          {q.seat && SEAT_DONE[q.seat] ? <p className="auth-ok" role="status">{SEAT_DONE[q.seat]}</p> : null}
          {seats.length ? (
            <ul className="seat-admin">
              {seats.map((r) => (
                <li key={r.id} className={r.open ? "" : "is-closed"}>
                  <details>
                    <summary>
                      <span className={`role-type t-${r.type}`}>{ROLE_LABEL[r.type]}</span>
                      <strong>{r.title}</strong>
                      {r.open ? null : <span className="pill">Closed</span>}
                      <span className="link seat-edit">Edit</span>
                    </summary>
                    <form method="post" action="/list/write" className="account-form">
                      <input type="hidden" name="action" value="role-update" />
                      <input type="hidden" name="slug" value={l.slug} />
                      <input type="hidden" name="role" value={r.id} />
                      <SeatFields role={r} />
                      <button className="btn btn-ghost" type="submit">Save seat</button>
                    </form>
                  </details>
                  <form method="post" action="/list/write">
                    <input type="hidden" name="action" value={r.open ? "role-close" : "role-reopen"} />
                    <input type="hidden" name="slug" value={l.slug} />
                    <input type="hidden" name="role" value={r.id} />
                    <button className="text-btn" type="submit">{r.open ? "Close" : "Reopen"}</button>
                  </form>
                </li>
              ))}
            </ul>
          ) : null}
          {seats.length < MAX_ROLES ? (
            <details className="seat-add" open={seats.length === 0}>
              <summary className="btn btn-ghost">+ Add a seat</summary>
              <form method="post" action="/list/write" className="account-form">
                <input type="hidden" name="action" value="role-add" />
                <input type="hidden" name="slug" value={l.slug} />
                <SeatFields />
                <button className="btn btn-dark" type="submit">Add the seat</button>
              </form>
            </details>
          ) : null}
        </section>

        <section className="panel account-section">
          <h2>{l.state === "published" ? "Published" : "Publish"}</h2>
          {l.state === "published" ? (
            <form method="post" action="/list/write" className="account-actions">
              <input type="hidden" name="action" value="unpublish" />
              <input type="hidden" name="slug" value={l.slug} />
              <p className="sub" style={{ margin: 0 }}>It&apos;s in Open builds now.</p>
              <button className="btn btn-ghost" type="submit">Back to a draft</button>
            </form>
          ) : (
            <form method="post" action="/list/write" className="account-actions">
              <input type="hidden" name="action" value="publish" />
              <input type="hidden" name="slug" value={l.slug} />
              <p className="sub" style={{ margin: 0 }}>{missing.length ? `Still to do: ${missing.join(", ").toLowerCase()}.` : "Ready. It goes into Open builds straight away."}</p>
              <button className="btn btn-dark" type="submit" disabled={missing.length > 0}>Publish</button>
            </form>
          )}
        </section>
      </main>
      <SiteFooter />
      <TabBar current="/" />
    </>
  );
}
