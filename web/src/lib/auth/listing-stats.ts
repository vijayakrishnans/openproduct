// Live from the repo (list-your-build LB2, design D3): a listing's numbers are
// read from GitHub, never typed in, and cached for an hour. Changes are
// commits to the default branch in the last 7 days. A repo that goes private
// or is deleted reads as "missing", and the directory leaves it out until
// it's back. Every read shares BP7's backoff after a rate limit.
import type { Db } from "../server/db";
import { checkStack } from "./listings";
import { backOffGithub, githubBackedOff, githubHeaders, type Fetch, type GithubAuth } from "./github-prs";

export const STATS_TTL_MS = 60 * 60 * 1000;
const WEEK = 7 * 24 * 60 * 60 * 1000;
/** Pages of 100 commits: past 300 in a week, "300" is plenty to rank by. */
const MAX_COMMIT_PAGES = 3;

export type ListingStats = {
  status: "ok" | "missing";
  changes7d: number;
  licence: string | null;
  lastCommitAt: string | null;
  languages: string[];
  archived: boolean;
  fetchedAt: string;
};

type Deps = { fetch: Fetch; auth: GithubAuth };
type Read<T> = { ok: true; value: T } | { ok: false; status: number };

async function get<T>(url: string, deps: Deps): Promise<Read<T>> {
  try {
    const res = await deps.fetch(url, { headers: githubHeaders(deps.auth), signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, value: (await res.json()) as T };
  } catch {
    return { ok: false, status: 0 };
  }
}

/** Read one repo's numbers from GitHub. "limited" on a rate limit; null when GitHub didn't answer. */
export async function fetchRepoStats(repo: string, deps: Deps, now = Date.now()): Promise<Omit<ListingStats, "fetchedAt"> | "limited" | null> {
  const meta = await get<Record<string, unknown>>(`https://api.github.com/repos/${repo}`, deps);
  if (!meta.ok) {
    if (meta.status === 404) return { status: "missing", changes7d: 0, licence: null, lastCommitAt: null, languages: [], archived: false };
    return meta.status === 403 || meta.status === 429 ? "limited" : null;
  }
  const r = meta.value;
  if (r.private === true) return { status: "missing", changes7d: 0, licence: null, lastCommitAt: null, languages: [], archived: false };

  const since = new Date(now - WEEK).toISOString();
  let changes = 0;
  let lastCommitAt: string | null = null;
  for (let page = 1; page <= MAX_COMMIT_PAGES; page++) {
    const c = await get<{ commit?: { committer?: { date?: string } } }[]>(`https://api.github.com/repos/${repo}/commits?since=${encodeURIComponent(since)}&per_page=100&page=${page}`, deps);
    if (!c.ok) {
      // An empty repo answers 409; that's zero commits, not an error.
      if (c.status === 409) break;
      return c.status === 403 || c.status === 429 ? "limited" : null;
    }
    const list = Array.isArray(c.value) ? c.value : [];
    if (page === 1) lastCommitAt = list[0]?.commit?.committer?.date ?? null;
    changes += list.length;
    if (list.length < 100) break;
  }
  if (!lastCommitAt && typeof r.pushed_at === "string") lastCommitAt = r.pushed_at;

  const langs = await get<Record<string, number>>(`https://api.github.com/repos/${repo}/languages`, deps);
  const languages = langs.ok
    ? checkStack(Object.entries(langs.value).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name]) => name))
    : [];
  const licence = (r.license as { spdx_id?: unknown } | null)?.spdx_id;
  return {
    status: "ok",
    changes7d: changes,
    licence: typeof licence === "string" && licence !== "NOASSERTION" ? licence : null,
    lastCommitAt,
    languages,
    archived: r.archived === true,
  };
}

type Row = { slug: string; status: "ok" | "missing"; changes_7d: number; licence: string | null; last_commit_at: string | null; languages: string; archived: number; fetched_at: string };

function toStats(r: Row): ListingStats {
  let languages: string[] = [];
  try {
    languages = checkStack(JSON.parse(r.languages));
  } catch {}
  return { status: r.status, changes7d: r.changes_7d, licence: r.licence, lastCommitAt: r.last_commit_at, languages, archived: r.archived === 1, fetchedAt: r.fetched_at };
}

/** Cached stats for every listing that has them. */
export async function allStats(db: Db): Promise<Map<string, ListingStats>> {
  const rows = await db.prepare(`SELECT * FROM listing_stats`).all<Row>();
  return new Map(rows.results.map((r) => [r.slug, toStats(r)]));
}

export async function statsOf(db: Db, slug: string): Promise<ListingStats | null> {
  const r = await db.prepare(`SELECT * FROM listing_stats WHERE slug = ?`).bind(slug.toLowerCase()).first<Row>();
  return r ? toStats(r) : null;
}

/** Refresh one listing from GitHub and store it; keeps the last good numbers when GitHub fails. */
export async function refreshStats(db: Db, slug: string, repo: string, deps: Deps, now = Date.now()): Promise<ListingStats | null> {
  if (await githubBackedOff(db, now)) return statsOf(db, slug);
  const s = await fetchRepoStats(repo, deps, now);
  if (s === "limited") {
    await backOffGithub(db, now);
    return statsOf(db, slug);
  }
  if (!s) return statsOf(db, slug);
  const at = new Date(now).toISOString();
  await db
    .prepare(
      `INSERT INTO listing_stats (slug, status, changes_7d, licence, last_commit_at, languages, archived, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(slug) DO UPDATE SET status = excluded.status, changes_7d = excluded.changes_7d, licence = excluded.licence,
         last_commit_at = excluded.last_commit_at, languages = excluded.languages, archived = excluded.archived, fetched_at = excluded.fetched_at`,
    )
    .bind(slug, s.status, s.changes7d, s.licence, s.lastCommitAt, JSON.stringify(s.languages), s.archived ? 1 : 0, at)
    .run();
  return { ...s, fetchedAt: at };
}

export const isStale = (s: ListingStats | null | undefined, now = Date.now()) => !s || now - Date.parse(s.fetchedAt) >= STATS_TTL_MS;

/**
 * Refresh the stalest listings, a few at a time (each costs up to five
 * GitHub calls). Called after a response, so no page waits on GitHub.
 */
export async function refreshStale(db: Db, deps: Deps, opts: { limit?: number; now?: number } = {}): Promise<number> {
  const now = opts.now ?? Date.now();
  const rows = await db
    .prepare(
      `SELECT l.slug, l.repo FROM listings l LEFT JOIN listing_stats s ON s.slug = l.slug
        WHERE l.state = 'published' AND (s.fetched_at IS NULL OR s.fetched_at < ?)
        ORDER BY s.fetched_at IS NOT NULL, s.fetched_at LIMIT ?`,
    )
    .bind(new Date(now - STATS_TTL_MS).toISOString(), opts.limit ?? 3)
    .all<{ slug: string; repo: string }>();
  for (const r of rows.results) await refreshStats(db, r.slug, r.repo, deps, now);
  return rows.results.length;
}
