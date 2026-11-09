import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PostBody } from "@/components/post-body";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TabBar } from "@/components/tab-bar";
import { getLocalThread, type LocalPost } from "@/lib/auth/discussions";
import { viewer, type Viewer } from "@/lib/auth/viewer";
import { MAX_POST_BODY } from "@/lib/body";
import { ago } from "@/lib/directory";
import { TAG_LABELS, loadThread, type Post } from "@/lib/forum";
import { OPENPRODUCT } from "@/lib/links";
import { database } from "@/lib/server/env";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;
type Search = Promise<{ error?: string; reported?: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const db = await database();
  const local = db ? await getLocalThread(db, id, { accountId: null, moderator: false }).catch(() => null) : null;
  if (local) return { title: local.thread.title };
  const found = await loadThread(id);
  return { title: found && found !== "unreachable" ? found.thread.title : "Thread" };
}

function Author({ name, handle }: { name: string | null; handle: string | null }) {
  if (handle) return <Link className="post-author" href={`/builders/${encodeURIComponent(handle)}`}>{name ?? handle}</Link>;
  return <span className="post-author">{name ?? "Someone"}</span>;
}

/** Report, and for moderators hide or restore: small forms, no script needed. */
function PostActions({ threadId, post, kind, v }: { threadId: string; post?: LocalPost; kind: "thread" | "post"; v: Viewer }) {
  if (!v.session) return null;
  const hidden = kind === "post" ? post?.hidden : false;
  return (
    <div className="post-actions">
      {!post?.mine ? (
        <form method="post" action="/community/post">
          <input type="hidden" name="action" value="report" />
          <input type="hidden" name="thread" value={threadId} />
          <input type="hidden" name="kind" value={kind} />
          {post ? <input type="hidden" name="post" value={post.id} /> : null}
          <button type="submit" className="text-btn">Report</button>
        </form>
      ) : null}
      {v.moderator ? (
        <form method="post" action="/community/post">
          <input type="hidden" name="action" value={hidden ? "restore" : "hide"} />
          <input type="hidden" name="thread" value={threadId} />
          <input type="hidden" name="kind" value={kind} />
          {post ? <input type="hidden" name="post" value={post.id} /> : null}
          <button type="submit" className="text-btn">{hidden ? "Restore" : kind === "thread" ? "Hide thread" : "Hide"}</button>
        </form>
      ) : null}
    </div>
  );
}

function PostItem({ post, reply, children }: { post: Post | LocalPost; reply?: boolean; children?: React.ReactNode }) {
  const hidden = "hidden" in post && post.hidden;
  return (
    <article className={`post${reply ? " reply" : ""}${hidden ? " is-hidden" : ""}`} id={`p-${post.id}`}>
      <div className="post-head">
        <Author name={post.author} handle={post.authorHandle} />
        <span className="muted">{ago(post.createdAt)} ago</span>
        {hidden ? <span className="pill">Hidden</span> : null}
      </div>
      <PostBody nodes={post.body} />
      {children}
    </article>
  );
}

export default async function ThreadPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { id } = await params;
  const q = await searchParams;
  const v = await viewer();
  const local = v.db ? await getLocalThread(v.db, id, { accountId: v.session?.account.id ?? null, moderator: v.moderator }).catch(() => null) : null;
  const found = local ?? (await loadThread(id));
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
                {local?.thread.hidden ? <span className="pill">Hidden</span> : null}
              </div>
              {local ? <PostActions threadId={id} kind="thread" v={v} /> : null}
            </header>
            {q.reported ? <p className="auth-ok" role="status">Thanks. A moderator will take a look.</p> : null}

            {local ? (
              <>
                <div className="posts">
                  {local.posts.map((p) => (
                    <PostItem key={p.id} post={p}>
                      <PostActions threadId={id} post={p} kind="post" v={v} />
                    </PostItem>
                  ))}
                </div>
                <section id="reply" className="reply-box">
                  {q.error ? <p className="auth-error" role="alert">{q.error.slice(0, 200)}</p> : null}
                  {!v.session ? (
                    <p className="owner-bar">
                      <span>Join the discussion.</span>
                      <Link className="link" href={`/signin?next=${encodeURIComponent(`/community/t/${id}`)}`}>Sign in to reply</Link>
                    </p>
                  ) : !v.builder ? (
                    <p className="owner-bar">
                      <span>To reply, start or claim your builder profile.</span>
                      <Link className="link" href="/builders/new">Start your builder profile</Link>
                    </p>
                  ) : (
                    <form method="post" action="/community/post" className="panel account-form">
                      <input type="hidden" name="action" value="reply" />
                      <input type="hidden" name="thread" value={id} />
                      <label>
                        Reply as @{v.builder.handle}
                        <textarea name="body" required rows={5} maxLength={MAX_POST_BODY} placeholder="**bold**, *italic*, `code`, lists and links work." />
                      </label>
                      <button className="btn btn-dark" type="submit">Post reply</button>
                    </form>
                  )}
                </section>
              </>
            ) : (
              <>
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
          </>
        )}
      </main>
      <SiteFooter />
      <TabBar current="/community" />
    </>
  );
}
