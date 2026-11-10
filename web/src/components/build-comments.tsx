import Link from "next/link";
import { PostBody } from "./post-body";
import { Avatar } from "./person-card";
import { MAX_COMMENT, type BuildComment } from "@/lib/auth/build-comments";
import { ago } from "@/lib/directory";

/**
 * Comments under a build (OP-46). Plain forms, so it works without script.
 * Signed out: a sign-in link. Signed in without a builder profile: a nudge
 * to start one, as replies in Community ask.
 */
export function BuildComments({
  slug,
  comments,
  signedIn,
  builderHandle,
  moderator,
  error,
  reported,
}: {
  slug: string;
  comments: BuildComment[];
  signedIn: boolean;
  builderHandle: string | null;
  moderator: boolean;
  error?: string;
  reported?: boolean;
}) {
  const here = `/builds/${slug}`;
  const visible = comments.filter((c) => !c.hidden).length;
  return (
    <section className="panel build-comments" id="comments" aria-labelledby="comments-h">
      <div className="panel-head">
        <h2 id="comments-h">
          Comments <span className="count">{visible}</span>
        </h2>
      </div>
      {reported ? <p className="auth-ok" role="status">Thanks. A moderator will take a look.</p> : null}
      {comments.length ? (
        <ol className="comment-list">
          {comments.map((c) => (
            <li key={c.id} id={`c-${c.id}`} className={`comment${c.hidden ? " is-hidden" : ""}`}>
              {c.authorHandle ? <Avatar handle={c.authorHandle} size={32} /> : <span className="comment-anon" aria-hidden />}
              <div className="comment-main">
                <div className="post-head">
                  {c.authorHandle ? (
                    <Link className="post-author" href={`/builders/${encodeURIComponent(c.authorHandle)}`}>{c.author}</Link>
                  ) : (
                    <span className="post-author">{c.author}</span>
                  )}
                  <span className="muted">{ago(c.createdAt)} ago</span>
                  {c.hidden ? <span className="pill">Hidden</span> : null}
                </div>
                <PostBody nodes={c.body} />
                {signedIn ? (
                  <div className="post-actions">
                    {c.mine ? (
                      <form method="post" action="/builds/comment">
                        <input type="hidden" name="slug" value={slug} />
                        <input type="hidden" name="id" value={c.id} />
                        <button type="submit" name="action" value="delete" className="text-btn danger">Delete</button>
                      </form>
                    ) : (
                      <form method="post" action="/builds/comment">
                        <input type="hidden" name="slug" value={slug} />
                        <input type="hidden" name="id" value={c.id} />
                        <button type="submit" name="action" value="report" className="text-btn">Report</button>
                      </form>
                    )}
                    {moderator ? (
                      <form method="post" action="/builds/comment">
                        <input type="hidden" name="slug" value={slug} />
                        <input type="hidden" name="id" value={c.id} />
                        <button type="submit" name="action" value={c.hidden ? "restore" : "hide"} className="text-btn">{c.hidden ? "Restore" : "Hide"}</button>
                      </form>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted comment-empty">No comments yet. Ask the maintainers something, or say what you&apos;d build with it.</p>
      )}

      {error ? <p className="auth-error" role="alert">{error.slice(0, 200)}</p> : null}
      {!signedIn ? (
        <p className="owner-bar">
          <span>Join the conversation.</span>
          <Link className="link" href={`/signin?next=${encodeURIComponent(`${here}#comments`)}`}>Sign in to comment</Link>
        </p>
      ) : !builderHandle ? (
        <p className="owner-bar">
          <span>To comment, start or claim your builder profile.</span>
          <Link className="link" href="/builders/new">Start your builder profile</Link>
        </p>
      ) : (
        <form method="post" action="/builds/comment" className="comment-form">
          <input type="hidden" name="action" value="add" />
          <input type="hidden" name="slug" value={slug} />
          <label>
            <span className="sr-only">Comment as @{builderHandle}</span>
            <textarea name="body" required rows={3} maxLength={MAX_COMMENT} placeholder={`Comment as @${builderHandle}. **bold**, *italic*, \`code\` and links work.`} />
          </label>
          <button className="btn btn-dark" type="submit">Post comment</button>
        </form>
      )}
    </section>
  );
}
