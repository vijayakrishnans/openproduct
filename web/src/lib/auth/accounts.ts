// Accounts and identities (design D9, D11). One account, many ways in; a
// new way in while signed out is a new account, and accounts are never
// merged by matching email.
import type { Db } from "../server/db";
import { newId } from "./crypto";
import type { IdentityProvider, ProviderProfile } from "./providers";

export type Identity = { provider: IdentityProvider; login: string | null; createdAt: string };

export type SignInOutcome =
  | { kind: "signed-in"; accountId: string; created: boolean }
  | { kind: "linked"; accountId: string }
  | { kind: "already-linked"; accountId: string }
  | { kind: "taken" };

/**
 * Resolve a completed provider sign-in.
 *
 * - Signed out, known identity: sign in to its account (and refresh the login it shows).
 * - Signed out, new identity: a new account.
 * - Signed in, new identity: attach it to the current account.
 * - Signed in, identity already on this account: nothing to do.
 * - Signed in, identity on ANOTHER account: refused — moving it would let
 *   whoever is signed in take over someone else's way in.
 */
export async function resolveSignIn(
  db: Db,
  provider: IdentityProvider,
  profile: ProviderProfile,
  currentAccountId: string | null,
  now = new Date(),
): Promise<SignInOutcome> {
  const existing = await db
    .prepare(`SELECT account_id FROM identities WHERE provider = ? AND provider_user_id = ?`)
    .bind(provider, profile.providerUserId)
    .first<{ account_id: string }>();

  if (existing) {
    await db
      .prepare(`UPDATE identities SET login = ? WHERE provider = ? AND provider_user_id = ?`)
      .bind(profile.login, provider, profile.providerUserId)
      .run();
    if (currentAccountId === null) return { kind: "signed-in", accountId: existing.account_id, created: false };
    return existing.account_id === currentAccountId ? { kind: "already-linked", accountId: currentAccountId } : { kind: "taken" };
  }

  const at = now.toISOString();
  if (currentAccountId !== null) {
    await db
      .prepare(`INSERT INTO identities (provider, provider_user_id, account_id, login, created_at) VALUES (?, ?, ?, ?, ?)`)
      .bind(provider, profile.providerUserId, currentAccountId, profile.login, at)
      .run();
    // Fill in a name or picture the account doesn't have yet; never overwrite.
    await db
      .prepare(`UPDATE accounts SET display_name = COALESCE(display_name, ?), avatar_url = COALESCE(avatar_url, ?), email = COALESCE(email, ?) WHERE id = ?`)
      .bind(profile.displayName, profile.avatarUrl, profile.email, currentAccountId)
      .run();
    return { kind: "linked", accountId: currentAccountId };
  }

  const accountId = newId();
  await db.batch([
    db
      .prepare(`INSERT INTO accounts (id, display_name, avatar_url, email, created_at) VALUES (?, ?, ?, ?, ?)`)
      .bind(accountId, profile.displayName, profile.avatarUrl, profile.email, at),
    db
      .prepare(`INSERT INTO identities (provider, provider_user_id, account_id, login, created_at) VALUES (?, ?, ?, ?, ?)`)
      .bind(provider, profile.providerUserId, accountId, profile.login, at),
  ]);
  return { kind: "signed-in", accountId, created: true };
}

export async function identitiesOf(db: Db, accountId: string): Promise<Identity[]> {
  const rows = await db
    .prepare(`SELECT provider, login, created_at FROM identities WHERE account_id = ? ORDER BY created_at`)
    .bind(accountId)
    .all<{ provider: IdentityProvider; login: string | null; created_at: string }>();
  return rows.results.map((r) => ({ provider: r.provider, login: r.login, createdAt: r.created_at }));
}

/** The GitHub login an account signed in with, if any — what a claim is proved by (D10). */
export async function githubLoginOf(db: Db, accountId: string): Promise<string | null> {
  const row = await db
    .prepare(`SELECT login FROM identities WHERE account_id = ? AND provider = 'github' AND login IS NOT NULL ORDER BY created_at LIMIT 1`)
    .bind(accountId)
    .first<{ login: string }>();
  return row?.login ?? null;
}

/** Delete an account and everything hanging off it (D11). Cascades take identities, sessions and the builder profile. */
export async function deleteAccount(db: Db, accountId: string): Promise<void> {
  await db.prepare(`DELETE FROM accounts WHERE id = ?`).bind(accountId).run();
}
