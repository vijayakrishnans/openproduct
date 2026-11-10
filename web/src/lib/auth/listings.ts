// Builds listed on this site (list-your-build LB1, design D1–D5). A listing
// is a public GitHub repo whose control its lister proved: by owning it as
// their signed-in GitHub login, or by a `.openproduct` file holding the
// listing's code. It's a draft, seen only by its maintainers, until it's
// verified and has a tagline and a category; then it sits in Open builds.
import type { Db } from "../server/db";
import type { Build, BuildDetail } from "../directory";
import { githubLoginOf } from "./accounts";
import { builderOfAccount } from "./builders";
import { randomToken } from "./crypto";
import { githubHeaders, type Fetch, type GithubAuth } from "./github-prs";
import type { ListingStats } from "./listing-stats";

export const LISTINGS_PER_DAY = 3;
export const MAX_DRAFTS = 10;
export const MAX_TAGLINE = 120;
export const MAX_STACK = 6;
export const VERIFY_FILE = ".openproduct";
const DAY = 24 * 60 * 60 * 1000;

const RESERVED = new Set(["new", "list", "edit", "admin", "api", "builds", "build", "search", "topics", "roles", "community", "demo", "signin", "account", "settings", "openproduct"]);

/* ── Pure checks ── */

export function checkSlug(raw: string): { ok: true; slug: string } | { ok: false; message: string } {
  const slug = raw.trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){1,39}$/.test(slug)) {
    return { ok: false, message: "A build's name is 2–40 characters: letters, numbers and single hyphens." };
  }
  if (RESERVED.has(slug)) return { ok: false, message: "That name is reserved. Pick another." };
  return { ok: true, slug };
}

/** "owner/name" from "owner/name", a github.com URL, or a clone URL; lowercased. */
export function parseRepo(raw: string): string | null {
  let s = raw.trim();
  const m = /^(?:(?:https?:\/\/)?(?:www\.)?github\.com\/|git@github\.com:)?([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100}?)(?:\.git)?\/?$/.exec(s);
  if (!m) {
    try {
      const u = new URL(s);
      if (!/^(www\.)?github\.com$/i.test(u.hostname)) return null;
      const [o, n] = u.pathname.split("/").filter(Boolean);
      if (!o || !n) return null;
      s = `${o}/${n}`;
      return parseRepo(s);
    } catch {
      return null;
    }
  }
  if (m[2] === "." || m[2] === "..") return null;
  return `${m[1]}/${m[2]}`.toLowerCase();
}

export function checkStack(raw: string | string[]): string[] {
  const list = (Array.isArray(raw) ? raw : raw.split(","))
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^[a-z0-9][a-z0-9.+#-]{0,23}$/.test(s));
  return [...new Set(list)].slice(0, MAX_STACK);
}

/* ── GitHub ── */

export type RepoInfo = {
  repo: string;
  owner: string;
  description: string | null;
  licence: string | null;
  languages: string[];
  archived: boolean;
};

export type GithubDeps = { fetch: Fetch; auth: GithubAuth };

/** A public repo's facts; "missing" for private or nonexistent (GitHub answers 404 for both). */
export async function readRepo(repo: string, deps: GithubDeps): Promise<RepoInfo | "missing" | "unreachable"> {
  let res: Response;
  try {
    res = await deps.fetch(`https://api.github.com/repos/${repo}`, { headers: githubHeaders(deps.auth), signal: AbortSignal.timeout(5000) });
  } catch {
    return "unreachable";
  }
  if (res.status === 404) return "missing";
  if (!res.ok) return "unreachable";
  const r = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!r || r.private === true || r.visibility === "private") return "missing";
  const owner = (r.owner as { login?: unknown } | null)?.login;
  const licence = (r.license as { spdx_id?: unknown } | null)?.spdx_id;
  const topics = Array.isArray(r.topics) ? r.topics.filter((t): t is string => typeof t === "string") : [];
  const language = typeof r.language === "string" ? r.language.toLowerCase() : null;
  return {
    repo,
    owner: typeof owner === "string" ? owner.toLowerCase() : repo.split("/")[0]!,
    description: typeof r.description === "string" ? r.description.slice(0, 300) : null,
    licence: typeof licence === "string" && licence !== "NOASSERTION" ? licence : null,
    languages: checkStack([...(language ? [language] : []), ...topics]),
    archived: r.archived === true,
  };
}

/** The `.openproduct` file on the default branch, or null when it isn't there. */
export async function readVerifyFile(repo: string, deps: GithubDeps): Promise<string | null | "unreachable"> {
  let res: Response;
  try {
    res = await deps.fetch(`https://api.github.com/repos/${repo}/contents/${VERIFY_FILE}`, { headers: githubHeaders(deps.auth), signal: AbortSignal.timeout(5000) });
  } catch {
    return "unreachable";
  }
  if (res.status === 404) return null;
  if (!res.ok) return "unreachable";
  const body = (await res.json().catch(() => null)) as { content?: unknown; encoding?: unknown; size?: unknown } | null;
  if (!body || typeof body.content !== "string" || body.encoding !== "base64" || (typeof body.size === "number" && body.size > 4096)) return null;
  try {
    return atob(body.content.replace(/\s/g, ""));
  } catch {
    return null;
  }
}

/* ── Storage ── */

export type ListingState = "draft" | "published" | "hidden" | "unavailable";

export type Listing = {
  slug: string;
  repo: string;
  state: ListingState;
  verified: boolean;
  verifyCode: string;
  tagline: string | null;
  category: string | null;
  stack: string[];
  description: string | null;
  licence: string | null;
  createdAt: string;
  publishedAt: string | null;
  maintainers: { accountId: string; handle: string | null; role: "owner" | "maintainer" }[];
};

type Row = {
  slug: string;
  repo: string;
  state: ListingState;
  verify_code: string;
  verified_at: string | null;
  tagline: string | null;
  category: string | null;
  stack: string;
  description: string | null;
  licence: string | null;
  created_at: string;
  published_at: string | null;
};

function parseStack(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? checkStack(v.filter((x): x is string => typeof x === "string")) : [];
  } catch {
    return [];
  }
}

async function maintainersOf(db: Db, slug: string): Promise<Listing["maintainers"]> {
  const rows = await db
    .prepare(
      `SELECT m.account_id, m.role, b.handle FROM listing_maintainers m LEFT JOIN builders b ON b.account_id = m.account_id
        WHERE m.slug = ? AND m.accepted_at IS NOT NULL ORDER BY m.role = 'owner' DESC, m.accepted_at`,
    )
    .bind(slug)
    .all<{ account_id: string; role: "owner" | "maintainer"; handle: string | null }>();
  return rows.results.map((r) => ({ accountId: r.account_id, handle: r.handle, role: r.role }));
}

function toListing(r: Row, maintainers: Listing["maintainers"]): Listing {
  return {
    slug: r.slug,
    repo: r.repo,
    state: r.state,
    verified: !!r.verified_at,
    verifyCode: r.verify_code,
    tagline: r.tagline,
    category: r.category,
    stack: parseStack(r.stack),
    description: r.description,
    licence: r.licence,
    createdAt: r.created_at,
    publishedAt: r.published_at,
    maintainers,
  };
}

export async function getListing(db: Db, slug: string): Promise<Listing | null> {
  const row = await db.prepare(`SELECT * FROM listings WHERE slug = ?`).bind(slug.toLowerCase()).first<Row>();
  return row ? toListing(row, await maintainersOf(db, row.slug)) : null;
}

export const isMaintainer = (l: Listing, accountId: string | null | undefined) => !!accountId && l.maintainers.some((m) => m.accountId === accountId);

/** What still stands between a draft and Open builds, in words. */
export function missingForPublish(l: Listing): string[] {
  const out: string[] = [];
  if (!l.verified) out.push("Prove you control the repo");
  if (!l.tagline) out.push("Write a tagline");
  if (!l.category) out.push("Pick a category");
  return out;
}

/** Published listings, newest first, for the directory. */
export async function publishedListings(db: Db): Promise<Listing[]> {
  const rows = await db.prepare(`SELECT * FROM listings WHERE state = 'published' ORDER BY published_at DESC LIMIT 500`).all<Row>();
  return Promise.all(rows.results.map(async (r) => toListing(r, await maintainersOf(db, r.slug))));
}

/** Listings an account maintains, drafts included, for its account page. */
export async function listingsOfAccount(db: Db, accountId: string): Promise<Listing[]> {
  const rows = await db
    .prepare(`SELECT l.* FROM listings l JOIN listing_maintainers m ON m.slug = l.slug WHERE m.account_id = ? AND m.accepted_at IS NOT NULL ORDER BY l.created_at DESC`)
    .bind(accountId)
    .all<Row>();
  return Promise.all(rows.results.map(async (r) => toListing(r, await maintainersOf(db, r.slug))));
}

export type CreateInput = { repo: string; slug: string; tagline: string; category: string; stack: string };
export type CreateDeps = GithubDeps & {
  /** Is this slug a build on openproduct.live? "unreachable" when it can't be told. */
  takenThere: (slug: string) => Promise<boolean | "unreachable">;
  /** The categories Open builds offers; empty when unknown. */
  categories: string[];
};

export type Write = { ok: true; slug: string } | { ok: false; message: string };

function checkFields(input: { tagline: string; category: string }, categories: string[]): { ok: true; tagline: string | null; category: string | null } | { ok: false; message: string } {
  const tagline = input.tagline.trim().replace(/\s+/g, " ");
  if (tagline.length > MAX_TAGLINE) return { ok: false, message: `A tagline is at most ${MAX_TAGLINE} characters.` };
  const category = input.category.trim().toLowerCase();
  if (category && (!/^[a-z0-9-]{1,40}$/.test(category) || (categories.length && !categories.includes(category)))) {
    return { ok: false, message: "Pick one of the categories." };
  }
  return { ok: true, tagline: tagline || null, category: category || null };
}

/** Start a listing: a draft, verified at once when the lister's GitHub login owns the repo. */
export async function createListing(db: Db, accountId: string, input: CreateInput, deps: CreateDeps, now = Date.now()): Promise<Write> {
  if (!(await builderOfAccount(db, accountId))) return { ok: false, message: "Start or claim your builder profile first, so people can see who runs the build." };
  const repo = parseRepo(input.repo);
  if (!repo) return { ok: false, message: "That isn't a GitHub repo. Paste its address, like github.com/you/your-build." };
  const fromRepo = repo.split("/")[1]!.replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").replace(/-{2,}/g, "-");
  const slugCheck = checkSlug(input.slug.trim() || fromRepo);
  if (!slugCheck.ok) return slugCheck;
  const slug = slugCheck.slug;
  const fields = checkFields(input, deps.categories);
  if (!fields.ok) return fields;

  const counts = await db
    .prepare(
      `SELECT (SELECT count(*) FROM listings WHERE created_by = ? AND created_at > ?) AS today,
              (SELECT count(*) FROM listings l JOIN listing_maintainers m ON m.slug = l.slug WHERE m.account_id = ? AND l.state = 'draft') AS drafts`,
    )
    .bind(accountId, new Date(now - DAY).toISOString(), accountId)
    .first<{ today: number; drafts: number }>();
  if ((counts?.today ?? 0) >= LISTINGS_PER_DAY) return { ok: false, message: `You can list ${LISTINGS_PER_DAY} builds a day. Try again tomorrow.` };
  if ((counts?.drafts ?? 0) >= MAX_DRAFTS) return { ok: false, message: `You have ${MAX_DRAFTS} drafts. Publish or delete one first.` };

  const clash = await db.prepare(`SELECT slug, repo FROM listings WHERE slug = ? OR repo = ?`).bind(slug, repo).first<{ slug: string; repo: string }>();
  if (clash?.repo === repo) return { ok: false, message: "That repo is already listed here." };
  if (clash) return { ok: false, message: "That name is taken here. Pick another." };
  const there = await deps.takenThere(slug);
  if (there === "unreachable") return { ok: false, message: "We couldn't check that name just now. Try again in a minute." };
  if (there) return { ok: false, message: "That name is taken by a build on openproduct. Pick another." };

  const info = await readRepo(repo, deps);
  if (info === "unreachable") return { ok: false, message: "We couldn't reach GitHub just now. Try again in a minute." };
  if (info === "missing") return { ok: false, message: "That repo is private or doesn't exist. Only public repos can be listed." };

  const login = await githubLoginOf(db, accountId);
  const at = new Date(now).toISOString();
  const verifiedAt = login && login.toLowerCase() === info.owner ? at : null;
  const stack = checkStack(input.stack.trim() ? input.stack : info.languages);
  await db.batch([
    db
      .prepare(
        `INSERT INTO listings (slug, repo, verify_code, verified_at, tagline, category, stack, description, licence, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(slug, repo, `op-${randomToken(12)}`, verifiedAt, fields.tagline, fields.category, JSON.stringify(stack), info.description, info.licence, accountId, at, at),
    db.prepare(`INSERT INTO listing_maintainers (slug, account_id, role, accepted_at) VALUES (?, ?, 'owner', ?)`).bind(slug, accountId, at),
  ]);
  return { ok: true, slug };
}

/** Check the `.openproduct` file for the listing's code. Maintainers only. */
export async function verifyListing(
  db: Db,
  slug: string,
  accountId: string,
  deps: GithubDeps,
  now = Date.now(),
): Promise<{ ok: true } | { ok: false; message: string }> {
  const l = await getListing(db, slug);
  if (!l || !isMaintainer(l, accountId)) return { ok: false, message: "That listing isn't yours." };
  if (l.verified) return { ok: true };
  const login = await githubLoginOf(db, accountId);
  if (login && login.toLowerCase() === l.repo.split("/")[0]) {
    await db.prepare(`UPDATE listings SET verified_at = ?, updated_at = ? WHERE slug = ?`).bind(new Date(now).toISOString(), new Date(now).toISOString(), l.slug).run();
    return { ok: true };
  }
  const file = await readVerifyFile(l.repo, deps);
  if (file === "unreachable") return { ok: false, message: "We couldn't reach GitHub just now. Try again in a minute." };
  if (file === null) return { ok: false, message: `There's no ${VERIFY_FILE} file on ${l.repo}'s default branch yet.` };
  if (!file.split(/\s+/).includes(l.verifyCode)) return { ok: false, message: `${VERIFY_FILE} is there, but it doesn't hold this listing's code.` };
  const at = new Date(now).toISOString();
  await db.prepare(`UPDATE listings SET verified_at = ?, updated_at = ? WHERE slug = ?`).bind(at, at, l.slug).run();
  return { ok: true };
}

export async function updateListing(
  db: Db,
  slug: string,
  accountId: string,
  input: { tagline: string; category: string; stack: string },
  categories: string[],
  now = Date.now(),
): Promise<Write> {
  const l = await getListing(db, slug);
  if (!l || !isMaintainer(l, accountId)) return { ok: false, message: "That listing isn't yours." };
  const fields = checkFields(input, categories);
  if (!fields.ok) return fields;
  // A published listing can't lose what made it publishable.
  if (l.state === "published" && (!fields.tagline || !fields.category)) return { ok: false, message: "A published build needs a tagline and a category." };
  await db
    .prepare(`UPDATE listings SET tagline = ?, category = ?, stack = ?, updated_at = ? WHERE slug = ?`)
    .bind(fields.tagline, fields.category, JSON.stringify(checkStack(input.stack)), new Date(now).toISOString(), l.slug)
    .run();
  return { ok: true, slug: l.slug };
}

export async function setPublished(db: Db, slug: string, accountId: string, publish: boolean, now = Date.now()): Promise<Write> {
  const l = await getListing(db, slug);
  if (!l || !isMaintainer(l, accountId)) return { ok: false, message: "That listing isn't yours." };
  if (l.state === "hidden") return { ok: false, message: "A moderator has hidden this listing." };
  if (publish) {
    const missing = missingForPublish(l);
    if (missing.length) return { ok: false, message: `Before publishing: ${missing.join(", ").toLowerCase()}.` };
  }
  const at = new Date(now).toISOString();
  await db
    .prepare(`UPDATE listings SET state = ?, published_at = CASE WHEN ? = 'published' THEN coalesce(published_at, ?) ELSE published_at END, updated_at = ? WHERE slug = ?`)
    .bind(publish ? "published" : "draft", publish ? "published" : "draft", at, at, l.slug)
    .run();
  return { ok: true, slug: l.slug };
}

/* ── As builds ── */

/** A listing as a directory build, with its numbers from the repo (LB2) once read. */
export function listingToBuild(l: Listing, stats?: ListingStats | null): Build {
  return {
    slug: l.slug,
    tagline: l.tagline ?? "",
    category: l.category,
    // Once read, GitHub's answer wins, "no licence" included.
    licence: stats?.status === "ok" ? stats.licence : l.licence,
    changes7d: stats?.status === "ok" ? stats.changes7d : 0,
    upvotes: 0,
    roleCount: 0,
    stack: l.stack,
    publishedAt: l.publishedAt,
    lastCommitAt: stats?.status === "ok" ? stats.lastCommitAt : null,
    archived: stats?.status === "ok" && stats.archived ? true : undefined,
    pieces: [],
    cover: null,
    sample: [],
    source: "here",
  };
}

export function listingToDetail(l: Listing, stats?: ListingStats | null): BuildDetail {
  return {
    ...listingToBuild(l, stats),
    // The repo's description shows under About; a pitch of the maintainers' own comes with LB5.
    pitch: null,
    repoUrl: `https://github.com/${l.repo}`,
    liveUrl: null,
    workspaceRef: null,
    maintainers: l.maintainers.length,
    roles: [],
    log: [],
    pinned: "",
  };
}
