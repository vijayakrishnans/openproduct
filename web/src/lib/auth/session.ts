// Sessions (design D9): a random 256-bit token in an HttpOnly cookie; the
// database keeps only its SHA-256. 30 days, extended on use once less than
// half remains, so an active builder never gets signed out mid-week.
import type { Db } from "../server/db";
import { randomToken, sha256Hex } from "./crypto";

export const SESSION_COOKIE = "op_session";
export const SESSION_DAYS = 30;
const DAY = 24 * 60 * 60 * 1000;

export type Account = {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
};

export type Session = { account: Account; expiresAt: number; refreshed: boolean };

export async function createSession(db: Db, accountId: string, now = Date.now()): Promise<{ token: string; expiresAt: number }> {
  const token = randomToken(32);
  const expiresAt = now + SESSION_DAYS * DAY;
  await db
    .prepare(`INSERT INTO sessions (id_hash, account_id, expires_at, created_at) VALUES (?, ?, ?, ?)`)
    .bind(await sha256Hex(token), accountId, expiresAt, now)
    .run();
  return { token, expiresAt };
}

/** The session behind a cookie value, or null. Expired rows are deleted on sight. */
export async function validateSession(db: Db, token: string | undefined | null, now = Date.now()): Promise<Session | null> {
  if (!token || token.length < 40 || token.length > 64) return null;
  const idHash = await sha256Hex(token);
  const row = await db
    .prepare(
      `SELECT s.expires_at, a.id, a.display_name, a.avatar_url
         FROM sessions s JOIN accounts a ON a.id = s.account_id
        WHERE s.id_hash = ?`,
    )
    .bind(idHash)
    .first<{ expires_at: number; id: string; display_name: string | null; avatar_url: string | null }>();
  if (!row) return null;
  if (row.expires_at <= now) {
    await db.prepare(`DELETE FROM sessions WHERE id_hash = ?`).bind(idHash).run();
    return null;
  }
  let expiresAt = row.expires_at;
  let refreshed = false;
  if (expiresAt - now < (SESSION_DAYS / 2) * DAY) {
    expiresAt = now + SESSION_DAYS * DAY;
    refreshed = true;
    await db.prepare(`UPDATE sessions SET expires_at = ? WHERE id_hash = ?`).bind(expiresAt, idHash).run();
  }
  return { account: { id: row.id, displayName: row.display_name, avatarUrl: row.avatar_url }, expiresAt, refreshed };
}

export async function invalidateSession(db: Db, token: string | undefined | null): Promise<void> {
  if (!token) return;
  await db.prepare(`DELETE FROM sessions WHERE id_hash = ?`).bind(await sha256Hex(token)).run();
}

/**
 * The cookie outlives the session on purpose: the database decides when a
 * session ends (and extends it on use, which a server component can't
 * mirror into the cookie), so the cookie just has to still be there. A
 * cookie whose session is gone signs nobody in.
 */
export const SESSION_COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

export function sessionCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE,
  };
}
