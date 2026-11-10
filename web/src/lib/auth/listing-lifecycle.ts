// Moderation and lifecycle for builds listed here (list-your-build LB6).
// Anyone signed in can report a listing; a moderator hides it (out of Open
// builds, 404 to everyone but moderators) or restores it. Owners delete a
// listing or rename its slug: everything keyed by the slug moves with it,
// and the old address redirects for 30 days. Drafts never verified are
// deleted after 14 days, freeing their slugs.
import type { Db } from "../server/db";
import type { CoverBucket } from "../server/env";
import { checkSlug, getListing, missingForPublish } from "./listings";
import { teamOf } from "./listing-team";

export const REDIRECT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const DRAFT_TTL_MS = 14 * 24 * 60 * 60 * 1000;

type Write = { ok: true } | { ok: false; message: string };

export async function reportListing(db: Db, accountId: string, slug: string, reason: string, now = Date.now()): Promise<boolean> {
  const l = await getListing(db, slug);
  if (!l || l.state !== "published") return false;
  await db
    .prepare(`INSERT OR IGNORE INTO reports (target_kind, target_id, reporter_account_id, reason, created_at) VALUES ('listing', ?, ?, ?, ?)`)
    .bind(l.slug, accountId, reason.trim().slice(0, 300) || null, new Date(now).toISOString())
    .run();
  return true;
}

/**
 * Hide or restore a listing, and resolve its reports. Moderators only; the
 * caller checks. Restoring puts back a publishable listing as published,
 * anything else as a draft.
 */
export async function setListingHidden(db: Db, slug: string, hidden: boolean, now = Date.now()): Promise<boolean> {
  const l = await getListing(db, slug);
  if (!l) return false;
  const state = hidden ? "hidden" : missingForPublish(l).length ? "draft" : "published";
  await db.batch([
    db.prepare(`UPDATE listings SET state = ?, updated_at = ? WHERE slug = ?`).bind(state, new Date(now).toISOString(), l.slug),
    db.prepare(`UPDATE reports SET resolved = 1 WHERE target_kind = 'listing' AND target_id = ?`).bind(l.slug),
  ]);
  return true;
}

async function isOwner(db: Db, slug: string, accountId: string): Promise<boolean> {
  return (await teamOf(db, slug)).some((m) => m.accountId === accountId && m.role === "owner" && !m.pending);
}

/** Delete a listing and everything that hangs off its slug. Owners only. */
export async function deleteListing(db: Db, bucket: CoverBucket | undefined, slug: string, accountId: string): Promise<Write> {
  const l = await getListing(db, slug);
  if (!l || !(await isOwner(db, l.slug, accountId))) return { ok: false, message: "Only an owner can delete a listing." };
  await db.batch([
    // Maintainers, seats and stats go by foreign key; these are keyed by slug alone.
    db.prepare(`DELETE FROM votes WHERE slug = ?`).bind(l.slug),
    db.prepare(`DELETE FROM follows WHERE kind = 'build' AND key = ?`).bind(l.slug),
    db.prepare(`DELETE FROM seat_hands WHERE slug = ?`).bind(l.slug),
    db.prepare(`DELETE FROM support_links WHERE owner_kind = 'build' AND owner_key = ?`).bind(l.slug),
    db.prepare(`DELETE FROM reports WHERE target_kind = 'listing' AND target_id = ?`).bind(l.slug),
    db.prepare(`DELETE FROM listing_redirects WHERE new_slug = ?`).bind(l.slug),
    db.prepare(`DELETE FROM listings WHERE slug = ?`).bind(l.slug),
  ]);
  if (l.coverKey && bucket) await bucket.delete(l.coverKey).catch(() => undefined);
  return { ok: true };
}

/**
 * Give a listing a new slug. Owners only; the new one must be free here and
 * on openproduct.live. Votes, follows, raised hands, support links, reports
 * and posts about the build move with it, and the old slug redirects.
 */
export async function renameListing(
  db: Db,
  slug: string,
  accountId: string,
  raw: string,
  takenThere: (slug: string) => Promise<boolean | "unreachable">,
  now = Date.now(),
): Promise<{ ok: true; slug: string } | { ok: false; message: string }> {
  const l = await getListing(db, slug);
  if (!l || !(await isOwner(db, l.slug, accountId))) return { ok: false, message: "Only an owner can rename a listing." };
  const check = checkSlug(raw);
  if (!check.ok) return check;
  const next = check.slug;
  if (next === l.slug) return { ok: true, slug: next };
  const here = await db.prepare(`SELECT 1 AS x FROM listings WHERE slug = ?`).bind(next).first();
  if (here) return { ok: false, message: "That name is taken here. Pick another." };
  // A slug someone else renamed away from is still theirs for 30 days.
  const held = await db.prepare(`SELECT new_slug FROM listing_redirects WHERE old_slug = ? AND created_at > ?`).bind(next, new Date(now - REDIRECT_TTL_MS).toISOString()).first<{ new_slug: string }>();
  if (held && held.new_slug !== l.slug) return { ok: false, message: "That name was used recently. Pick another." };
  const there = await takenThere(next);
  if (there === "unreachable") return { ok: false, message: "We couldn't check that name just now. Try again in a minute." };
  if (there) return { ok: false, message: "That name is taken by a build on openproduct. Pick another." };

  const at = new Date(now).toISOString();
  await db.batch([
    // Maintainers, seats and stats follow by ON UPDATE CASCADE.
    db.prepare(`UPDATE listings SET slug = ?, updated_at = ? WHERE slug = ?`).bind(next, at, l.slug),
    db.prepare(`UPDATE votes SET slug = ? WHERE slug = ?`).bind(next, l.slug),
    db.prepare(`UPDATE follows SET key = ? WHERE kind = 'build' AND key = ?`).bind(next, l.slug),
    db.prepare(`UPDATE seat_hands SET slug = ? WHERE slug = ?`).bind(next, l.slug),
    db.prepare(`UPDATE support_links SET owner_key = ? WHERE owner_kind = 'build' AND owner_key = ?`).bind(next, l.slug),
    db.prepare(`UPDATE reports SET target_id = ? WHERE target_kind = 'listing' AND target_id = ?`).bind(next, l.slug),
    db.prepare(`UPDATE articles SET build_slug = ? WHERE build_slug = ?`).bind(next, l.slug),
    // Earlier names now point at the newest one, so redirects never chain.
    db.prepare(`UPDATE listing_redirects SET new_slug = ? WHERE new_slug = ?`).bind(next, l.slug),
    db.prepare(`DELETE FROM listing_redirects WHERE old_slug = ?`).bind(next),
    db.prepare(`INSERT INTO listing_redirects (old_slug, new_slug, created_at) VALUES (?, ?, ?) ON CONFLICT(old_slug) DO UPDATE SET new_slug = excluded.new_slug, created_at = excluded.created_at`).bind(l.slug, next, at),
  ]);
  return { ok: true, slug: next };
}

/** Where an old slug now lives, within 30 days of the rename. */
export async function redirectFor(db: Db, slug: string, now = Date.now()): Promise<string | null> {
  const r = await db
    .prepare(`SELECT new_slug FROM listing_redirects WHERE old_slug = ? AND created_at > ?`)
    .bind(slug.toLowerCase(), new Date(now - REDIRECT_TTL_MS).toISOString())
    .first<{ new_slug: string }>();
  return r?.new_slug ?? null;
}

/** Delete drafts never verified within 14 days, and expired redirects. Returns how many drafts went. */
export async function expireStale(db: Db, now = Date.now()): Promise<number> {
  const old = await db
    .prepare(`SELECT slug FROM listings WHERE state = 'draft' AND verified_at IS NULL AND created_at < ?`)
    .bind(new Date(now - DRAFT_TTL_MS).toISOString())
    .all<{ slug: string }>();
  const stmts = old.results.map((r) => db.prepare(`DELETE FROM listings WHERE slug = ?`).bind(r.slug));
  stmts.push(db.prepare(`DELETE FROM listing_redirects WHERE created_at < ?`).bind(new Date(now - REDIRECT_TTL_MS).toISOString()));
  await db.batch(stmts);
  return old.results.length;
}
