// Comments under a build (OP-46): short, flat, newest last, for builds
// listed here and builds from the directory alike. Builders comment; anyone
// signed in can report one; moderators hide or restore it; authors delete
// their own.
import type { Db } from "../server/db";
import { parseBody } from "../body";
import { newId } from "./crypto";
import { authorOf, recentCount } from "./discussions";

export const MAX_COMMENT = 2000;
export const COMMENTS_PER_HOUR = 20;
const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/;

export type BuildComment = {
  id: string;
  author: string;
  authorHandle: string | null;
  createdAt: string;
  body: ReturnType<typeof parseBody>;
  hidden: boolean;
  mine: boolean;
};

export async function listComments(db: Db, slug: string, viewer: { accountId: string | null; moderator: boolean }): Promise<BuildComment[]> {
  const rows = await db
    .prepare(
      `SELECT c.id, c.body, c.created_at, c.hidden, c.author_account_id, b.handle, b.display_name
         FROM build_comments c LEFT JOIN builders b ON b.account_id = c.author_account_id
        WHERE c.slug = ? ORDER BY c.created_at, c.id`,
    )
    .bind(slug)
    .all<{ id: string; body: string; created_at: string; hidden: number; author_account_id: string | null; handle: string | null; display_name: string | null }>();
  return rows.results
    .filter((c) => !c.hidden || viewer.moderator)
    .map((c) => ({
      id: c.id,
      author: c.handle ? (c.display_name ?? c.handle) : "deleted builder",
      authorHandle: c.handle,
      createdAt: c.created_at,
      body: parseBody(c.body),
      hidden: c.hidden === 1,
      mine: !!viewer.accountId && c.author_account_id === viewer.accountId,
    }));
}

export async function addComment(
  db: Db,
  accountId: string,
  slug: string,
  raw: string,
  now = Date.now(),
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  if (!SLUG.test(slug)) return { ok: false, message: "That build isn't here." };
  const author = await authorOf(db, accountId);
  if ("message" in author) return { ok: false, message: author.message };
  const body = raw.trim();
  if (!body) return { ok: false, message: "Write a comment first." };
  if (body.length > MAX_COMMENT) return { ok: false, message: `A comment is at most ${MAX_COMMENT} characters.` };
  if ((await recentCount(db, `SELECT count(*) AS n FROM build_comments WHERE author_account_id = ? AND created_at > ?`, accountId, now)) >= COMMENTS_PER_HOUR) {
    return { ok: false, message: `You can post ${COMMENTS_PER_HOUR} comments an hour. Try again a little later.` };
  }
  const id = newId();
  await db.prepare(`INSERT INTO build_comments (id, slug, author_account_id, body, created_at) VALUES (?, ?, ?, ?, ?)`).bind(id, slug, accountId, body, new Date(now).toISOString()).run();
  return { ok: true, id };
}

/** An author deletes their own comment, and its reports go with it. */
export async function deleteComment(db: Db, accountId: string, id: string): Promise<boolean> {
  const gone = await db.prepare(`DELETE FROM build_comments WHERE id = ? AND author_account_id = ? RETURNING id`).bind(id, accountId).first();
  if (gone) await db.prepare(`DELETE FROM reports WHERE target_kind = 'comment' AND target_id = ?`).bind(id).run();
  return !!gone;
}

export async function commentCount(db: Db, slug: string): Promise<number> {
  const r = await db.prepare(`SELECT count(*) AS n FROM build_comments WHERE slug = ? AND hidden = 0`).bind(slug).first<{ n: number }>();
  return r?.n ?? 0;
}
