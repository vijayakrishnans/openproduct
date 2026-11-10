import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TabBar } from "@/components/tab-bar";
import { MAX_STACK, MAX_TAGLINE } from "@/lib/auth/listings";
import { viewer } from "@/lib/auth/viewer";
import { loadDirectory } from "@/lib/directory";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "List your build" };

type Search = Promise<{ error?: string; repo?: string; name?: string; tagline?: string; category?: string; stack?: string }>;

const STEPS = [
  { n: "1", title: "Point at the repo", body: "Any public GitHub repo. Private ones can't be listed." },
  { n: "2", title: "Prove it's yours", body: "Signed in with the GitHub account that owns it? That's it. Otherwise, add a small file we give you." },
  { n: "3", title: "Publish", body: "Add a tagline and a category, and it's in Open builds. Its numbers come from the repo." },
];

/** Start a listing (list-your-build LB1). */
export default async function ListPage({ searchParams }: { searchParams: Search }) {
  const q = await searchParams;
  const v = await viewer();
  if (!v.session) redirect("/signin?next=/list");
  const dir = await loadDirectory();
  const topics = dir.ok ? dir.topics : [];

  return (
    <>
      <SiteHeader current="/" />
      <main className="wrap section list-page">
        <span className="chip">LIST YOUR BUILD</span>
        <h1>Put your build in front of builders</h1>
        <p className="sub">Free. Your build sits in Open builds next to everyone else&apos;s, and people can upvote it, follow it and raise a hand for its open seats.</p>
        <ol className="roles-steps list-steps">
          {STEPS.map((s) => (
            <li key={s.n}>
              <span className="step-n mono">{s.n}</span>
              <strong>{s.title}</strong>
              <span>{s.body}</span>
            </li>
          ))}
        </ol>
        {!v.builder ? (
          <div className="panel account-section">
            <p>Every build here has a builder behind it. Start or claim your builder profile first.</p>
            <div className="account-actions">
              <Link className="btn btn-dark" href="/builders/new">Start your builder profile</Link>
              <Link className="btn btn-ghost" href="/builders">Find your profile to claim</Link>
            </div>
          </div>
        ) : (
          <>
            {q.error ? <p className="auth-error" role="alert">{q.error.slice(0, 300)}</p> : null}
            <form method="post" action="/list/write" className="panel account-form list-form">
              <input type="hidden" name="action" value="create" />
              <label>
                <span>GitHub repo</span>
                <input name="repo" required defaultValue={q.repo ?? ""} placeholder="github.com/you/your-build" autoComplete="off" />
              </label>
              <label>
                <span>Name <span className="muted">(optional; we&apos;ll use the repo&apos;s)</span></span>
                <input name="name" defaultValue={q.name ?? ""} maxLength={40} pattern="[a-zA-Z0-9][a-zA-Z0-9\-]*" placeholder="your-build" />
              </label>
              <p className="support-hint">Your build&apos;s address will be /builds/name. Letters, numbers and hyphens.</p>
              <label>
                <span>Tagline <span className="muted">(you can add it later)</span></span>
                <input name="tagline" maxLength={MAX_TAGLINE} defaultValue={q.tagline ?? ""} placeholder="What it does, in one line" />
              </label>
              <label>
                <span>Category <span className="muted">(you can pick it later)</span></span>
                <select name="category" defaultValue={q.category ?? ""}>
                  <option value="">Pick one</option>
                  {topics.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>
              <label>
                <span>Stack <span className="muted">(up to {MAX_STACK}, comma-separated; we&apos;ll suggest from the repo)</span></span>
                <input name="stack" defaultValue={q.stack ?? ""} placeholder="typescript, workers, nextjs" />
              </label>
              <p className="support-hint">Listing as <b>@{v.builder.handle}</b>. It starts as a draft only you can see.</p>
              <button className="btn btn-dark" type="submit">Create the listing</button>
            </form>
          </>
        )}
      </main>
      <SiteFooter />
      <TabBar current="/" />
    </>
  );
}
