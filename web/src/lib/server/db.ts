// The site's own database (builder-profiles D8): one D1 per environment,
// bound as `DB`. Everything a builder writes lives here; nothing from
// openproduct.live is copied in.
//
// THE SCHEMA MIGRATES ITSELF. The deploy pipeline runs `wrangler deploy` and
// nothing else, so instead of a migration step the worker applies any
// migration it hasn't seen, once per isolate, before its first query. Every
// statement is idempotent (`IF NOT EXISTS`), and `schema_migrations` records
// what ran, so two isolates racing apply the same thing twice harmlessly.

/** The slice of D1's API this app uses — also what the test adapter implements. */
export interface Db {
  prepare(sql: string): Statement;
  batch(statements: Statement[]): Promise<unknown[]>;
}
export interface Statement {
  bind(...values: unknown[]): Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}

export const MIGRATIONS: { version: number; name: string; statements: string[] }[] = [
  {
    version: 1,
    name: "accounts",
    statements: [
      `CREATE TABLE IF NOT EXISTS accounts (
         id TEXT PRIMARY KEY,
         display_name TEXT,
         avatar_url TEXT,
         email TEXT,
         created_at TEXT NOT NULL
       )`,
      // One row per way in. The provider's own id is the key: a login or an
      // email can change hands, the provider's numeric/opaque id can't.
      `CREATE TABLE IF NOT EXISTS identities (
         provider TEXT NOT NULL,
         provider_user_id TEXT NOT NULL,
         account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
         login TEXT,
         created_at TEXT NOT NULL,
         PRIMARY KEY (provider, provider_user_id)
       )`,
      `CREATE INDEX IF NOT EXISTS identities_account ON identities(account_id)`,
      // Only the SHA-256 of the session token is stored, so a copy of this
      // table can't be replayed as cookies.
      `CREATE TABLE IF NOT EXISTS sessions (
         id_hash TEXT PRIMARY KEY,
         account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
         expires_at INTEGER NOT NULL,
         created_at INTEGER NOT NULL
       )`,
      `CREATE INDEX IF NOT EXISTS sessions_account ON sessions(account_id)`,
      // A builder profile owned by an account: a claimed openproduct.live
      // profile, or a new one started here (D10). One per account.
      `CREATE TABLE IF NOT EXISTS builders (
         handle TEXT PRIMARY KEY COLLATE NOCASE,
         account_id TEXT NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
         kind TEXT NOT NULL CHECK (kind IN ('claimed', 'new')),
         display_name TEXT,
         bio TEXT,
         created_at TEXT NOT NULL
       )`,
      // Small server-owned values, e.g. the Orunbase client id this site
      // registered for itself.
      `CREATE TABLE IF NOT EXISTS settings (
         key TEXT PRIMARY KEY,
         value TEXT NOT NULL,
         updated_at INTEGER NOT NULL
       )`,
    ],
  },
  {
    version: 2,
    name: "support_links",
    statements: [
      // builder-profiles BP4 (D5): up to four links per builder handle or
      // per build slug, in the author's order. `account_id` is who set them;
      // deleting that account deletes them. The allowlist isn't in the
      // schema: it's re-applied on every read, so a provider dropped later
      // stops rendering without a migration.
      `CREATE TABLE IF NOT EXISTS support_links (
         owner_kind TEXT NOT NULL CHECK (owner_kind IN ('builder', 'build')),
         owner_key TEXT NOT NULL COLLATE NOCASE,
         position INTEGER NOT NULL CHECK (position BETWEEN 0 AND 3),
         provider TEXT NOT NULL,
         url TEXT NOT NULL CHECK (length(url) <= 300),
         account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
         updated_at TEXT NOT NULL,
         PRIMARY KEY (owner_kind, owner_key, position)
       )`,
    ],
  },
  {
    version: 3,
    name: "discussions",
    statements: [
      // builder-profiles BP5 (D6): threads written here, with no listing.
      // The author is an account; deleting it keeps the words and shows
      // "deleted builder" (D11), so the reference is SET NULL, not CASCADE.
      `CREATE TABLE IF NOT EXISTS threads (
         id TEXT PRIMARY KEY,
         author_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
         tag TEXT NOT NULL,
         title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 140),
         created_at TEXT NOT NULL,
         last_post_at TEXT NOT NULL,
         post_count INTEGER NOT NULL DEFAULT 1,
         hidden INTEGER NOT NULL DEFAULT 0
       )`,
      `CREATE INDEX IF NOT EXISTS threads_latest ON threads(hidden, last_post_at)`,
      `CREATE INDEX IF NOT EXISTS threads_author ON threads(author_account_id)`,
      `CREATE TABLE IF NOT EXISTS posts (
         id TEXT PRIMARY KEY,
         thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
         author_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
         body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 5000),
         created_at TEXT NOT NULL,
         hidden INTEGER NOT NULL DEFAULT 0
       )`,
      `CREATE INDEX IF NOT EXISTS posts_thread ON posts(thread_id, created_at)`,
      `CREATE INDEX IF NOT EXISTS posts_author ON posts(author_account_id, created_at)`,
      `CREATE TABLE IF NOT EXISTS reports (
         target_kind TEXT NOT NULL CHECK (target_kind IN ('thread', 'post')),
         target_id TEXT NOT NULL,
         reporter_account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
         reason TEXT,
         created_at TEXT NOT NULL,
         resolved INTEGER NOT NULL DEFAULT 0,
         PRIMARY KEY (target_kind, target_id, reporter_account_id)
       )`,
    ],
  },
];

const applied = new WeakSet<object>();

/** Apply every migration this database hasn't recorded. Safe to call on every request. */
export async function ensureSchema(db: Db): Promise<void> {
  if (applied.has(db)) return;
  await db
    .prepare(`CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)`)
    .run();
  const done = await db.prepare(`SELECT version FROM schema_migrations`).all<{ version: number }>();
  const have = new Set(done.results.map((r) => r.version));
  for (const m of MIGRATIONS) {
    if (have.has(m.version)) continue;
    await db.batch([
      ...m.statements.map((s) => db.prepare(s)),
      db
        .prepare(`INSERT OR IGNORE INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)`)
        .bind(m.version, m.name, new Date().toISOString()),
    ]);
  }
  applied.add(db);
}
