// Upvotes, follows and raised hands (OP-25): what used to send people to
// openproduct.live, done here. Each is one row per account, toggled on and
// off; counts are public, who voted isn't, and a raised hand shows the
// builder's profile so the maintainer can reach them.
import type { Db } from "../server/db";
import { builderOfAccount } from "./builders";

const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/;
const HANDLE = /^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$/i;
const ROLE_ID = /^[A-Za-z0-9_-]{1,64}$/;

export type FollowKind = "build" | "builder";

const validKey = (kind: FollowKind, key: string) => (kind === "build" ? SLUG.test(key) : HANDLE.test(key));

/** Turn an upvote on or off; returns whether it's on now. */
export async function toggleVote(db: Db, accountId: string, slug: string, now = new Date()): Promise<boolean | null> {
  if (!SLUG.test(slug)) return null;
  const had = await db.prepare(`DELETE FROM votes WHERE account_id = ? AND slug = ? RETURNING slug`).bind(accountId, slug).first();
  if (had) return false;
  await db.prepare(`INSERT OR IGNORE INTO votes (account_id, slug, created_at) VALUES (?, ?, ?)`).bind(accountId, slug, now.toISOString()).run();
  return true;
}

/** Upvotes made here, per build. */
export async function voteCounts(db: Db): Promise<Map<string, number>> {
  const rows = await db.prepare(`SELECT slug, count(*) AS n FROM votes GROUP BY slug`).all<{ slug: string; n: number }>();
  return new Map(rows.results.map((r) => [r.slug.toLowerCase(), r.n]));
}

/** One build's upvotes made here, and whether this account is among them. */
export async function voteState(db: Db, slug: string, accountId: string | null): Promise<{ count: number; mine: boolean }> {
  const row = await db
    .prepare(`SELECT count(*) AS n, coalesce(sum(account_id = ?), 0) AS mine FROM votes WHERE slug = ?`)
    .bind(accountId ?? "", slug)
    .first<{ n: number; mine: number }>();
  return { count: row?.n ?? 0, mine: (row?.mine ?? 0) > 0 };
}

/** Builds with this site's upvotes added to openproduct.live's, so cards and sorting agree with the build page. */
export function withVotes<T extends { slug: string; upvotes: number }>(builds: T[], counts: Map<string, number>): T[] {
  return builds.map((b) => {
    const extra = counts.get(b.slug.toLowerCase()) ?? 0;
    return extra ? { ...b, upvotes: b.upvotes + extra } : b;
  });
}

export async function toggleFollow(db: Db, accountId: string, kind: FollowKind, key: string, now = new Date()): Promise<boolean | null> {
  if (!validKey(kind, key)) return null;
  const had = await db
    .prepare(`DELETE FROM follows WHERE account_id = ? AND kind = ? AND key = ? RETURNING key`)
    .bind(accountId, kind, key)
    .first();
  if (had) return false;
  await db
    .prepare(`INSERT OR IGNORE INTO follows (account_id, kind, key, created_at) VALUES (?, ?, ?, ?)`)
    .bind(accountId, kind, key, now.toISOString())
    .run();
  return true;
}

export async function followState(db: Db, kind: FollowKind, key: string, accountId: string | null): Promise<{ count: number; mine: boolean }> {
  const row = await db
    .prepare(`SELECT count(*) AS n, coalesce(sum(account_id = ?), 0) AS mine FROM follows WHERE kind = ? AND key = ?`)
    .bind(accountId ?? "", kind, key)
    .first<{ n: number; mine: number }>();
  return { count: row?.n ?? 0, mine: (row?.mine ?? 0) > 0 };
}

/** What an account follows, newest first, for its account page. */
export async function followingOf(db: Db, accountId: string): Promise<{ kind: FollowKind; key: string }[]> {
  const rows = await db
    .prepare(`SELECT kind, key FROM follows WHERE account_id = ? ORDER BY created_at DESC`)
    .bind(accountId)
    .all<{ kind: FollowKind; key: string }>();
  return rows.results;
}

/**
 * Raise or lower a hand for a seat. Only a builder can raise one: the
 * point is that the maintainer sees who, and can open their profile.
 */
export async function toggleHand(
  db: Db,
  accountId: string,
  slug: string,
  roleId: string,
  now = new Date(),
): Promise<{ ok: true; raised: boolean } | { ok: false; message: string }> {
  if (!SLUG.test(slug) || !ROLE_ID.test(roleId)) return { ok: false, message: "That seat doesn't exist." };
  if (!(await builderOfAccount(db, accountId))) return { ok: false, message: "Start or claim your builder profile first, so the maintainer can see who you are." };
  const had = await db
    .prepare(`DELETE FROM seat_hands WHERE account_id = ? AND slug = ? AND role_id = ? RETURNING slug`)
    .bind(accountId, slug, roleId)
    .first();
  if (had) return { ok: true, raised: false };
  await db
    .prepare(`INSERT OR IGNORE INTO seat_hands (account_id, slug, role_id, created_at) VALUES (?, ?, ?, ?)`)
    .bind(accountId, slug, roleId, now.toISOString())
    .run();
  return { ok: true, raised: true };
}

export type Hand = { handle: string; name: string; mine: boolean };

/** Raised hands on a build's seats, by role id, oldest first; only builders with a profile are shown. */
export async function handsFor(db: Db, slug: string, accountId: string | null): Promise<Map<string, Hand[]>> {
  const rows = await db
    .prepare(
      `SELECT h.role_id, h.account_id, b.handle, b.display_name FROM seat_hands h
         JOIN builders b ON b.account_id = h.account_id
        WHERE h.slug = ? ORDER BY h.created_at`,
    )
    .bind(slug)
    .all<{ role_id: string; account_id: string; handle: string; display_name: string | null }>();
  const out = new Map<string, Hand[]>();
  for (const r of rows.results) {
    const list = out.get(r.role_id) ?? [];
    list.push({ handle: r.handle, name: r.display_name ?? r.handle, mine: r.account_id === accountId });
    out.set(r.role_id, list);
  }
  return out;
}
