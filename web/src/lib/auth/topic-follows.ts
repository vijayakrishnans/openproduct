// Personal topics (topics-and-community TC4): following topics, and the
// signals Trending uses. A search is counted per topic per day; nothing
// about who searched is kept (D5).
import type { Db } from "../server/db";
import { normalizeTopic } from "../topics";

const WEEK = 7 * 24 * 60 * 60 * 1000;
export const MAX_FOLLOWED_TOPICS = 50;

export async function toggleTopicFollow(db: Db, accountId: string, raw: string, now = Date.now()): Promise<boolean | null> {
  const topic = normalizeTopic(raw);
  if (!topic) return null;
  const had = await db.prepare(`DELETE FROM topic_follows WHERE account_id = ? AND topic = ? RETURNING topic`).bind(accountId, topic).first();
  if (had) return false;
  const n = await db.prepare(`SELECT count(*) AS n FROM topic_follows WHERE account_id = ?`).bind(accountId).first<{ n: number }>();
  if ((n?.n ?? 0) >= MAX_FOLLOWED_TOPICS) return null;
  await db.prepare(`INSERT OR IGNORE INTO topic_follows (account_id, topic, created_at) VALUES (?, ?, ?)`).bind(accountId, topic, new Date(now).toISOString()).run();
  return true;
}

export async function topicFollowState(db: Db, topic: string, accountId: string | null): Promise<{ count: number; mine: boolean }> {
  const r = await db
    .prepare(`SELECT count(*) AS n, coalesce(sum(account_id = ?), 0) AS mine FROM topic_follows WHERE topic = ?`)
    .bind(accountId ?? "", topic)
    .first<{ n: number; mine: number }>();
  return { count: r?.n ?? 0, mine: (r?.mine ?? 0) > 0 };
}

/** The topics an account follows, most recently followed first. */
export async function followedTopics(db: Db, accountId: string): Promise<string[]> {
  const rows = await db.prepare(`SELECT topic FROM topic_follows WHERE account_id = ? ORDER BY created_at DESC`).bind(accountId).all<{ topic: string }>();
  return rows.results.map((r) => r.topic);
}

/** A search landed on this topic: one more for today. */
export async function recordTopicSearch(db: Db, raw: string, now = Date.now()): Promise<void> {
  const topic = normalizeTopic(raw);
  if (!topic) return;
  await db
    .prepare(`INSERT INTO topic_searches (topic, day, count) VALUES (?, ?, 1) ON CONFLICT(topic, day) DO UPDATE SET count = count + 1`)
    .bind(topic, new Date(now).toISOString().slice(0, 10))
    .run();
}

/** Per topic, this week: searches that landed on it, and new follows. */
export async function topicSignals(db: Db, now = Date.now()): Promise<{ searches: Map<string, number>; follows: Map<string, number> }> {
  const since = new Date(now - WEEK);
  const [s, f] = await Promise.all([
    db.prepare(`SELECT topic, sum(count) AS n FROM topic_searches WHERE day >= ? GROUP BY topic`).bind(since.toISOString().slice(0, 10)).all<{ topic: string; n: number }>(),
    db.prepare(`SELECT topic, count(*) AS n FROM topic_follows WHERE created_at > ? GROUP BY topic`).bind(since.toISOString()).all<{ topic: string; n: number }>(),
  ]);
  return { searches: new Map(s.results.map((r) => [r.topic, r.n])), follows: new Map(f.results.map((r) => [r.topic, r.n])) };
}

/** Trending (D4): searches + 3 × new writing + 5 × new follows, this week. */
export const trendingScore = (t: { searches: number; thisWeek: number; newFollows: number }) => t.searches + 3 * t.thisWeek + 5 * t.newFollows;
