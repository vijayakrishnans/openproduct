// Builder posts (builder-profiles BP6, design D7): a builder's own writing,
// with an optional video and an optional build it's about. Stored in
// `articles` (`posts` is taken by discussion replies); the site calls them
// posts. The body is the same Markdown subset as discussions, parsed to
// data on read; the video is a provider and an id, never a URL or HTML.
import { parseBody } from "../body";
import type { RenderNode } from "../forum";
import type { Db } from "../server/db";
import { parseVideoUrl, storedVideo, type Video } from "../video";
import { builderOfAccount } from "./builders";
import { topicsFor } from "./topics";
import { newId } from "./crypto";

export const MAX_ARTICLE_TITLE = 140;
export const MAX_ARTICLE_BODY = 20000;
/** Posts are longer and rarer than replies: a few a day is plenty. */
export const ARTICLES_PER_DAY = 5;
const DAY = 24 * 60 * 60 * 1000;

const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

export type Article = {
  id: string;
  title: string;
  /** TC1: the topics it carries. */
  topics: string[];
  body: RenderNode[];
  /** The source, for the edit form; only filled for its author. */
  source: string | null;
  excerpt: string;
  video: Video | null;
  buildSlug: string | null;
  author: string;
  authorHandle: string;
  createdAt: string;
  updatedAt: string;
  hidden: boolean;
  mine: boolean;
};

export type ArticleInput = { title: string; body: string; video: string; build: string };
type Checked = { title: string; body: string; video: Video | null; buildSlug: string | null };
export type ArticleWrite = { ok: true; id: string } | { ok: false; message: string };

export function checkArticle(input: ArticleInput): { ok: true; value: Checked } | { ok: false; message: string } {
  const title = input.title.trim().replace(/\s+/g, " ");
  const body = input.body.trim();
  if (!title) return { ok: false, message: "Give the post a title." };
  if (title.length > MAX_ARTICLE_TITLE) return { ok: false, message: `A title is at most ${MAX_ARTICLE_TITLE} characters.` };
  if (!body) return { ok: false, message: "Write something first." };
  if (body.length > MAX_ARTICLE_BODY) return { ok: false, message: `A post is at most ${MAX_ARTICLE_BODY.toLocaleString("en")} characters.` };
  let video: Video | null = null;
  if (input.video.trim()) {
    const v = parseVideoUrl(input.video);
    if (!v.ok) return { ok: false, message: v.message };
    video = v.video;
  }
  const build = input.build.trim().toLowerCase();
  if (build && !SLUG.test(build)) return { ok: false, message: "That isn't a build's name. Use the part after /builds/ in its link." };
  return { ok: true, value: { title, body, video, buildSlug: build || null } };
}

export async function createArticle(db: Db, accountId: string, input: ArticleInput, now = Date.now()): Promise<ArticleWrite> {
  if (!(await builderOfAccount(db, accountId))) return { ok: false, message: "Start or claim your builder profile first; posts live on it." };
  const checked = checkArticle(input);
  if (!checked.ok) return checked;
  const recent = await db
    .prepare(`SELECT count(*) AS n FROM articles WHERE author_account_id = ? AND created_at > ?`)
    .bind(accountId, new Date(now - DAY).toISOString())
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= ARTICLES_PER_DAY) return { ok: false, message: `You can publish ${ARTICLES_PER_DAY} posts a day. Try again tomorrow.` };
  const { title, body, video, buildSlug } = checked.value;
  const id = newId();
  const at = new Date(now).toISOString();
  await db
    .prepare(
      `INSERT INTO articles (id, author_account_id, title, body, video_provider, video_id, build_slug, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, accountId, title, body, video?.provider ?? null, video?.id ?? null, buildSlug, at, at)
    .run();
  return { ok: true, id };
}

/** Only the author edits. A hidden post stays hidden after an edit. */
export async function updateArticle(db: Db, accountId: string, id: string, input: ArticleInput, now = Date.now()): Promise<ArticleWrite> {
  const row = await db.prepare(`SELECT author_account_id FROM articles WHERE id = ?`).bind(id).first<{ author_account_id: string }>();
  if (!row || row.author_account_id !== accountId) return { ok: false, message: "That post isn't yours to edit." };
  const checked = checkArticle(input);
  if (!checked.ok) return checked;
  const { title, body, video, buildSlug } = checked.value;
  await db
    .prepare(`UPDATE articles SET title = ?, body = ?, video_provider = ?, video_id = ?, build_slug = ?, updated_at = ? WHERE id = ?`)
    .bind(title, body, video?.provider ?? null, video?.id ?? null, buildSlug, new Date(now).toISOString(), id)
    .run();
  return { ok: true, id };
}

export async function deleteArticle(db: Db, accountId: string, id: string): Promise<boolean> {
  const row = await db.prepare(`SELECT author_account_id FROM articles WHERE id = ?`).bind(id).first<{ author_account_id: string }>();
  if (!row || row.author_account_id !== accountId) return false;
  await db.batch([
    db.prepare(`DELETE FROM articles WHERE id = ?`).bind(id),
    db.prepare(`DELETE FROM content_topics WHERE content_kind = 'article' AND content_id = ?`).bind(id),
    db.prepare(`DELETE FROM reports WHERE target_kind = 'article' AND target_id = ?`).bind(id),
  ]);
  return true;
}

type Row = {
  id: string;
  author_account_id: string;
  title: string;
  body: string;
  video_provider: string | null;
  video_id: string | null;
  build_slug: string | null;
  created_at: string;
  updated_at: string;
  hidden: number;
  handle: string;
  display_name: string | null;
};

// INNER JOIN: a post is shown only while its author has a builder profile.
const SELECT = `SELECT a.id, a.author_account_id, a.title, a.body, a.video_provider, a.video_id, a.build_slug,
       a.created_at, a.updated_at, a.hidden, b.handle, b.display_name
  FROM articles a JOIN builders b ON b.account_id = a.author_account_id`;

function text(nodes: RenderNode[]): string {
  return nodes
    .map((n) => ("value" in n ? n.value : "children" in n ? text(n.children) : "handle" in n ? `@${n.handle}` : ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function excerptOf(body: RenderNode[], max = 220): string {
  const t = text(body);
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" ") > max * 0.6 ? cut.lastIndexOf(" ") : max).trimEnd()}…`;
}

function toArticle(r: Row, accountId: string | null): Article {
  const body = parseBody(r.body, { headings: true });
  const mine = !!accountId && r.author_account_id === accountId;
  return {
    id: r.id,
    title: r.title,
    body,
    source: mine ? r.body : null,
    excerpt: excerptOf(body),
    video: storedVideo(r.video_provider, r.video_id),
    buildSlug: r.build_slug && SLUG.test(r.build_slug) ? r.build_slug : null,
    author: r.display_name ?? r.handle,
    authorHandle: r.handle,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    hidden: r.hidden === 1,
    mine,
    topics: [],
  };
}

/** One post. A hidden one is returned only to a moderator or its author. */
export async function getArticle(db: Db, id: string, viewer: { accountId: string | null; moderator: boolean }): Promise<Article | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const row = await db.prepare(`${SELECT} WHERE a.id = ?`).bind(id).first<Row>();
  if (!row) return null;
  if (row.hidden && !viewer.moderator && row.author_account_id !== viewer.accountId) return null;
  const a = toArticle(row, viewer.accountId);
  return { ...a, topics: (await topicsFor(db, "article", [a.id]).catch(() => new Map())).get(a.id) ?? [] };
}

/** Visible posts, newest first: everyone's, one builder's, or about one build. */
export async function listArticles(
  db: Db,
  opts: { handle?: string; build?: string; topic?: string; limit?: number; accountId?: string | null } = {},
): Promise<Article[]> {
  const where = ["a.hidden = 0"];
  const binds: unknown[] = [];
  if (opts.topic) {
    where.push("a.id IN (SELECT content_id FROM content_topics WHERE content_kind = 'article' AND topic = ?)");
    binds.push(opts.topic);
  }
  if (opts.handle) {
    where.push("b.handle = ?");
    binds.push(opts.handle);
  }
  if (opts.build) {
    where.push("a.build_slug = ?");
    binds.push(opts.build.toLowerCase());
  }
  const rows = await db
    .prepare(`${SELECT} WHERE ${where.join(" AND ")} ORDER BY a.created_at DESC LIMIT ?`)
    .bind(...binds, opts.limit ?? 20)
    .all<Row>();
  const list = rows.results.map((r) => toArticle(r, opts.accountId ?? null));
  const tags = await topicsFor(db, "article", list.map((a) => a.id)).catch(() => new Map<string, string[]>());
  return list.map((a) => ({ ...a, topics: tags.get(a.id) ?? [] }));
}

/** How many visible posts a builder has published — the "N posts" badge. */
export async function articlesBy(db: Db, handle: string): Promise<number> {
  const row = await db
    .prepare(`SELECT count(*) AS n FROM articles a JOIN builders b ON b.account_id = a.author_account_id WHERE b.handle = ? AND a.hidden = 0`)
    .bind(handle)
    .first<{ n: number }>();
  return row?.n ?? 0;
}
