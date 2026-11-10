import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TabBar } from "@/components/tab-bar";
import { viewer } from "@/lib/auth/viewer";
import { MAX_POST_BODY, MAX_THREAD_TITLE } from "@/lib/body";
import { TAG_LABELS, THREAD_TAGS, parseTag } from "@/lib/forum";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Start a discussion", robots: { index: false } };

type Search = Promise<{ error?: string; tag?: string; title?: string; topics?: string; topic?: string; kind?: string }>;

export default async function NewThreadPage({ searchParams }: { searchParams: Search }) {
  const q = await searchParams;
  const v = await viewer();
  if (!v.session) redirect("/signin?next=/community/new");
  const tag = parseTag(q.tag) ?? "question";

  return (
    <>
      <SiteHeader current="/community" />
      <main className="wrap section account-page">
        <Link className="link" href="/community">← Community</Link>
        <h1>Start a discussion</h1>
        <p className="sub">Ask a question, share a design, or argue for a better way. Threads here aren&apos;t tied to one build.</p>
        {!v.builder ? (
          <div className="panel account-section">
            <p>To post, start or claim your builder profile first, so people know who&apos;s talking.</p>
            <div className="account-actions">
              <Link className="btn btn-dark" href="/builders/new">Start your builder profile</Link>
              <Link className="btn btn-ghost" href="/builders">Find your profile to claim</Link>
            </div>
          </div>
        ) : (
          <>
            {q.error ? <p className="auth-error" role="alert">{q.error.slice(0, 200)}</p> : null}
            <form method="post" action="/community/post" className="panel account-form">
              <input type="hidden" name="action" value="thread" />
              <fieldset className="tag-picker kind-picker">
                <legend>Is it a discussion, or an issue?</legend>
                <label>
                  <input type="radio" name="kind" value="discussion" defaultChecked={q.kind !== "issue"} />
                  <span><b>Discussion</b> <span className="muted">A question, an idea, a debate.</span></span>
                </label>
                <label>
                  <input type="radio" name="kind" value="issue" defaultChecked={q.kind === "issue"} />
                  <span><b>Issue</b> <span className="muted">Something&apos;s broken or unclear. Mark the reply that fixes it.</span></span>
                </label>
              </fieldset>
              <fieldset className="tag-picker">
                <legend>Category</legend>
                {THREAD_TAGS.map((t) => (
                  <label key={t}>
                    <input type="radio" name="tag" value={t} defaultChecked={t === tag} />
                    <span>{TAG_LABELS[t]}</span>
                  </label>
                ))}
              </fieldset>
              <label>
                Title
                <input name="title" required maxLength={MAX_THREAD_TITLE} defaultValue={q.title ?? ""} placeholder="Vercel vs Cloudflare for a side project that might grow up" />
              </label>
              <label>
                <span>Topics <span className="muted">(up to 5, comma-separated)</span></span>
                <input name="topics" defaultValue={q.topics ?? q.topic ?? ""} placeholder="cloudflare-workers, pricing" maxLength={200} />
              </label>
              <label>
                Opening post
                <textarea name="body" required rows={9} maxLength={MAX_POST_BODY} placeholder="Say what you're weighing and why. **bold**, *italic*, `code`, lists and links work." />
              </label>
              <p className="support-hint">Posting as <b>@{v.builder.handle}</b>. Be kind; anyone can report a post.</p>
              <button className="btn btn-dark" type="submit">Post discussion</button>
            </form>
          </>
        )}
      </main>
      <SiteFooter />
      <TabBar current="/community" />
    </>
  );
}
