import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PostBody } from "@/components/post-body";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TabBar } from "@/components/tab-bar";
import { ago } from "@/lib/directory";
import { TAG_LABELS, loadThread, type Post } from "@/lib/forum";
import { OPENPRODUCT } from "@/lib/links";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const found = await loadThread(id);
  return { title: found && found !== "unreachable" ? found.thread.title : "Thread" };
}

function Author({ name, handle }: { name: string | null; handle: string | null }) {
  if (handle) return <Link className="post-author" href={`/people/${encodeURIComponent(handle)}`}>{name ?? handle}</Link>;
  return <span className="post-author">{name ?? "Someone"}</span>;
}

function PostItem({ post, reply }: { post: Post; reply?: boolean }) {
  return (
    <article className={`post${reply ? " reply" : ""}`}>
      <div className="post-head">
        <Author name={post.author} handle={post.authorHandle} />
        <span className="muted">{ago(post.createdAt)} ago</span>
      </div>
      <PostBody nodes={post.body} />
    </article>
  );
}

export default async function ThreadPage({ params }: { params: Params }) {
  const { id } = await params;
  const found = await loadThread(id);
  if (found === null) notFound();
  return (
    <>
      <SiteHeader current="/community" />
      <main className="wrap section thread-page">
        <Link className="link" href="/community">← All threads</Link>
        {found === "unreachable" ? (
          <div className="unreachable" style={{ marginTop: 16 }}>This thread could not be loaded just now. Try again in a minute.</div>
        ) : (
          <>
            <header className="thread-header">
              {found.thread.slug ? (
                <Link className="thread-where mono" href={`/builds/${found.thread.slug}`}>p/{found.thread.slug}</Link>
              ) : null}
              <h1>{found.thread.title}</h1>
              <div className="thread-meta">
                <span className="thread-tag">{TAG_LABELS[found.thread.tag] ?? found.thread.tag}</span>
                <span>{found.thread.replies} {found.thread.replies === 1 ? "post" : "posts"}</span>
                <span>started {ago(found.thread.createdAt)} ago</span>
                {found.thread.state === "answered" ? <span className="thread-answered">Answered</span> : null}
                {found.thread.state === "locked" ? <span>Locked</span> : null}
              </div>
            </header>
            <div className="posts">
              {found.posts
                .filter((p) => !p.parentId)
                .map((p) => (
                  <div key={p.id} className="post-group">
                    <PostItem post={p} />
                    {found.posts.filter((r) => r.parentId === p.id).map((r) => <PostItem key={r.id} post={r} reply />)}
                  </div>
                ))}
            </div>
            {found.thread.state !== "locked" ? (
              <a className="btn btn-ghost" href={OPENPRODUCT}>Reply on openproduct.live</a>
            ) : null}
          </>
        )}
      </main>
      <SiteFooter />
      <TabBar current="/community" />
    </>
  );
}
