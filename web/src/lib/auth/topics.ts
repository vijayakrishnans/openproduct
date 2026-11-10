// Topics on writing (topics-and-community TC1): tagging posts and
// discussions, and reading a topic's activity. Visible writing only:
// hidden posts and threads, and replies to openproduct.live threads, don't
// count toward a topic.
import type { Db } from "../server/db";
import { MAX_TOPICS, topicLabel } from "../topics";

export type ContentKind = "article" | "thread";
const WEEK = 7 * 24 * 60 * 60 * 1000;

/** Replace a piece of writing's topics (already parsed; up to five). */
export async function setTopics(db: Db, kind: ContentKind, id: string, topics: string[], now = Date.now()): Promise<void> {
  const at = new Date(now).toISOString();
  const list = topics.slice(0, MAX_TOPICS);
  await db.batch([
    db.prepare(`DELETE FROM content_topics WHERE content_kind = ? AND content_id = ?`).bind(kind, id),
    ...list.map((t) => db.prepare(`INSERT OR IGNORE INTO topics (slug, label, created_at) VALUES (?, ?, ?)`).bind(t, topicLabel(t), at)),
    ...list.map((t) => db.prepare(`INSERT OR IGNORE INTO content_topics (content_kind, content_id, topic, created_at) VALUES (?, ?, ?, ?)`).bind(kind, id, t, at)),
  ]);
}

/** The topics on each of these pieces of writing. */
export async function topicsFor(db: Db, kind: ContentKind, ids: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (!ids.length) return out;
  const rows = await db
    .prepare(`SELECT content_id, topic FROM content_topics WHERE content_kind = ? AND content_id IN (${ids.map(() => "?").join(", ")}) ORDER BY topic`)
    .bind(kind, ...ids)
    .all<{ content_id: string; topic: string }>();
  for (const r of rows.results) out.set(r.content_id, [...(out.get(r.content_id) ?? []), r.topic]);
  return out;
}

export type TopicActivity = { slug: string; label: string; writing: number; thisWeek: number };

/** Every topic with visible writing: how much in all, and how much this week. */
export async function topicActivity(db: Db, now = Date.now()): Promise<TopicActivity[]> {
  const week = new Date(now - WEEK).toISOString();
  const rows = await db
    .prepare(
      `SELECT t.slug, t.label, count(*) AS writing, sum(ct.created_at > ?) AS this_week
         FROM content_topics ct
         JOIN topics t ON t.slug = ct.topic AND t.hidden = 0
         LEFT JOIN articles a ON ct.content_kind = 'article' AND a.id = ct.content_id
         LEFT JOIN threads th ON ct.content_kind = 'thread' AND th.id = ct.content_id
        WHERE (a.id IS NOT NULL AND a.hidden = 0) OR (th.id IS NOT NULL AND th.hidden = 0 AND th.remote = 0)
        GROUP BY t.slug ORDER BY this_week DESC, writing DESC, t.slug`,
    )
    .bind(week)
    .all<{ slug: string; label: string; writing: number; this_week: number | null }>();
  return rows.results.map((r) => ({ slug: r.slug, label: r.label, writing: r.writing, thisWeek: r.this_week ?? 0 }));
}

export async function topicRow(db: Db, slug: string): Promise<{ slug: string; label: string; hidden: boolean } | null> {
  const r = await db.prepare(`SELECT slug, label, hidden FROM topics WHERE slug = ?`).bind(slug).first<{ slug: string; label: string; hidden: number }>();
  return r ? { slug: r.slug, label: r.label, hidden: r.hidden === 1 } : null;
}
