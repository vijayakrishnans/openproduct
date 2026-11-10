// Discussions written on this site (builder-profiles BP5, design D6): threads
// with no listing, replies, reports, and hiding by a moderator.
import { MAX_POST_BODY, MAX_THREAD_TITLE, parseBody } from "../body";
import { THREAD_TAGS, type ForumOrder, type Post, type Thread, type ThreadTag } from "../forum";
import type { Db } from "../server/db";
import { githubLoginOf } from "./accounts";
import { builderOfAccount } from "./builders";
import { newId } from "./crypto";

/** Limits per account, per hour: enough for a real conversation, not for a flood. */
export const THREADS_PER_HOUR = 3;
export const REPLIES_PER_HOUR = 20;
const HOUR = 60 * 60 * 1000;

export type LocalThread = Thread & { local: true; hidden: boolean; solutionPostId?: string | null; mine?: boolean };
export type LocalPost = Post & { hidden: boolean; mine: boolean; solution?: boolean };

export type WriteResult = { ok: true; id: string } | { ok: false; message: string };

/** The default moderators: the site owner. Overridable with the MODERATORS secret (comma-separated GitHub logins). */
export const DEFAULT_MODERATORS = ["vijayakrishnans"];

export async function isModerator(db: Db, accountId: string, moderators: string[] = DEFAULT_MODERATORS): Promise<boolean> {
  const login = await githubLoginOf(db, accountId);
  return !!login && moderators.some((m) => m.toLowerCase() === login.toLowerCase());
}

/** The demo moderator's GitHub login, a moderator only while demo sign-in is on (OP-34). */
export const DEMO_MODERATOR = "demo-moderator";

/** Who moderates in this environment: the MODERATORS list, plus the demo moderator on stage. */
export function moderatorsFor(env: { MODERATORS?: string; DEMO_SIGNIN?: string }): string[] {
  const list = parseModerators(env.MODERATORS);
  return env.DEMO_SIGNIN === "on" ? [...list, DEMO_MODERATOR] : list;
}

export function parseModerators(raw: string | undefined): string[] {
  const list = (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return list.length ? list : DEFAULT_MODERATORS;
}

export async function authorOf(db: Db, accountId: string): Promise<{ handle: string } | { message: string }> {
  const builder = await builderOfAccount(db, accountId);
  if (!builder) return { message: "Start or claim your builder profile first, so people know who's talking." };
  return { handle: builder.handle };
}

export async function recentCount(db: Db, sql: string, accountId: string, now: number): Promise<number> {
  const row = await db.prepare(sql).bind(accountId, new Date(now - HOUR).toISOString()).first<{ n: number }>();
  return row?.n ?? 0;
}

export async function createThread(
  db: Db,
  accountId: string,
  input: { tag: string; title: string; body: string; kind?: string },
  now = Date.now(),
): Promise<WriteResult> {
  const author = await authorOf(db, accountId);
  if ("message" in author) return { ok: false, message: author.message };
  if (!(THREAD_TAGS as readonly string[]).includes(input.tag)) return { ok: false, message: "Pick a category." };
  const title = input.title.trim().replace(/\s+/g, " ");
  const body = input.body.trim();
  if (!title) return { ok: false, message: "Give the thread a title." };
  if (title.length > MAX_THREAD_TITLE) return { ok: false, message: `A title is at most ${MAX_THREAD_TITLE} characters.` };
  if (!body) return { ok: false, message: "Write the opening post." };
  if (body.length > MAX_POST_BODY) return { ok: false, message: `A post is at most ${MAX_POST_BODY} characters.` };
  if ((await recentCount(db, `SELECT count(*) AS n FROM threads WHERE author_account_id = ? AND created_at > ?`, accountId, now)) >= THREADS_PER_HOUR) {
    return { ok: false, message: `You can start ${THREADS_PER_HOUR} threads an hour. Try again a little later.` };
  }
  const id = newId();
  const at = new Date(now).toISOString();
  await db.batch([
    db
      .prepare(`INSERT INTO threads (id, author_account_id, tag, title, created_at, last_post_at, post_count, kind) VALUES (?, ?, ?, ?, ?, ?, 1, ?)`)
      .bind(id, accountId, input.tag, title, at, at, input.kind === "issue" ? "issue" : "discussion"),
    db.prepare(`INSERT INTO posts (id, thread_id, author_account_id, body, created_at) VALUES (?, ?, ?, ?, ?)`).bind(newId(), id, accountId, body, at),
  ]);
  return { ok: true, id };
}

export async function createReply(db: Db, accountId: string, threadId: string, rawBody: string, now = Date.now()): Promise<WriteResult> {
  const author = await authorOf(db, accountId);
  if ("message" in author) return { ok: false, message: author.message };
  const thread = await db.prepare(`SELECT hidden FROM threads WHERE id = ?`).bind(threadId).first<{ hidden: number }>();
  if (!thread || thread.hidden) return { ok: false, message: "That thread isn't open for replies." };
  const body = rawBody.trim();
  if (!body) return { ok: false, message: "Write a reply first." };
  if (body.length > MAX_POST_BODY) return { ok: false, message: `A reply is at most ${MAX_POST_BODY} characters.` };
  if ((await recentCount(db, `SELECT count(*) AS n FROM posts WHERE author_account_id = ? AND created_at > ?`, accountId, now)) >= REPLIES_PER_HOUR) {
    return { ok: false, message: `You can post ${REPLIES_PER_HOUR} replies an hour. Try again a little later.` };
  }
  const id = newId();
  const at = new Date(now).toISOString();
  await db.batch([
    db.prepare(`INSERT INTO posts (id, thread_id, author_account_id, body, created_at) VALUES (?, ?, ?, ?, ?)`).bind(id, threadId, accountId, body, at),
    db.prepare(`UPDATE threads SET last_post_at = ?, post_count = post_count + 1 WHERE id = ?`).bind(at, threadId),
  ]);
  return { ok: true, id };
}

type ThreadRow = {
  id: string;
  tag: string;
  title: string;
  created_at: string;
  last_post_at: string;
  post_count: number;
  hidden: number;
  remote: number;
  kind?: string | null;
  solution_post_id?: string | null;
  author_account_id?: string | null;
  handle: string | null;
  display_name: string | null;
};

const THREAD_SELECT = `SELECT t.id, t.tag, t.title, t.created_at, t.last_post_at, t.post_count, t.hidden, t.remote, t.kind, t.solution_post_id, t.author_account_id, b.handle, b.display_name
  FROM threads t LEFT JOIN builders b ON b.account_id = t.author_account_id`;

function toLocalThread(r: ThreadRow): LocalThread {
  return {
    id: r.id,
    slug: null,
    tag: r.tag,
    title: r.title,
    author: r.handle ? (r.display_name ?? r.handle) : "deleted builder",
    authorHandle: r.handle,
    // A solved issue reads as "answered", the state openproduct.live's threads use.
    state: r.solution_post_id ? "answered" : "open",
    kind: r.kind === "issue" ? "issue" : "discussion",
    solved: !!r.solution_post_id,
    createdAt: r.created_at,
    // Thread rows say "last reply" only when someone has replied.
    lastPostAt: r.post_count > 1 ? r.last_post_at : null,
    replies: r.post_count,
    local: true,
    hidden: r.hidden === 1,
  };
}

/** Visible threads written here, in the forum's order. */
export async function listLocalThreads(
  db: Db,
  order: ForumOrder,
  tag: ThreadTag | null,
  limit = 50,
  topic?: string,
  /** TC3: only issues or only discussions, and solved or open issues. */
  filter: { kind?: "discussion" | "issue"; solved?: boolean; topics?: string[] } = {},
): Promise<LocalThread[]> {
  const where = ["t.hidden = 0", "t.remote = 0"];
  const binds: unknown[] = [];
  if (filter.kind) {
    where.push("t.kind = ?");
    binds.push(filter.kind);
  }
  if (filter.solved !== undefined) where.push(filter.solved ? "t.solution_post_id IS NOT NULL" : "t.solution_post_id IS NULL");
  if (filter.topics) {
    if (!filter.topics.length) return [];
    where.push(`t.id IN (SELECT content_id FROM content_topics WHERE content_kind = 'thread' AND topic IN (${filter.topics.map(() => "?").join(", ")}))`);
    binds.push(...filter.topics);
  }
  if (tag) {
    where.push("t.tag = ?");
    binds.push(tag);
  }
  // TC1: only threads carrying this topic.
  if (topic) {
    where.push("t.id IN (SELECT content_id FROM content_topics WHERE content_kind = 'thread' AND topic = ?)");
    binds.push(topic);
  }
  const by = order === "replied" ? `t.post_count DESC, t.last_post_at DESC` : `t.last_post_at DESC`;
  const rows = await db.prepare(`${THREAD_SELECT} WHERE ${where.join(" AND ")} ORDER BY ${by} LIMIT ?`).bind(...binds, limit).all<ThreadRow>();
  return rows.results.map(toLocalThread);
}

/** One thread and its posts. Hidden ones are returned only to a moderator. */
export async function getLocalThread(
  db: Db,
  id: string,
  viewer: { accountId: string | null; moderator: boolean },
): Promise<{ thread: LocalThread; posts: LocalPost[] } | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const row = await db.prepare(`${THREAD_SELECT} WHERE t.id = ?`).bind(id).first<ThreadRow>();
  // A remote row only carries replies to an openproduct.live thread; that thread is read from there.
  if (!row || row.remote || (row.hidden && !viewer.moderator)) return null;
  const thread = { ...toLocalThread(row), solutionPostId: row.solution_post_id ?? null, mine: !!viewer.accountId && row.author_account_id === viewer.accountId };
  const posts = await postsOf(db, id, viewer);
  // TC3: the accepted solution comes straight after the question.
  const sol = posts.findIndex((p) => p.id === row.solution_post_id);
  if (sol > 0) {
    const [answer] = posts.splice(sol, 1);
    posts.splice(1, 0, { ...answer!, solution: true });
  }
  return { thread, posts };
}

async function postsOf(db: Db, id: string, viewer: { accountId: string | null; moderator: boolean }): Promise<LocalPost[]> {
  const posts = await db
    .prepare(
      `SELECT p.id, p.body, p.created_at, p.hidden, p.author_account_id, b.handle, b.display_name
         FROM posts p LEFT JOIN builders b ON b.account_id = p.author_account_id
        WHERE p.thread_id = ? ORDER BY p.created_at, p.id`,
    )
    .bind(id)
    .all<{ id: string; body: string; created_at: string; hidden: number; author_account_id: string | null; handle: string | null; display_name: string | null }>();
  return posts.results
    .filter((p) => !p.hidden || viewer.moderator)
    .map((p) => ({
      id: p.id,
      parentId: null,
      author: p.handle ? (p.display_name ?? p.handle) : "deleted builder",
      authorHandle: p.handle,
      createdAt: p.created_at,
      body: parseBody(p.body),
      hidden: p.hidden === 1,
      mine: !!viewer.accountId && p.author_account_id === viewer.accountId,
    }));
}

/**
 * Mark a reply as an issue's solution, or clear it (postId null). Only the
 * issue's author can, and only a visible reply in the thread, never the
 * question itself.
 */
export async function markSolution(db: Db, threadId: string, accountId: string, postId: string | null): Promise<WriteResult> {
  const t = await db
    .prepare(`SELECT author_account_id, kind, hidden FROM threads WHERE id = ? AND remote = 0`)
    .bind(threadId)
    .first<{ author_account_id: string | null; kind: string; hidden: number }>();
  if (!t || t.hidden || t.author_account_id !== accountId) return { ok: false, message: "Only the person who raised the issue can mark its solution." };
  if (t.kind !== "issue") return { ok: false, message: "Only an issue has a solution." };
  if (postId) {
    const first = await db.prepare(`SELECT id FROM posts WHERE thread_id = ? ORDER BY created_at, id LIMIT 1`).bind(threadId).first<{ id: string }>();
    const p = await db.prepare(`SELECT id FROM posts WHERE id = ? AND thread_id = ? AND hidden = 0`).bind(postId, threadId).first();
    if (!p || first?.id === postId) return { ok: false, message: "Pick a reply as the solution." };
  }
  await db.prepare(`UPDATE threads SET solution_post_id = ? WHERE id = ?`).bind(postId, threadId).run();
  return { ok: true, id: threadId };
}

/** An openproduct.live thread's id: whatever the API uses, kept to safe characters. */
export const REMOTE_THREAD_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** Replies written here to an openproduct.live thread (OP-25). */
export async function remoteReplies(db: Db, remoteId: string, viewer: { accountId: string | null; moderator: boolean }): Promise<LocalPost[]> {
  if (!REMOTE_THREAD_ID.test(remoteId)) return [];
  const row = await db.prepare(`SELECT remote FROM threads WHERE id = ?`).bind(remoteId).first<{ remote: number }>();
  return row?.remote ? postsOf(db, remoteId, viewer) : [];
}

/**
 * Reply here to an openproduct.live thread. The first reply creates the
 * remote stand-in row that carries replies; the thread itself stays there.
 */
export async function createRemoteReply(
  db: Db,
  accountId: string,
  remote: { id: string; title: string; tag: string },
  body: string,
  now = Date.now(),
): Promise<WriteResult> {
  if (!REMOTE_THREAD_ID.test(remote.id)) return { ok: false, message: "That thread isn't open for replies." };
  const clash = await db.prepare(`SELECT remote FROM threads WHERE id = ?`).bind(remote.id).first<{ remote: number }>();
  if (clash && !clash.remote) return { ok: false, message: "That thread isn't open for replies." };
  if (!clash) {
    const at = new Date(now).toISOString();
    const title = remote.title.trim().slice(0, MAX_THREAD_TITLE) || "Thread";
    await db
      .prepare(`INSERT OR IGNORE INTO threads (id, author_account_id, tag, title, created_at, last_post_at, post_count, remote) VALUES (?, NULL, ?, ?, ?, ?, 0, 1)`)
      .bind(remote.id, remote.tag, title, at, at)
      .run();
  }
  return createReply(db, accountId, remote.id, body, now);
}

/** What can be reported and hidden: a thread, a reply, or a builder post (BP6). */
export type ReportKind = "thread" | "post" | "article" | "comment";
const TABLE: Record<ReportKind, string> = { thread: "threads", post: "posts", article: "articles", comment: "build_comments" };

export async function reportContent(
  db: Db,
  accountId: string,
  kind: ReportKind,
  id: string,
  reason: string,
  now = new Date(),
): Promise<boolean> {
  const table = TABLE[kind];
  const exists = await db.prepare(`SELECT 1 AS x FROM ${table} WHERE id = ?`).bind(id).first();
  if (!exists) return false;
  await db
    .prepare(`INSERT OR IGNORE INTO reports (target_kind, target_id, reporter_account_id, reason, created_at) VALUES (?, ?, ?, ?, ?)`)
    .bind(kind, id, accountId, reason.trim().slice(0, 300) || null, now.toISOString())
    .run();
  return true;
}

/** Hide or restore a thread or post, and resolve its reports. Moderators only; the caller checks. */
export async function setHidden(db: Db, kind: ReportKind, id: string, hidden: boolean): Promise<void> {
  const table = TABLE[kind];
  await db.batch([
    db.prepare(`UPDATE ${table} SET hidden = ? WHERE id = ?`).bind(hidden ? 1 : 0, id),
    db.prepare(`UPDATE reports SET resolved = 1 WHERE target_kind = ? AND target_id = ?`).bind(kind, id),
  ]);
}

export type OpenReport = {
  /** "listing" (LB6): a build listed here, reported by its slug. */
  kind: ReportKind | "listing";
  id: string;
  /** The thread it's in; null for a builder post. */
  threadId: string | null;
  /** Where a moderator reads it in context. */
  href: string;
  title: string;
  excerpt: string;
  reports: number;
  reasons: string[];
  hidden: boolean;
};

/** Unresolved reports, grouped per thread, reply or builder post, most reported first. */
export async function openReports(db: Db): Promise<OpenReport[]> {
  const rows = await db
    .prepare(
      `SELECT r.target_kind AS kind, r.target_id AS id, count(*) AS n, group_concat(coalesce(r.reason, ''), '\u001f') AS reasons,
              coalesce(t.id, p.thread_id) AS thread_id, coalesce(t.title, pt.title, a.title) AS title, coalesce(p.body, a.body) AS body,
              coalesce(t.hidden, p.hidden, a.hidden, ls.state = 'hidden') AS hidden, a.id AS article_id,
              ls.slug AS listing_slug, ls.tagline AS listing_tagline,
              c.slug AS comment_slug, c.body AS comment_body, c.hidden AS comment_hidden
         FROM reports r
         LEFT JOIN threads t ON r.target_kind = 'thread' AND t.id = r.target_id
         LEFT JOIN posts p ON r.target_kind = 'post' AND p.id = r.target_id
         LEFT JOIN threads pt ON pt.id = p.thread_id
         LEFT JOIN articles a ON r.target_kind = 'article' AND a.id = r.target_id
         LEFT JOIN listings ls ON r.target_kind = 'listing' AND ls.slug = r.target_id
         LEFT JOIN build_comments c ON r.target_kind = 'comment' AND c.id = r.target_id
        WHERE r.resolved = 0
        GROUP BY r.target_kind, r.target_id
        ORDER BY n DESC`,
    )
    .all<{ kind: ReportKind | "listing"; id: string; n: number; reasons: string | null; thread_id: string | null; title: string | null; body: string | null; hidden: number | null; article_id: string | null; listing_slug: string | null; listing_tagline: string | null; comment_slug: string | null; comment_body: string | null; comment_hidden: number | null }>();
  return rows.results
    .filter((r) => r.thread_id || r.article_id || r.listing_slug || r.comment_slug)
    .map((r) => ({
      kind: r.kind,
      id: r.id,
      threadId: r.thread_id,
      href: r.comment_slug
        ? `/builds/${r.comment_slug}#c-${r.id}`
        : r.listing_slug
        ? `/builds/${r.listing_slug}`
        : r.article_id
          ? `/posts/${r.article_id}`
          : `/community/t/${r.thread_id}${r.kind === "post" ? `#p-${r.id}` : ""}`,
      title: r.comment_slug ? `Comment on ${r.comment_slug}` : r.listing_slug ? `Build: ${r.listing_slug}` : (r.title ?? ""),
      excerpt: (r.comment_body ?? r.listing_tagline ?? r.body ?? "").slice(0, 200),
      reports: r.n,
      reasons: (r.reasons ?? "").split("\u001f").filter(Boolean),
      hidden: r.hidden === 1 || r.comment_hidden === 1,
    }));
}

/** How many visible threads a builder has started here — the "Started a discussion" badge. */
export async function threadsStartedBy(db: Db, handle: string): Promise<number> {
  const row = await db
    .prepare(`SELECT count(*) AS n FROM threads t JOIN builders b ON b.account_id = t.author_account_id WHERE b.handle = ? AND t.hidden = 0 AND t.remote = 0`)
    .bind(handle)
    .first<{ n: number }>();
  return row?.n ?? 0;
}
