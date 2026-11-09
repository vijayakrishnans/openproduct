// Builder profiles owned by an account (design D10): claim an openproduct.live
// profile, proved by GitHub, or start a new one here.
import type { Db } from "../server/db";

export type OwnedBuilder = {
  handle: string;
  kind: "claimed" | "new";
  displayName: string | null;
  bio: string | null;
  createdAt: string;
};

export const MAX_DISPLAY_NAME = 80;
export const MAX_BIO = 600;

/** Addresses under /builders that are pages, not people. */
const RESERVED = new Set(["new", "claim", "edit", "me", "account", "admin", "settings", "signin", "signout", "auth", "api", "openproduct", "orunbase", "support", "help", "about"]);

export type HandleCheck = { ok: true; handle: string } | { ok: false; message: string };

/** 2–30 characters: lowercase letters, digits and single hyphens, not at either end. */
export function checkHandle(raw: string): HandleCheck {
  const handle = raw.trim().replace(/^@/, "").toLowerCase();
  if (handle.length < 2 || handle.length > 30) return { ok: false, message: "A handle is 2 to 30 characters." };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(handle)) {
    return { ok: false, message: "Use lowercase letters, numbers and single hyphens, starting and ending with a letter or number." };
  }
  if (RESERVED.has(handle)) return { ok: false, message: "That handle is reserved. Pick another." };
  return { ok: true, handle };
}

/**
 * The GitHub login a profile's GitHub link names, or null. Only a profile
 * address counts (`github.com/<login>`), never a repo or an org page path.
 */
export function githubLoginFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || !["github.com", "www.github.com"].includes(u.hostname.toLowerCase())) return null;
  const parts = u.pathname.split("/").filter(Boolean);
  if (parts.length !== 1) return null;
  const login = parts[0]!;
  return /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$/i.test(login) ? login : null;
}

/** D10: a claim is proved when the profile's GitHub link names the GitHub account they signed in with. */
export function canClaim(profileGithubUrl: string | null, signedInGithubLogin: string | null): boolean {
  const named = githubLoginFromUrl(profileGithubUrl);
  return !!named && !!signedInGithubLogin && named.toLowerCase() === signedInGithubLogin.toLowerCase();
}

export async function builderOfAccount(db: Db, accountId: string): Promise<OwnedBuilder | null> {
  const row = await db
    .prepare(`SELECT handle, kind, display_name, bio, created_at FROM builders WHERE account_id = ?`)
    .bind(accountId)
    .first<{ handle: string; kind: "claimed" | "new"; display_name: string | null; bio: string | null; created_at: string }>();
  return row ? { handle: row.handle, kind: row.kind, displayName: row.display_name, bio: row.bio, createdAt: row.created_at } : null;
}

export async function builderByHandle(db: Db, handle: string): Promise<(OwnedBuilder & { accountId: string }) | null> {
  const row = await db
    .prepare(`SELECT handle, kind, display_name, bio, created_at, account_id FROM builders WHERE handle = ?`)
    .bind(handle)
    .first<{ handle: string; kind: "claimed" | "new"; display_name: string | null; bio: string | null; created_at: string; account_id: string }>();
  return row
    ? { handle: row.handle, kind: row.kind, displayName: row.display_name, bio: row.bio, createdAt: row.created_at, accountId: row.account_id }
    : null;
}

/** Profiles started here, newest first — they join the builders directory. */
export async function newBuilders(db: Db, limit = 200): Promise<OwnedBuilder[]> {
  const rows = await db
    .prepare(`SELECT handle, kind, display_name, bio, created_at FROM builders WHERE kind = 'new' ORDER BY created_at DESC LIMIT ?`)
    .bind(limit)
    .all<{ handle: string; kind: "new"; display_name: string | null; bio: string | null; created_at: string }>();
  return rows.results.map((r) => ({ handle: r.handle, kind: r.kind, displayName: r.display_name, bio: r.bio, createdAt: r.created_at }));
}

export type ProfileWrite = { ok: true; handle: string } | { ok: false; message: string };

/** Record a proved claim. The caller has already checked `canClaim` against the live profile. */
export async function claimBuilder(db: Db, accountId: string, handle: string, now = new Date()): Promise<ProfileWrite> {
  if (await builderOfAccount(db, accountId)) return { ok: false, message: "Your account already has a builder profile." };
  if (await builderByHandle(db, handle)) return { ok: false, message: "That profile has already been claimed." };
  await db
    .prepare(`INSERT INTO builders (handle, account_id, kind, display_name, bio, created_at) VALUES (?, ?, 'claimed', NULL, NULL, ?)`)
    .bind(handle, accountId, now.toISOString())
    .run();
  return { ok: true, handle };
}

/**
 * Start a new profile. `takenOnOpenproduct` says whether openproduct.live
 * already has a builder at that handle; a new profile can't shadow one.
 */
export async function startBuilder(
  db: Db,
  accountId: string,
  input: { handle: string; displayName: string; bio: string },
  takenOnOpenproduct: boolean,
  now = new Date(),
): Promise<ProfileWrite> {
  const checked = checkHandle(input.handle);
  if (!checked.ok) return checked;
  const displayName = input.displayName.trim();
  const bio = input.bio.trim();
  if (!displayName) return { ok: false, message: "Add the name people will see." };
  if (displayName.length > MAX_DISPLAY_NAME) return { ok: false, message: `A name is at most ${MAX_DISPLAY_NAME} characters.` };
  if (bio.length > MAX_BIO) return { ok: false, message: `A bio is at most ${MAX_BIO} characters.` };
  if (await builderOfAccount(db, accountId)) return { ok: false, message: "Your account already has a builder profile." };
  if (takenOnOpenproduct || (await builderByHandle(db, checked.handle))) return { ok: false, message: "That handle is taken. Pick another." };
  await db
    .prepare(`INSERT INTO builders (handle, account_id, kind, display_name, bio, created_at) VALUES (?, ?, 'new', ?, ?, ?)`)
    .bind(checked.handle, accountId, displayName, bio || null, now.toISOString())
    .run();
  return { ok: true, handle: checked.handle };
}

/** Edit the name and bio of a profile started here. A claimed profile's come from openproduct.live. */
export async function updateNewBuilder(db: Db, accountId: string, input: { displayName: string; bio: string }): Promise<ProfileWrite> {
  const own = await builderOfAccount(db, accountId);
  if (!own) return { ok: false, message: "You don't have a builder profile yet." };
  if (own.kind !== "new") return { ok: false, message: "A claimed profile's name and bio are edited on openproduct.live." };
  const displayName = input.displayName.trim();
  const bio = input.bio.trim();
  if (!displayName) return { ok: false, message: "Add the name people will see." };
  if (displayName.length > MAX_DISPLAY_NAME) return { ok: false, message: `A name is at most ${MAX_DISPLAY_NAME} characters.` };
  if (bio.length > MAX_BIO) return { ok: false, message: `A bio is at most ${MAX_BIO} characters.` };
  await db.prepare(`UPDATE builders SET display_name = ?, bio = ? WHERE account_id = ?`).bind(displayName, bio || null, accountId).run();
  return { ok: true, handle: own.handle };
}
