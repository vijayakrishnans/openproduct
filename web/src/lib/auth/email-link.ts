// Sign in with a one-time email link (builder-profiles BP3, design D9).
// The link carries a 256-bit token; only its SHA-256 is stored. It works
// once and expires after 15 minutes. Opening it shows a "Sign in" button
// rather than signing in on the spot, so mail scanners that fetch links
// can't use it up.
import type { Db } from "../server/db";
import type { AppEnv } from "../server/env";
import { randomToken, sha256Hex } from "./crypto";
import { safeNext } from "./guards";

export const LINK_TTL_MS = 15 * 60 * 1000;
/** Links per address per 15 minutes: enough to retry, not enough to flood an inbox. */
export const LINKS_PER_WINDOW = 3;

/** A plausible address, lowercased; null for anything else. Deliverability is the email's job. */
export function normalizeEmail(raw: string): string | null {
  const e = raw.trim().toLowerCase();
  if (e.length > 254 || /[\s<>"',;()\\]/.test(e)) return null;
  return /^[^@]{1,64}@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(e) ? e : null;
}

/** Email sign-in is offered only when the send binding and a from-address are configured. */
export function emailConfigured(env: AppEnv): boolean {
  return !!(env.EMAIL && env.EMAIL_FROM);
}

export async function createEmailLink(
  db: Db,
  email: string,
  next: string,
  now = Date.now(),
): Promise<{ ok: true; token: string } | { ok: false; reason: "limited" }> {
  const recent = await db
    .prepare(`SELECT count(*) AS n FROM email_links WHERE email = ? AND created_at > ?`)
    .bind(email, now - LINK_TTL_MS)
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= LINKS_PER_WINDOW) return { ok: false, reason: "limited" };
  const token = randomToken(32);
  await db.batch([
    // Old links go: nothing needs them after they expire.
    db.prepare(`DELETE FROM email_links WHERE expires_at < ?`).bind(now - LINK_TTL_MS),
    db
      .prepare(`INSERT INTO email_links (id_hash, email, next, created_at, expires_at) VALUES (?, ?, ?, ?, ?)`)
      .bind(await sha256Hex(token), email, safeNext(next), now, now + LINK_TTL_MS),
  ]);
  return { ok: true, token };
}

/** Is this link still good? Doesn't use it up (for the confirm page). */
export async function peekEmailLink(db: Db, token: string, now = Date.now()): Promise<{ email: string } | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const row = await db
    .prepare(`SELECT email FROM email_links WHERE id_hash = ? AND used_at IS NULL AND expires_at > ?`)
    .bind(await sha256Hex(token), now)
    .first<{ email: string }>();
  return row ? { email: row.email } : null;
}

/** Use the link: once, before it expires. A single UPDATE, so two clicks can't both win. */
export async function consumeEmailLink(db: Db, token: string, now = Date.now()): Promise<{ email: string; next: string } | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const row = await db
    .prepare(`UPDATE email_links SET used_at = ? WHERE id_hash = ? AND used_at IS NULL AND expires_at > ? RETURNING email, next`)
    .bind(now, await sha256Hex(token), now)
    .first<{ email: string; next: string }>();
  return row ? { email: row.email, next: safeNext(row.next) } : null;
}

/** "a***@example.com": enough for the person to recognise, not enough to read off a screen. */
export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  return `${user!.slice(0, 1)}${"*".repeat(Math.max(2, Math.min(6, user!.length - 1)))}@${domain}`;
}

export function signInEmail(url: string): { subject: string; text: string; html: string } {
  const text = `Sign in to openproduct with this link. It works once, for the next 15 minutes:\n\n${url}\n\nIf you didn't ask for this, ignore this email; nobody can sign in without the link.`;
  const safe = url.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const html = `<p>Sign in to openproduct with this link. It works once, for the next 15 minutes:</p>
<p><a href="${safe}" style="display:inline-block;padding:10px 16px;background:#17150f;color:#fff;border-radius:8px;text-decoration:none">Sign in to openproduct</a></p>
<p style="color:#666;font-size:13px">If you didn't ask for this, ignore this email; nobody can sign in without the link.</p>`;
  return { subject: "Your openproduct sign-in link", text, html };
}
