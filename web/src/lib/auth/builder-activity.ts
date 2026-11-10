// A builder's activity here, for the side panel on their profile: what
// they've written, how it helped, and what they did last. All of it is
// public on the site already; this only counts and orders it.
import type { Db } from "../server/db";

export type ActivityCounts = { posts: number; discussions: number; replies: number; solutions: number; helpful: number };
export type ActivityItem = { kind: "post" | "thread" | "reply"; title: string; href: string; at: string };

export async function builderActivity(db: Db, accountId: string, limit = 5): Promise<{ counts: ActivityCounts; recent: ActivityItem[] }> {
  const [counts, recent] = await Promise.all([
    db
      .prepare(
        `SELECT
           (SELECT count(*) FROM articles WHERE author_account_id = ?1 AND hidden = 0) AS posts,
           (SELECT count(*) FROM threads WHERE author_account_id = ?1 AND hidden = 0 AND remote = 0) AS discussions,
           -- A reply is any post after the thread's opening one, which shares the thread's time.
           (SELECT count(*) FROM posts p JOIN threads t ON t.id = p.thread_id
              WHERE p.author_account_id = ?1 AND p.hidden = 0 AND t.hidden = 0 AND p.created_at > t.created_at) AS replies,
           (SELECT count(*) FROM threads t JOIN posts p ON p.id = t.solution_post_id
              WHERE p.author_account_id = ?1 AND t.author_account_id IS NOT ?1 AND t.hidden = 0 AND p.hidden = 0) AS solutions,
           (SELECT count(*) FROM helpful h JOIN articles a ON h.target_kind = 'article' AND a.id = h.target_id WHERE a.author_account_id = ?1 AND a.hidden = 0)
           + (SELECT count(*) FROM helpful h JOIN posts p ON h.target_kind = 'post' AND p.id = h.target_id WHERE p.author_account_id = ?1 AND p.hidden = 0) AS helpful`,
      )
      .bind(accountId)
      .first<ActivityCounts>(),
    db
      .prepare(
        `SELECT * FROM (
           SELECT 'post' AS kind, a.title, '/posts/' || a.id AS href, a.created_at AS at
             FROM articles a WHERE a.author_account_id = ?1 AND a.hidden = 0
           UNION ALL
           SELECT 'thread', t.title, '/community/t/' || t.id, t.created_at
             FROM threads t WHERE t.author_account_id = ?1 AND t.hidden = 0 AND t.remote = 0
           UNION ALL
           SELECT 'reply', t.title, '/community/t/' || t.id || '#p-' || p.id, p.created_at
             FROM posts p JOIN threads t ON t.id = p.thread_id
             WHERE p.author_account_id = ?1 AND p.hidden = 0 AND t.hidden = 0 AND p.created_at > t.created_at
         ) ORDER BY at DESC LIMIT ?2`,
      )
      .bind(accountId, limit)
      .all<ActivityItem>(),
  ]);
  return { counts: counts ?? { posts: 0, discussions: 0, replies: 0, solutions: 0, helpful: 0 }, recent: recent.results };
}
