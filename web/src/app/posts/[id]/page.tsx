import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleMeta, VideoEmbed } from "@/components/article-card";
import { PostBody } from "@/components/post-body";
import { TopicChips } from "@/components/topic-chips";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TabBar } from "@/components/tab-bar";
import { getArticle, type Article } from "@/lib/auth/articles";
import { viewer, type Viewer } from "@/lib/auth/viewer";
import { database } from "@/lib/server/env";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;
type Search = Promise<{ published?: string; saved?: string; reported?: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const db = await database();
  const a = db ? await getArticle(db, id, { accountId: null, moderator: false }).catch(() => null) : null;
  return a ? { title: a.title, description: a.excerpt } : { title: "Post" };
}

/** Edit and delete for the author; report for others; hide or restore for moderators. */
function Actions({ a, v }: { a: Article; v: Viewer }) {
  if (!v.session) return null;
  return (
    <div className="post-actions article-actions">
      {a.mine ? (
        <>
          <Link className="text-btn" href={`/posts/new?edit=${a.id}`}>Edit</Link>
          <form method="post" action="/posts/write">
            <input type="hidden" name="action" value="delete" />
            <input type="hidden" name="id" value={a.id} />
            <button type="submit" className="text-btn danger">Delete</button>
          </form>
        </>
      ) : (
        <form method="post" action="/posts/write">
          <input type="hidden" name="action" value="report" />
          <input type="hidden" name="id" value={a.id} />
          <button type="submit" className="text-btn">Report</button>
        </form>
      )}
      {v.moderator ? (
        <form method="post" action="/posts/write">
          <input type="hidden" name="action" value={a.hidden ? "restore" : "hide"} />
          <input type="hidden" name="id" value={a.id} />
          <button type="submit" className="text-btn">{a.hidden ? "Restore" : "Hide"}</button>
        </form>
      ) : null}
    </div>
  );
}

export default async function ArticlePage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { id } = await params;
  const q = await searchParams;
  const v = await viewer();
  const a = v.db ? await getArticle(v.db, id, { accountId: v.session?.account.id ?? null, moderator: v.moderator }).catch(() => null) : null;
  if (!a) notFound();
  const edited = a.updatedAt !== a.createdAt;

  return (
    <>
      <SiteHeader current="/community" />
      <main className="wrap section article-page">
        <Link className="link" href={`/builders/${encodeURIComponent(a.authorHandle)}`}>← {a.author}</Link>
        {q.published ? <p className="auth-ok" role="status">Published. It&apos;s on your builder page and in the community feed.</p> : null}
        {q.saved ? <p className="auth-ok" role="status">Saved.</p> : null}
        {q.reported ? <p className="auth-ok" role="status">Thanks. A moderator will take a look.</p> : null}
        <header className="article-header">
          <h1>{a.title}</h1>
          <ArticleMeta a={a} withAuthor />
          <TopicChips topics={a.topics} />
          {edited ? <span className="muted article-edited">edited</span> : null}
          {a.hidden ? <span className="pill">Hidden</span> : null}
          <Actions a={a} v={v} />
        </header>
        {a.video ? <VideoEmbed video={a.video} title={a.title} /> : null}
        <div className="article-body">
          <PostBody nodes={a.body} />
        </div>
      </main>
      <SiteFooter />
      <TabBar current="/community" />
    </>
  );
}
