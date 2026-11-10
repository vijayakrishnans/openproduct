// Merged pull requests to openproduct builds (builder-profiles BP7, design
// D2): the pure part. Which repos count, the GitHub search queries that
// find a login's merged PRs in them, and the count, with the builder's own
// repos and builds left out: merging your own PR isn't a contribution.

/** "owner/name", lowercased, for a github.com repo URL; null for anything else. */
export function repoOf(url: string | null | undefined): string | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || !/^(www\.)?github\.com$/i.test(u.hostname)) return null;
  const [owner, name] = u.pathname.split("/").filter(Boolean);
  if (!owner || !name) return null;
  const repo = `${owner}/${name.replace(/\.git$/i, "")}`.toLowerCase();
  return /^[a-z0-9-]{1,39}\/[a-z0-9._-]{1,100}$/.test(repo) ? repo : null;
}

/** GitHub logins: 1–39 characters, letters, digits and single hyphens. */
export function isGithubLogin(login: string): boolean {
  return /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$/i.test(login);
}

/** GitHub caps a search query at 256 characters; stay under it. */
const MAX_QUERY = 240;

/**
 * Search queries covering every repo for one login. Several `repo:`
 * qualifiers in one query are OR'd, so repos are packed into as few
 * queries as fit.
 */
export function searchQueries(login: string, repos: string[]): string[] {
  const head = `is:pr is:merged author:${login}`;
  const out: string[] = [];
  let q = head;
  for (const repo of [...new Set(repos)].sort()) {
    const part = ` repo:${repo}`;
    if (q.length + part.length > MAX_QUERY && q !== head) {
      out.push(q);
      q = head;
    }
    q += part;
  }
  if (q !== head) out.push(q);
  return out;
}

/** A link a reader can open to check the count (D1: a badge says where it came from). */
export function searchLink(login: string, repos: string[]): string {
  const q = `is:pr is:merged author:${login} ${[...new Set(repos)].sort().map((r) => `repo:${r}`).join(" ")}`;
  return `https://github.com/pulls?q=${encodeURIComponent(q)}`;
}

/** The repo of a search result item, from its `repository_url`. */
export function repoOfItem(item: unknown): string | null {
  const url = item && typeof item === "object" ? (item as { repository_url?: unknown }).repository_url : null;
  if (typeof url !== "string") return null;
  const m = /^https:\/\/api\.github\.com\/repos\/([^/]+\/[^/]+)$/i.exec(url);
  return m ? m[1]!.toLowerCase() : null;
}

export type MergedPrs = {
  login: string;
  total: number;
  /** Build slug → merged PRs, only builds that counted. */
  byBuild: Record<string, number>;
  /** The repos counted, for the link that checks it. */
  repos: string[];
  fetchedAt: string;
};

/**
 * Merged PRs per build, from per-repo counts, leaving out repos the login
 * owns and builds it maintains.
 */
export function countMerged(
  login: string,
  byRepo: Record<string, number>,
  repoToSlug: Record<string, string>,
  maintains: string[],
  fetchedAt: string,
): MergedPrs {
  const own = new Set(maintains.map((s) => s.toLowerCase()));
  const byBuild: Record<string, number> = {};
  const repos: string[] = [];
  let total = 0;
  for (const [repo, n] of Object.entries(byRepo)) {
    const slug = repoToSlug[repo];
    if (!slug || n <= 0) continue;
    if (repo.split("/")[0] === login.toLowerCase() || own.has(slug.toLowerCase())) continue;
    byBuild[slug] = (byBuild[slug] ?? 0) + n;
    repos.push(repo);
    total += n;
  }
  return { login, total, byBuild, repos, fetchedAt };
}
