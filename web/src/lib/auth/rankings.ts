// Rankings (topics-and-community TC5, D4): helpful votes, top contributors
// per topic, and what each place was earned with. Every number here is one
// a reader can check on the site, and every formula is printed where the
// ranking shows.
import type { Db } from "../server/db";
import { POST_KIND, type PostKind } from "../post-kinds";

export const CONTRIBUTOR_DAYS = 90;
/** A ranking needs this many entries before it shows places (D4). */
export const MIN_RANKED = 3;
const DAY = 86_400_000;

export type HelpfulKind = "article" | "post";
const TABLE: Record<HelpfulKind, string> = { article: "articles", post: "posts" };

/**
 * Mark a post or a reply helpful, or take it back. Returns whether it's on
 * now; null when the target is gone, hidden, or the voter's own.
 */
export async function toggleHelpful(db: Db, accountId: string, kind: string, id: string, now = Date.now()): Promise<boolean | null> {
  if (kind !== "article" && kind !== "post") return null;
  const row = await db.prepare(`SELECT author_account_id AS a FROM ${TABLE[kind]} WHERE id = ? AND hidden = 0`).bind(id).first<{ a: string | null }>();
  if (!row || row.a === accountId) return null;
  const had = await db.prepare(`DELETE FROM helpful WHERE account_id = ? AND target_kind = ? AND target_id = ? RETURNING target_id`).bind(accountId, kind, id).first();
  if (had) return false;
  await db.prepare(`INSERT OR IGNORE INTO helpful (account_id, target_kind, target_id, created_at) VALUES (?, ?, ?, ?)`).bind(accountId, kind, id, new Date(now).toISOString()).run();
  return true;
}

export type HelpfulState = { count: number; mine: boolean };

/** Helpful counts for some posts or replies, and which this account gave. */
export async function helpfulState(db: Db, kind: HelpfulKind, ids: string[], accountId: string | null): Promise<Map<string, HelpfulState>> {
  if (!ids.length) return new Map();
  const rows = await db
    .prepare(`SELECT target_id AS id, count(*) AS n, coalesce(sum(account_id = ?), 0) AS mine FROM helpful WHERE target_kind = ? AND target_id IN (${ids.map(() => "?").join(", ")}) GROUP BY target_id`)
    .bind(accountId ?? "", kind, ...ids)
    .all<{ id: string; n: number; mine: number }>();
  return new Map(rows.results.map((r) => [r.id, { count: r.n, mine: r.mine > 0 }]));
}

/** What a contributor earned a place with. Writing is counted per kind. */
export type Earned = {
  writing: Partial<Record<PostKind | "discussion" | "issue", number>>;
  helpful: number;
  solutions: number;
  prs: number;
};

const writingTotal = (e: Earned) => Object.values(e.writing).reduce((a, b) => a + (b ?? 0), 0);

/** Top contributor (D4) = 3 × writing + helpful votes + 5 × accepted solutions + 5 × merged PRs. */
export const contributorScore = (e: Earned) => 3 * writingTotal(e) + e.helpful + 5 * e.solutions + 5 * e.prs;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "4 tutorials, 2 solutions": writing first (most first), then solutions, PRs and helpful votes. */
export function earnedLine(e: Earned): string {
  const writing = Object.entries(e.writing)
    .filter(([, n]) => n)
    .sort((a, b) => b[1]! - a[1]!)
    .map(([k, n]) => {
      const [one, many] =
        k === "discussion" ? ["discussion", "discussions"] : k === "issue" ? ["issue raised", "issues raised"] : [POST_KIND[k as PostKind].label.toLowerCase(), POST_KIND[k as PostKind].plural.toLowerCase()];
      return plural(n!, one!, many!);
    });
  return [
    ...writing,
    e.solutions ? plural(e.solutions, "solution", "solutions") : "",
    e.prs ? plural(e.prs, "merged PR", "merged PRs") : "",
    e.helpful ? plural(e.helpful, "helpful vote", "helpful votes") : "",
  ]
    .filter(Boolean)
    .join(", ");
}

type Row = { acc: string; topic: string; kind?: string; n: number; first: string };
type Filter = { topic?: string; accountId?: string };

function where(col: string, f: Filter): { sql: string; binds: string[] } {
  const parts: string[] = [];
  const binds: string[] = [];
  if (f.topic) parts.push("ct.topic = ?"), binds.push(f.topic);
  if (f.accountId) parts.push(`${col} = ?`), binds.push(f.accountId);
  return { sql: parts.map((p) => ` AND ${p}`).join(""), binds };
}

/**
 * Merged PRs per account and topic, from the day's cached GitHub counts
 * (BP7). A PR to a build counts in each of the build's topics. Repos the
 * login owns and builds the account maintains here don't count.
 */
async function prRows(db: Db, buildTopics: Map<string, string[]>, f: Filter): Promise<Row[]> {
  if (!buildTopics.size) return [];
  const map = await db.prepare(`SELECT value FROM settings WHERE key = 'build_repos'`).first<{ value: string }>();
  const repoToSlug = map ? (JSON.parse(map.value) as Record<string, string>) : {};
  const rows = await db
    .prepare(
      `SELECT i.account_id AS acc, m.login, m.by_repo, m.fetched_at,
              (SELECT group_concat(slug) FROM listing_maintainers lm WHERE lm.account_id = i.account_id) AS own
       FROM merged_prs m JOIN identities i ON i.provider = 'github' AND i.login = m.login COLLATE NOCASE${f.accountId ? " WHERE i.account_id = ?" : ""}`,
    )
    .bind(...(f.accountId ? [f.accountId] : []))
    .all<{ acc: string; login: string; by_repo: string; fetched_at: string; own: string | null }>();
  const out: Row[] = [];
  for (const r of rows.results) {
    const own = new Set((r.own ?? "").split(",").filter(Boolean));
    const byRepo = JSON.parse(r.by_repo) as Record<string, number>;
    const perTopic = new Map<string, number>();
    for (const [repo, n] of Object.entries(byRepo)) {
      const slug = repoToSlug[repo];
      if (!slug || n <= 0 || own.has(slug) || repo.split("/")[0] === r.login.toLowerCase()) continue;
      for (const t of buildTopics.get(slug) ?? []) if (!f.topic || t === f.topic) perTopic.set(t, (perTopic.get(t) ?? 0) + n);
    }
    for (const [topic, n] of perTopic) out.push({ acc: r.acc, topic, n, first: r.fetched_at });
  }
  return out;
}

type Tally = Earned & { accountId: string; topic: string; since: string };

/** Everyone's contributions per topic in the last 90 days, narrowed to a topic or an account. */
async function contributions(db: Db, f: Filter, opts: { now?: number; buildTopics?: Map<string, string[]> }): Promise<Tally[]> {
  const since = new Date((opts.now ?? Date.now()) - CONTRIBUTOR_DAYS * DAY).toISOString();
  const a = where("a.author_account_id", f);
  const t = where("t.author_account_id", f);
  const p = where("p.author_account_id", f);
  const q = (sql: string, binds: string[]) => db.prepare(sql).bind(since, ...binds).all<Row>().then((r) => r.results);
  const [articles, threads, helpfulA, helpfulP, solutions, prs] = await Promise.all([
    q(
      `SELECT a.author_account_id AS acc, ct.topic, a.kind, count(*) AS n, min(a.created_at) AS first
       FROM articles a JOIN content_topics ct ON ct.content_kind = 'article' AND ct.content_id = a.id
       WHERE a.hidden = 0 AND a.created_at > ?${a.sql} GROUP BY acc, ct.topic, a.kind`,
      a.binds,
    ),
    q(
      `SELECT t.author_account_id AS acc, ct.topic, t.kind, count(*) AS n, min(t.created_at) AS first
       FROM threads t JOIN content_topics ct ON ct.content_kind = 'thread' AND ct.content_id = t.id
       WHERE t.hidden = 0 AND t.remote = 0 AND t.author_account_id IS NOT NULL AND t.created_at > ?${t.sql} GROUP BY acc, ct.topic, t.kind`,
      t.binds,
    ),
    q(
      `SELECT a.author_account_id AS acc, ct.topic, count(*) AS n, min(h.created_at) AS first
       FROM helpful h JOIN articles a ON h.target_kind = 'article' AND a.id = h.target_id
       JOIN content_topics ct ON ct.content_kind = 'article' AND ct.content_id = a.id
       WHERE a.hidden = 0 AND h.created_at > ?${a.sql} GROUP BY acc, ct.topic`,
      a.binds,
    ),
    q(
      `SELECT p.author_account_id AS acc, ct.topic, count(*) AS n, min(h.created_at) AS first
       FROM helpful h JOIN posts p ON h.target_kind = 'post' AND p.id = h.target_id
       JOIN threads t ON t.id = p.thread_id
       JOIN content_topics ct ON ct.content_kind = 'thread' AND ct.content_id = t.id
       WHERE p.hidden = 0 AND t.hidden = 0 AND p.author_account_id IS NOT NULL AND h.created_at > ?${p.sql} GROUP BY acc, ct.topic`,
      p.binds,
    ),
    // Accepted solutions: a reply the issue's author chose, not their own.
    q(
      `SELECT p.author_account_id AS acc, ct.topic, count(*) AS n, min(p.created_at) AS first
       FROM threads t JOIN posts p ON p.id = t.solution_post_id
       JOIN content_topics ct ON ct.content_kind = 'thread' AND ct.content_id = t.id
       WHERE t.hidden = 0 AND p.hidden = 0 AND p.author_account_id IS NOT NULL
         AND p.author_account_id IS NOT t.author_account_id AND p.created_at > ?${p.sql} GROUP BY acc, ct.topic`,
      p.binds,
    ),
    opts.buildTopics ? prRows(db, opts.buildTopics, f) : Promise.resolve([]),
  ]);

  const tallies = new Map<string, Tally>();
  const get = (r: Row) => {
    const key = `${r.acc}\u0000${r.topic}`;
    let x = tallies.get(key);
    if (!x) tallies.set(key, (x = { accountId: r.acc, topic: r.topic, writing: {}, helpful: 0, solutions: 0, prs: 0, since: r.first }));
    if (r.first < x.since) x.since = r.first;
    return x;
  };
  for (const r of [...articles, ...threads]) {
    const x = get(r);
    const k = r.kind as keyof Earned["writing"];
    x.writing[k] = (x.writing[k] ?? 0) + r.n;
  }
  for (const r of [...helpfulA, ...helpfulP]) get(r).helpful += r.n;
  for (const r of solutions) get(r).solutions += r.n;
  for (const r of prs) get(r).prs += r.n;
  return [...tallies.values()];
}

export type Contributor = Earned & { accountId: string; handle: string; name: string; score: number; since: string };

async function withBuilders<T extends { accountId: string }>(db: Db, rows: T[]): Promise<(T & { handle: string; name: string })[]> {
  const ids = [...new Set(rows.map((r) => r.accountId))];
  if (!ids.length) return [];
  const b = await db
    .prepare(`SELECT account_id, handle, coalesce(display_name, handle) AS name FROM builders WHERE account_id IN (${ids.map(() => "?").join(", ")})`)
    .bind(...ids)
    .all<{ account_id: string; handle: string; name: string }>();
  const by = new Map(b.results.map((r) => [r.account_id, r]));
  // Only builders have a page to link to; anyone else isn't listed.
  return rows.flatMap((r) => {
    const x = by.get(r.accountId);
    return x ? [{ ...r, handle: x.handle, name: x.name }] : [];
  });
}

/** Ties go to whoever contributed first. */
const byScore = (a: { score: number; since: string }, b: { score: number; since: string }) => b.score - a.score || a.since.localeCompare(b.since);

/** A topic's top contributors over the last 90 days, highest score first. */
export async function topContributors(
  db: Db,
  topic: string,
  opts: { now?: number; buildTopics?: Map<string, string[]>; limit?: number } = {},
): Promise<Contributor[]> {
  const tallies = await contributions(db, { topic }, opts);
  const scored = tallies.map((t) => ({ ...t, score: contributorScore(t) })).filter((t) => t.score > 0);
  return (await withBuilders(db, scored)).sort(byScore).slice(0, opts.limit ?? 5);
}

export type KnownFor = Earned & { topic: string; score: number; since: string };

/** The topics a builder is known for: their best three by the same score. */
export async function knownFor(db: Db, accountId: string, opts: { now?: number; buildTopics?: Map<string, string[]> } = {}): Promise<KnownFor[]> {
  const tallies = await contributions(db, { accountId }, opts);
  return tallies
    .map((t) => ({ ...t, score: contributorScore(t) }))
    .filter((t) => t.score > 0)
    .sort(byScore)
    .slice(0, 3);
}

export type HelpfulItem = {
  kind: HelpfulKind;
  id: string;
  title: string;
  href: string;
  accountId: string;
  handle: string;
  name: string;
  votes: number;
  solution: boolean;
  score: number;
  since: string;
};

/** Helpful post or reply (D4) = helpful votes, plus 5 for an accepted solution. */
export const helpfulScore = (x: { votes: number; solution: boolean }) => x.votes + (x.solution ? 5 : 0);

/** A topic's most helpful posts and replies, all time. */
export async function mostHelpful(db: Db, topic: string, limit = 3): Promise<HelpfulItem[]> {
  const rows = await db
    .prepare(
      `SELECT 'article' AS kind, a.id, a.title, NULL AS thread_id, a.author_account_id AS acc, a.created_at AS at,
              (SELECT count(*) FROM helpful h WHERE h.target_kind = 'article' AND h.target_id = a.id) AS votes, 0 AS solution
       FROM articles a JOIN content_topics ct ON ct.content_kind = 'article' AND ct.content_id = a.id
       WHERE a.hidden = 0 AND ct.topic = ?
       UNION ALL
       SELECT 'post', p.id, t.title, t.id, p.author_account_id, p.created_at,
              (SELECT count(*) FROM helpful h WHERE h.target_kind = 'post' AND h.target_id = p.id),
              (t.solution_post_id = p.id AND p.author_account_id IS NOT t.author_account_id)
       FROM posts p JOIN threads t ON t.id = p.thread_id
       JOIN content_topics ct ON ct.content_kind = 'thread' AND ct.content_id = t.id
       WHERE p.hidden = 0 AND t.hidden = 0 AND p.author_account_id IS NOT NULL AND ct.topic = ?`,
    )
    .bind(topic, topic)
    .all<{ kind: HelpfulKind; id: string; title: string; thread_id: string | null; acc: string; at: string; votes: number; solution: number }>();
  const items = rows.results
    .map((r) => {
      const x = { votes: r.votes, solution: !!r.solution };
      return {
        kind: r.kind,
        id: r.id,
        title: r.title,
        href: r.kind === "article" ? `/posts/${r.id}` : `/community/t/${r.thread_id}#p-${r.id}`,
        accountId: r.acc,
        ...x,
        score: helpfulScore(x),
        since: r.at,
      };
    })
    .filter((x) => x.score > 0);
  return (await withBuilders(db, items)).sort(byScore).slice(0, limit);
}
