import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TabBar } from "@/components/tab-bar";
import { MAX_ARTICLE_BODY, MAX_ARTICLE_TITLE, getArticle } from "@/lib/auth/articles";
import { viewer } from "@/lib/auth/viewer";
import { watchUrl } from "@/lib/video";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Write a post", robots: { index: false } };

type Search = Promise<{ edit?: string; error?: string; title?: string; body?: string; video?: string; build?: string }>;

// The browser's first check; the server checks again (parseVideoUrl).
const VIDEO_PATTERN = String.raw`https?://(www\.|m\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com|vimeo\.com|player\.vimeo\.com|loom\.com)/.+`;

/** Write a new post, or edit one of yours with ?edit=<id>. */
export default async function WritePostPage({ searchParams }: { searchParams: Search }) {
  const q = await searchParams;
  const v = await viewer();
  const next = q.edit ? `/posts/new?edit=${encodeURIComponent(q.edit)}` : "/posts/new";
  if (!v.session) redirect(`/signin?next=${encodeURIComponent(next)}`);
  const editing = q.edit && v.db ? await getArticle(v.db, q.edit, { accountId: v.session.account.id, moderator: false }) : null;
  if (q.edit && !editing?.mine) notFound();

  const value = {
    title: q.title ?? editing?.title ?? "",
    body: q.body ?? editing?.source ?? "",
    video: q.video ?? (editing?.video ? watchUrl(editing.video) : ""),
    build: q.build ?? editing?.buildSlug ?? "",
  };

  return (
    <>
      <SiteHeader current="/community" />
      <main className="wrap section account-page">
        <Link className="link" href={editing ? `/posts/${editing.id}` : "/community"}>← {editing ? "Back to the post" : "Community"}</Link>
        <h1>{editing ? "Edit your post" : "Write a post"}</h1>
        <p className="sub">A build log, a demo, a lesson learned. Posts show on your builder page and in the community feed, with your video playing in place.</p>
        {!v.builder ? (
          <div className="panel account-section">
            <p>Posts live on your builder page, so start or claim it first.</p>
            <div className="account-actions">
              <Link className="btn btn-dark" href="/builders/new">Start your builder profile</Link>
              <Link className="btn btn-ghost" href="/builders">Find your profile to claim</Link>
            </div>
          </div>
        ) : (
          <>
            {q.error ? <p className="auth-error" role="alert">{q.error.slice(0, 200)}</p> : null}
            <form method="post" action="/posts/write" className="panel account-form">
              <input type="hidden" name="action" value={editing ? "update" : "create"} />
              {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
              <label>
                Title
                <input name="title" required maxLength={MAX_ARTICLE_TITLE} defaultValue={value.title} placeholder="How we moved our build from Vercel to Workers" />
              </label>
              <label>
                <span>Video <span className="muted">(optional)</span></span>
                <input name="video" type="url" inputMode="url" pattern={VIDEO_PATTERN} defaultValue={value.video} placeholder="https://www.youtube.com/watch?v=…" />
              </label>
              <p className="support-hint">YouTube, Vimeo or Loom. It plays right in the post.</p>
              <label>
                <span>About a build <span className="muted">(optional)</span></span>
                <input name="build" maxLength={64} pattern="[a-zA-Z0-9][a-zA-Z0-9\-]*" defaultValue={value.build} placeholder="the name after /builds/, like makan" />
              </label>
              <label>
                Post
                <textarea name="body" required rows={14} maxLength={MAX_ARTICLE_BODY} defaultValue={value.body} placeholder="What you built, what broke, what you'd do again. **bold**, *italic*, `code`, ```code blocks```, > quotes, lists and links work." />
              </label>
              <p className="support-hint">Publishing as <b>@{v.builder.handle}</b>. Anyone signed in can report a post.</p>
              <button className="btn btn-dark" type="submit">{editing ? "Save changes" : "Publish post"}</button>
            </form>
          </>
        )}
      </main>
      <SiteFooter />
      <TabBar current="/community" />
    </>
  );
}
