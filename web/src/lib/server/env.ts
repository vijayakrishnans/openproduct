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
  /** Optional: a GitHub token for reading merged PRs (BP7); otherwise the OAuth app's id and secret are used. */
  GITHUB_TOKEN?: string;
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
