// The worker's bindings and secrets, read through OpenNext. Secrets are set
// by the owner with `wrangler secret put` (design D12); a missing one turns
// its provider off rather than breaking the page.
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ensureSchema, type Db } from "./db";

export type AppEnv = {
  DB?: Db;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  /** Sign in with Apple (BP3): the Services ID, team, key id, and the .p8 key's PEM text. */
  APPLE_CLIENT_ID?: string;
  APPLE_TEAM_ID?: string;
  APPLE_KEY_ID?: string;
  APPLE_PRIVATE_KEY?: string;
  /** Email links (BP3): Cloudflare Email Service's send binding, and the address mail comes from. */
  EMAIL?: { send(message: { from: string | { email: string; name?: string }; to: string; subject: string; html: string; text: string }): Promise<{ messageId?: string }> };
  EMAIL_FROM?: string;
  /** Optional: a GitHub token for reading merged PRs (BP7); otherwise the OAuth app's id and secret are used. */
  GITHUB_TOKEN?: string;
  /** "on" lets anyone sign in as a demo account at /demo (OP-34). Stage only: the deploy sets "off" for prod. */
  DEMO_SIGNIN?: string;
  /** Comma-separated GitHub logins who may hide posts; defaults to the site owner. */
  MODERATORS?: string;
};

export async function appEnv(): Promise<AppEnv> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return env as unknown as AppEnv;
  } catch {
    // `next dev` without the Cloudflare dev proxy: no bindings at all.
    return {};
  }
}

/** The database, migrated; null where the binding is missing (plain `next dev`). */
export async function database(): Promise<Db | null> {
  const env = await appEnv();
  if (!env.DB) return null;
  await ensureSchema(env.DB);
  return env.DB;
}

/** Demo sign-in is on (stage and local only). */
export function demoSignIn(env: AppEnv): boolean {
  return env.DEMO_SIGNIN === "on";
}
