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
import { MAX_MAINTAINERS, teamOf } from "@/lib/auth/listing-team";
import { MAX_PITCH } from "@/lib/auth/listing-media";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Listing settings", robots: { index: false } };

type Params = Promise<{ slug: string }>;
type Search = Promise<{ error?: string; created?: string; saved?: string; verified?: string; unpublished?: string; seat?: string; team?: string; details?: string; renamed?: string }>;

const DETAILS_DONE: Record<string, string> = { saved: "Saved.", cover: "Cover uploaded.", "cover-removed": "Cover removed." };
const TEAM_DONE: Record<string, string> = { invited: "Invite sent. It waits on their account page until they accept.", removed: "Removed from the team.", owner: "They're an owner now." };
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
  const [seats, team] = v.db ? await Promise.all([rolesOf(v.db, l.slug, { withClosed: true }), teamOf(v.db, l.slug)]) : [[], []];
  const meOwner = team.some((m) => m.accountId === v.session!.account.id && m.role === "owner" && !m.pending);
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
        {q.renamed ? <p className="auth-ok" role="status">Renamed. The old address forwards here for 30 days.</p> : null}
        {l.state === "hidden" ? <p className="auth-error" role="status">A moderator has hidden this build. It&apos;s out of Open builds and nobody else can see its page.</p> : null}
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

        <section className="panel account-section" id="cover">
          <div className="panel-head">
            <div>
              <h2>Cover image</h2>
              <p className="sub">Shown on the build&apos;s card and page. PNG, JPEG or WebP, up to 2 MB; a screenshot of the app works well.</p>
            </div>
          </div>
          {q.details === "cover" || q.details === "cover-removed" ? <p className="auth-ok" role="status">{DETAILS_DONE[q.details]}</p> : null}
          {l.coverKey ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="cover-preview" src={`/${l.coverKey}`} alt={`${l.slug}: current cover`} />
          ) : (
            <p className="muted" style={{ margin: "0 0 10px" }}>No cover yet; the card shows the build&apos;s initials.</p>
          )}
          <div className="account-actions">
            <form method="post" action="/list/write" encType="multipart/form-data" className="cover-form">
              <input type="hidden" name="action" value="cover" />
              <input type="hidden" name="slug" value={l.slug} />
              <input type="file" name="cover" accept="image/png,image/jpeg,image/webp" required />
              <button className="btn btn-ghost" type="submit">{l.coverKey ? "Replace cover" : "Upload cover"}</button>
            </form>
            {l.coverKey ? (
              <form method="post" action="/list/write">
                <input type="hidden" name="action" value="cover-remove" />
                <input type="hidden" name="slug" value={l.slug} />
                <button className="text-btn danger" type="submit">Remove</button>
              </form>
            ) : null}
          </div>
        </section>

        <section className="panel account-section" id="details">
          <div className="panel-head">
            <div>
              <h2>Pitch and links</h2>
              <p className="sub">The pitch is your own words on the build page: what it is, who it&apos;s for, where it&apos;s going.</p>
            </div>
          </div>
          {q.details === "saved" ? <p className="auth-ok" role="status">Saved.</p> : null}
          <form method="post" action="/list/write" className="account-form">
            <input type="hidden" name="action" value="details" />
            <input type="hidden" name="slug" value={l.slug} />
            <label>
              <span>Pitch <span className="muted">(optional)</span></span>
              <textarea name="pitch" rows={8} maxLength={MAX_PITCH} defaultValue={l.pitch ?? ""} placeholder="## Why\nWhat problem it solves, for whom. **bold**, *italic*, lists and links work." />
            </label>
            <label>
              <span>Live app <span className="muted">(optional)</span></span>
              <input name="live_url" type="url" inputMode="url" defaultValue={l.liveUrl ?? ""} placeholder="https://your-build.app" />
            </label>
            <label>
              <span>Orunbase workspace <span className="muted">(optional; adds &ldquo;Fork &amp; deploy on Orunbase&rdquo;)</span></span>
              <input name="workspace_ref" defaultValue={l.workspaceRef ?? ""} placeholder="ws_ABC12345" pattern="(org|ws)_[A-Za-z0-9]{6,40}" />
            </label>
            <button className="btn btn-ghost" type="submit">Save</button>
          </form>
        </section>

        <section className="panel account-section" id="team">
          <div className="panel-head">
            <div>
              <h2>Team</h2>
              <p className="sub">Maintainers edit the listing, its seats and its support links, and the build shows on their profiles. Contributors come from the repo on GitHub by themselves.</p>
            </div>
          </div>
          {q.team && TEAM_DONE[q.team] ? <p className="auth-ok" role="status">{TEAM_DONE[q.team]}</p> : null}
          <ul className="team-list">
            {team.map((m) => {
              const self = m.accountId === v.session!.account.id;
              return (
                <li key={m.accountId}>
                  <span>
                    {m.handle ? <Link className="link" href={`/builders/${m.handle}`}>{m.name}</Link> : <span>Someone</span>}
                    {self ? <span className="muted"> (you)</span> : null}
                  </span>
                  <span className={`pill${m.role === "owner" ? " live" : ""}`}>{m.pending ? "Invited" : m.role === "owner" ? "Owner" : "Maintainer"}</span>
                  <span className="team-acts">
                    {meOwner && !self && !m.pending && m.role !== "owner" ? (
                      <form method="post" action="/list/write">
                        <input type="hidden" name="action" value="make-owner" />
                        <input type="hidden" name="slug" value={l.slug} />
                        <input type="hidden" name="member" value={m.accountId} />
                        <button className="text-btn" type="submit">Make owner</button>
                      </form>
                    ) : null}
                    {self || meOwner ? (
                      <form method="post" action="/list/write">
                        <input type="hidden" name="action" value="remove" />
                        <input type="hidden" name="slug" value={l.slug} />
                        <input type="hidden" name="member" value={m.accountId} />
                        <button className="text-btn danger" type="submit">{self ? "Leave" : m.pending ? "Cancel invite" : "Remove"}</button>
                      </form>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
          {team.length < MAX_MAINTAINERS ? (
            <form method="post" action="/list/write" className="account-actions invite-form">
              <input type="hidden" name="action" value="invite" />
              <input type="hidden" name="slug" value={l.slug} />
              <label>
                <span className="sr-only">Builder handle</span>
                <input name="handle" required maxLength={31} placeholder="@their-handle" />
              </label>
              <button className="btn btn-ghost" type="submit">Invite a maintainer</button>
            </form>
          ) : null}
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
        {meOwner ? (
          <section className="panel account-section danger-zone" id="danger">
            <h2>Rename or delete</h2>
            <form method="post" action="/list/write" className="account-form">
              <input type="hidden" name="action" value="rename" />
              <input type="hidden" name="slug" value={l.slug} />
              <label>
                <span>New name</span>
                <input name="new_slug" required maxLength={40} pattern="[a-zA-Z0-9][a-zA-Z0-9\-]*" placeholder={l.slug} />
              </label>
              <p className="support-hint">Upvotes, follows, raised hands and support links move with it, and /builds/{l.slug} forwards to the new name for 30 days.</p>
              <button className="btn btn-ghost" type="submit">Rename</button>
            </form>
            <form method="post" action="/list/write" className="account-form">
              <input type="hidden" name="action" value="delete" />
              <input type="hidden" name="slug" value={l.slug} />
              <label>
                <span>Type <b>{l.slug}</b> to delete this listing</span>
                <input name="confirm" required autoComplete="off" />
              </label>
              <p className="support-hint">Deletes the listing, its seats, its cover and everything people left on it here. The repo on GitHub isn&apos;t touched.</p>
              <button className="btn btn-danger" type="submit">Delete the listing</button>
            </form>
          </section>
        ) : null}
      </main>
      <SiteFooter />
      <TabBar current="/" />
    </>
  );
}
