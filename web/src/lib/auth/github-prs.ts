// Merged-PR badges (builder-profiles BP7): reading GitHub, cached in D1 for
// a day. Only builders signed in with GitHub are counted (Q4): the login
// comes from their GitHub identity, never from a URL someone typed. A
// builder without one gets no badge, not a zero.
import type { Db } from "../server/db";
import { countMerged, isGithubLogin, repoOfItem, searchQueries, type MergedPrs } from "../merged-prs";
import { githubLoginOf } from "./accounts";

const DAY = 24 * 60 * 60 * 1000;
/** After GitHub says slow down, leave it alone this long. */
const BACKOFF = 15 * 60 * 1000;
/** Pages of 100 per query: plenty for one builder's PRs to a handful of repos. */
const MAX_PAGES = 5;

export type Fetch = (url: string, init?: RequestInit) => Promise<Response>;
export type GithubAuth = { token?: string; clientId?: string; clientSecret?: string };

async function setting(db: Db, key: string): Promise<{ value: string; updatedAt: number } | null> {
  const row = await db.prepare(`SELECT value, updated_at FROM settings WHERE key = ?`).bind(key).first<{ value: string; updated_at: number }>();
  return row ? { value: row.value, updatedAt: row.updated_at } : null;
}
async function setSetting(db: Db, key: string, value: string, now: number): Promise<void> {
  await db
    .prepare(`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`)
    .bind(key, value, now)
    .run();
}

/** Is every GitHub read paused after a rate limit? Shared by BP7 and listing stats (LB2). */
export async function githubBackedOff(db: Db, now = Date.now()): Promise<boolean> {
  const b = await setting(db, "github_backoff_until");
  return !!b && Number(b.value) > now;
}

/** Pause GitHub reads for a while after a 403 or 429. */
export async function backOffGithub(db: Db, now = Date.now()): Promise<void> {
  await setSetting(db, "github_backoff_until", String(now + BACKOFF), now);
}

/**
 * Repo → build slug for every public build with a GitHub repo, refreshed
 * once a day. If the refresh fails, yesterday's map is used.
 */
export async function buildRepos(db: Db, load: () => Promise<Record<string, string> | null>, now = Date.now()): Promise<Record<string, string>> {
  const cached = await setting(db, "build_repos");
  if (cached && now - cached.updatedAt < DAY) return JSON.parse(cached.value) as Record<string, string>;
  const fresh = await load().catch(() => null);
  if (fresh && Object.keys(fresh).length) {
    await setSetting(db, "build_repos", JSON.stringify(fresh), now);
    return fresh;
  }
  return cached ? (JSON.parse(cached.value) as Record<string, string>) : {};
}

export function githubHeaders(auth: GithubAuth): HeadersInit {
  const h: Record<string, string> = {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "openproduct-web",
  };
  if (auth.token) h.authorization = `Bearer ${auth.token}`;
  else if (auth.clientId && auth.clientSecret) h.authorization = `Basic ${btoa(`${auth.clientId}:${auth.clientSecret}`)}`;
  return h;
}

/** Merged PRs per repo for one login, straight from GitHub; null if GitHub didn't answer. */
export async function fetchMergedByRepo(
  login: string,
  repos: string[],
  deps: { fetch: Fetch; auth: GithubAuth },
): Promise<{ ok: true; byRepo: Record<string, number> } | { ok: false; limited: boolean }> {
  const byRepo: Record<string, number> = {};
  for (const q of searchQueries(login, repos)) {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = `https://api.github.com/search/issues?q=${encodeURIComponent(q)}&per_page=100&page=${page}`;
      let res: Response;
      try {
        res = await deps.fetch(url, { headers: githubHeaders(deps.auth), signal: AbortSignal.timeout(5000) });
      } catch {
        return { ok: false, limited: false };
      }
      if (res.status === 403 || res.status === 429) return { ok: false, limited: true };
      // 422: GitHub doesn't know the login; it has no merged PRs to count.
      if (res.status === 422) return { ok: true, byRepo: {} };
      if (!res.ok) return { ok: false, limited: false };
      const body = (await res.json().catch(() => null)) as { total_count?: number; items?: unknown[] } | null;
      const items = Array.isArray(body?.items) ? body!.items : [];
      for (const item of items) {
        const repo = repoOfItem(item);
        if (repo) byRepo[repo] = (byRepo[repo] ?? 0) + 1;
      }
      if (items.length < 100 || page * 100 >= (body?.total_count ?? 0)) break;
    }
  }
  return { ok: true, byRepo };
}

/**
 * Per-repo counts for a login, from the day's cache or GitHub. A failed
 * read keeps the last good count; with none, there's no badge.
 */
export async function mergedByRepo(
  db: Db,
  login: string,
  repos: string[],
  deps: { fetch: Fetch; auth: GithubAuth; now?: number },
): Promise<{ byRepo: Record<string, number>; fetchedAt: string } | null> {
  const now = deps.now ?? Date.now();
  const row = await db.prepare(`SELECT by_repo, fetched_at FROM merged_prs WHERE login = ?`).bind(login).first<{ by_repo: string; fetched_at: string }>();
  const cached = row ? { byRepo: JSON.parse(row.by_repo) as Record<string, number>, fetchedAt: row.fetched_at } : null;
  if (cached && now - Date.parse(cached.fetchedAt) < DAY) return cached;
  if (!repos.length) return cached;
  const backoff = await setting(db, "github_backoff_until");
  if (backoff && Number(backoff.value) > now) return cached;

  const r = await fetchMergedByRepo(login, repos, deps);
  if (!r.ok) {
    if (r.limited) await setSetting(db, "github_backoff_until", String(now + BACKOFF), now);
    return cached;
  }
  const fetchedAt = new Date(now).toISOString();
  await db
    .prepare(`INSERT INTO merged_prs (login, by_repo, fetched_at) VALUES (?, ?, ?) ON CONFLICT(login) DO UPDATE SET by_repo = excluded.by_repo, fetched_at = excluded.fetched_at`)
    .bind(login, JSON.stringify(r.byRepo), fetchedAt)
    .run();
  return { byRepo: r.byRepo, fetchedAt };
}

/**
 * The merged PRs that earn a badge for an account, or null when the
 * account has no GitHub identity (no badge, not zero) or GitHub hasn't
 * answered yet.
 */
export async function mergedPrsOfAccount(
  db: Db,
  accountId: string,
  maintains: string[],
  deps: { fetch: Fetch; auth: GithubAuth; loadRepos: () => Promise<Record<string, string> | null>; now?: number },
): Promise<MergedPrs | null> {
  const login = await githubLoginOf(db, accountId);
  if (!login || !isGithubLogin(login)) return null;
  const repoToSlug = await buildRepos(db, deps.loadRepos, deps.now);
  const counts = await mergedByRepo(db, login, Object.keys(repoToSlug), deps);
  if (!counts) return null;
  return countMerged(login, counts.byRepo, repoToSlug, maintains, counts.fetchedAt);
}

/** GitHub access as this site has it: GITHUB_TOKEN if set, else the OAuth app's id and secret. */
export function githubDepsFor(env: { GITHUB_TOKEN?: string; GITHUB_CLIENT_ID?: string; GITHUB_CLIENT_SECRET?: string }): { fetch: Fetch; auth: GithubAuth } {
  return { fetch: (url, init) => fetch(url, init), auth: { token: env.GITHUB_TOKEN, clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET } };
}
