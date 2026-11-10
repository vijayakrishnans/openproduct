// Demo sign-in (OP-34): on stage, anyone can be one of the demo accounts the
// seed script makes, to see every signed-in screen without a provider. Only
// `demo-` accounts can be entered this way, and only while DEMO_SIGNIN is on.
import type { Db } from "../server/db";

export const isDemoAccount = (accountId: string | null | undefined) => !!accountId && accountId.startsWith("demo-");

export type DemoAccount = { accountId: string; handle: string; name: string; bio: string | null; moderator: boolean };

/** The demo accounts that exist (made by scripts/seed-demo.mjs), moderator last. */
export async function demoAccounts(db: Db): Promise<DemoAccount[]> {
  const rows = await db
    .prepare(
      `SELECT a.id, b.handle, b.display_name, b.bio,
              EXISTS (SELECT 1 FROM identities i WHERE i.account_id = a.id AND i.provider = 'github' AND i.login = 'demo-moderator') AS moderator
         FROM accounts a JOIN builders b ON b.account_id = a.id
        WHERE a.id LIKE 'demo-%'
        ORDER BY moderator, a.created_at`,
    )
    .all<{ id: string; handle: string; display_name: string | null; bio: string | null; moderator: number }>();
  return rows.results.map((r) => ({ accountId: r.id, handle: r.handle, name: r.display_name ?? r.handle, bio: r.bio, moderator: r.moderator === 1 }));
}
