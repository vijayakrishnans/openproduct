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
  {
    version: 4,
    name: "builder posts",
    statements: [
      // builder-profiles BP6 (D7): a builder's own writing. Called "articles"
      // here because `posts` already holds discussion replies; the site calls
      // them posts. A post belongs to its author's page, so deleting the
      // account deletes the posts (CASCADE), unlike discussion replies.
      // A video is stored as provider and id only, never as a URL or HTML.
      `CREATE TABLE IF NOT EXISTS articles (
         id TEXT PRIMARY KEY,
         author_account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
         title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 140),
         body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 20000),
         video_provider TEXT CHECK (video_provider IN ('youtube', 'vimeo', 'loom')),
         video_id TEXT,
         build_slug TEXT,
         created_at TEXT NOT NULL,
         updated_at TEXT NOT NULL,
         hidden INTEGER NOT NULL DEFAULT 0
       )`,
      `CREATE INDEX IF NOT EXISTS articles_latest ON articles(hidden, created_at)`,
      `CREATE INDEX IF NOT EXISTS articles_author ON articles(author_account_id, created_at)`,
      // Reports now cover posts too. SQLite can't widen a CHECK in place, so
      // the table is rebuilt with its rows. The batch is one transaction, and
      // running it twice copies the already-rebuilt table, so a second isolate
      // racing the first loses nothing.
      `CREATE TABLE IF NOT EXISTS reports_v4 (
         target_kind TEXT NOT NULL CHECK (target_kind IN ('thread', 'post', 'article')),
         target_id TEXT NOT NULL,
         reporter_account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
         reason TEXT,
         created_at TEXT NOT NULL,
         resolved INTEGER NOT NULL DEFAULT 0,
         PRIMARY KEY (target_kind, target_id, reporter_account_id)
       )`,
      `INSERT OR IGNORE INTO reports_v4 SELECT target_kind, target_id, reporter_account_id, reason, created_at, resolved FROM reports`,
      `DROP TABLE reports`,
      `ALTER TABLE reports_v4 RENAME TO reports`,
    ],
  },
  {
    version: 5,
    name: "merged prs",
    statements: [
      // builder-profiles BP7: a GitHub login's merged PRs per build repo,
      // as read from GitHub's search, kept for a day. Public data, keyed by
      // login rather than account, so nothing personal is stored.
      `CREATE TABLE IF NOT EXISTS merged_prs (
         login TEXT PRIMARY KEY COLLATE NOCASE,
         by_repo TEXT NOT NULL,
         fetched_at TEXT NOT NULL
       )`,
    ],
  },
  {
    version: 6,
    name: "everything here",
    statements: [
      // OP-25: what used to send people to openproduct.live happens here.
      // Upvotes on a build: one per account, added to the build's count there.
      `CREATE TABLE IF NOT EXISTS votes (
         account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
         slug TEXT NOT NULL COLLATE NOCASE,
         created_at TEXT NOT NULL,
         PRIMARY KEY (account_id, slug)
       )`,
      `CREATE INDEX IF NOT EXISTS votes_slug ON votes(slug)`,
      // Following a build or a builder.
      `CREATE TABLE IF NOT EXISTS follows (
         account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
         kind TEXT NOT NULL CHECK (kind IN ('build', 'builder')),
         key TEXT NOT NULL COLLATE NOCASE,
         created_at TEXT NOT NULL,
         PRIMARY KEY (account_id, kind, key)
       )`,
      `CREATE INDEX IF NOT EXISTS follows_target ON follows(kind, key)`,
      // A raised hand for an open seat: "I'd like this one", visible on the build.
      `CREATE TABLE IF NOT EXISTS seat_hands (
         account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
         slug TEXT NOT NULL COLLATE NOCASE,
         role_id TEXT NOT NULL,
         created_at TEXT NOT NULL,
         PRIMARY KEY (account_id, slug, role_id)
       )`,
      `CREATE INDEX IF NOT EXISTS seat_hands_build ON seat_hands(slug)`,
      // Replies written here to a thread from openproduct.live hang off a
      // stand-in thread row with the same id, marked remote: it carries the
      // replies, reports and hiding, and is never listed on its own.
      `ALTER TABLE threads ADD COLUMN remote INTEGER NOT NULL DEFAULT 0`,
    ],
  },
  {
    version: 7,
    name: "email links",
    statements: [
      // builder-profiles BP3: one-time sign-in links. Only the token's
      // SHA-256 is stored; a link works once, within 15 minutes.
      `CREATE TABLE IF NOT EXISTS email_links (
         id_hash TEXT PRIMARY KEY,
         email TEXT NOT NULL COLLATE NOCASE,
         next TEXT NOT NULL,
         created_at INTEGER NOT NULL,
         expires_at INTEGER NOT NULL,
         used_at INTEGER
       )`,
      `CREATE INDEX IF NOT EXISTS email_links_email ON email_links(email, created_at)`,
    ],
  },
  {
    version: 8,
    name: "listings",
    statements: [
      // list-your-build LB1 (D1, D2, D5): builds listed here. A listing is a
      // public GitHub repo its maintainers proved they control; it's a draft,
      // seen only by them, until verified with a tagline and a category.
      `CREATE TABLE IF NOT EXISTS listings (
         slug TEXT PRIMARY KEY COLLATE NOCASE,
         repo TEXT NOT NULL UNIQUE COLLATE NOCASE,
         state TEXT NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'published', 'hidden', 'unavailable')),
         verify_code TEXT NOT NULL,
         verified_at TEXT,
         tagline TEXT CHECK (tagline IS NULL OR length(tagline) <= 120),
         category TEXT,
         stack TEXT NOT NULL DEFAULT '[]',
         description TEXT,
         licence TEXT,
         created_by TEXT REFERENCES accounts(id) ON DELETE SET NULL,
         created_at TEXT NOT NULL,
         updated_at TEXT NOT NULL,
         published_at TEXT
       )`,
      `CREATE INDEX IF NOT EXISTS listings_state ON listings(state, published_at)`,
      `CREATE INDEX IF NOT EXISTS listings_creator ON listings(created_by, created_at)`,
      `CREATE TABLE IF NOT EXISTS listing_maintainers (
         slug TEXT NOT NULL REFERENCES listings(slug) ON DELETE CASCADE ON UPDATE CASCADE,
         account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
         role TEXT NOT NULL DEFAULT 'maintainer' CHECK (role IN ('owner', 'maintainer')),
         accepted_at TEXT,
         PRIMARY KEY (slug, account_id)
       )`,
      `CREATE INDEX IF NOT EXISTS listing_maintainers_account ON listing_maintainers(account_id)`,
    ],
  },
  {
    version: 9,
    name: "listing stats",
    statements: [
      // list-your-build LB2 (D3): what the repo says, cached for an hour.
      // `status` is "missing" while GitHub answers 404 (private or deleted);
      // the directory leaves such a listing out until the repo is back.
      `CREATE TABLE IF NOT EXISTS listing_stats (
         slug TEXT PRIMARY KEY REFERENCES listings(slug) ON DELETE CASCADE ON UPDATE CASCADE,
         status TEXT NOT NULL CHECK (status IN ('ok', 'missing')),
         changes_7d INTEGER NOT NULL DEFAULT 0,
         licence TEXT,
         last_commit_at TEXT,
         languages TEXT NOT NULL DEFAULT '[]',
         archived INTEGER NOT NULL DEFAULT 0,
         fetched_at TEXT NOT NULL
       )`,
    ],
  },
  {
    version: 10,
    name: "listing roles",
    statements: [
      // list-your-build LB3: open seats on builds listed here. Closed seats
      // are kept (open = 0) so raised hands and links to them still resolve.
      `CREATE TABLE IF NOT EXISTS listing_roles (
         id TEXT PRIMARY KEY,
         slug TEXT NOT NULL REFERENCES listings(slug) ON DELETE CASCADE ON UPDATE CASCADE,
         title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 80),
         type TEXT NOT NULL,
         description TEXT CHECK (description IS NULL OR length(description) <= 600),
         commitment TEXT CHECK (commitment IS NULL OR length(commitment) <= 80),
         open INTEGER NOT NULL DEFAULT 1,
         created_at TEXT NOT NULL,
         updated_at TEXT NOT NULL
       )`,
      `CREATE INDEX IF NOT EXISTS listing_roles_slug ON listing_roles(slug, open)`,
    ],
  },
  {
    version: 11,
    name: "listing team",
    statements: [
      // list-your-build LB4: a maintainer invite is a row with accepted_at NULL
      // until the invitee accepts; contributors are the repo's GitHub logins.
      `ALTER TABLE listing_maintainers ADD COLUMN invited_at TEXT`,
      `ALTER TABLE listing_stats ADD COLUMN contributors TEXT NOT NULL DEFAULT '[]'`,
    ],
  },
  {
    version: 12,
    name: "listing pitch and cover",
    statements: [
      // list-your-build LB5: a pitch in the posts' Markdown subset, a live
      // URL, an optional Orunbase workspace reference, and an R2 cover key.
      `ALTER TABLE listings ADD COLUMN pitch TEXT CHECK (pitch IS NULL OR length(pitch) <= 5000)`,
      `ALTER TABLE listings ADD COLUMN live_url TEXT`,
      `ALTER TABLE listings ADD COLUMN workspace_ref TEXT`,
      `ALTER TABLE listings ADD COLUMN cover_key TEXT`,
    ],
  },
  {
    version: 13,
    name: "listing moderation",
    statements: [
      // list-your-build LB6: listings can be reported (target_id is the slug).
      // Reports are rebuilt to widen the CHECK, as in migration 4; running it
      // twice copies the already-rebuilt table, so racing isolates lose nothing.
      `CREATE TABLE IF NOT EXISTS reports_v13 (
         target_kind TEXT NOT NULL CHECK (target_kind IN ('thread', 'post', 'article', 'listing')),
         target_id TEXT NOT NULL,
         reporter_account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
         reason TEXT,
         created_at TEXT NOT NULL,
         resolved INTEGER NOT NULL DEFAULT 0,
         PRIMARY KEY (target_kind, target_id, reporter_account_id)
       )`,
      `INSERT OR IGNORE INTO reports_v13 SELECT target_kind, target_id, reporter_account_id, reason, created_at, resolved FROM reports`,
      `DROP TABLE reports`,
      `ALTER TABLE reports_v13 RENAME TO reports`,
      // A renamed listing's old address redirects for 30 days.
      `CREATE TABLE IF NOT EXISTS listing_redirects (
         old_slug TEXT PRIMARY KEY COLLATE NOCASE,
         new_slug TEXT NOT NULL COLLATE NOCASE,
         created_at TEXT NOT NULL
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
    try {
      await db.batch([
        ...m.statements.map((s) => db.prepare(s)),
        db
          .prepare(`INSERT OR IGNORE INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)`)
          .bind(m.version, m.name, new Date().toISOString()),
      ]);
    } catch (e) {
      // Another isolate may have applied it between our read and our batch
      // (an ALTER TABLE can't be repeated). The batch is one transaction, so
      // a failure changed nothing: if the version is recorded now, move on.
      const now = await db.prepare(`SELECT 1 AS x FROM schema_migrations WHERE version = ?`).bind(m.version).first();
      if (!now) throw e;
    }
  }
  applied.add(db);
}
