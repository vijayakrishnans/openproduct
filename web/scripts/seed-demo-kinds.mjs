#!/usr/bin/env node
// Demo kinds of writing (topics-and-community TC2): kinds on the demo posts,
// plus a baseline and a launch. Run after seed-demo.mjs, seed-demo-listings.mjs
// and seed-demo-topics.mjs. Prints SQL; --remove prints the SQL that undoes it.

const remove = process.argv.includes("--remove");
const NOW = Date.now();
const at = (hoursAgo) => new Date(NOW - hoursAgo * 3600_000).toISOString();
const q = (v) => (v === null || v === undefined ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);
const out = [];
const sql = (s) => out.push(s);
const NEW = ["de300000-0000-4000-8002-000000000023", "de300000-0000-4000-8002-000000000024"];

sql(`DELETE FROM content_topics WHERE content_id IN (${NEW.map(q).join(", ")});`);
sql(`DELETE FROM articles WHERE id IN (${NEW.map(q).join(", ")});`);
sql(`UPDATE articles SET kind = 'blog', minutes = NULL, reviewed_at = NULL, repo_url = NULL WHERE id LIKE 'de300000-%';`);

if (!remove) {
  sql(`UPDATE articles SET kind = 'tutorial', minutes = 10 WHERE id = 'de300000-0000-4000-8002-000000000021';`);
  sql(`UPDATE articles SET kind = 'tutorial', minutes = 15 WHERE id = 'de300000-0000-4000-8002-000000000022';`);
  sql(`UPDATE articles SET kind = 'doc', reviewed_at = ${q(at(30))} WHERE id = 'de300000-0000-4000-8002-000000000017';`);
  sql(
    `INSERT INTO articles (id, author_account_id, title, body, video_provider, video_id, build_slug, created_at, updated_at, kind, repo_url) VALUES (${q(NEW[0])}, 'demo-mira', 'A Next.js + D1 starter for Workers', ${q("Everything this directory runs on, as a starter you can copy:\n\n- Next.js on Workers through OpenNext\n- a D1 database that migrates itself on first request\n- sign-in, sessions and a moderation queue\n- dark mode and a phone layout\n\nCopy it, rename it, and you have a working product shell in an afternoon.")}, NULL, NULL, NULL, ${q(at(12))}, ${q(at(12))}, 'baseline', 'https://github.com/vijayakrishnans/openproduct');`,
  );
  sql(
    `INSERT INTO articles (id, author_account_id, title, body, video_provider, video_id, build_slug, created_at, updated_at, kind) VALUES (${q(NEW[1])}, 'demo-tomas', 'openproduct-web is live', ${q("The open build directory is listed here now, with live numbers from its repo, open seats, and a pitch.\n\n**What we'd love:** a frontend engineer for the build pages, and a design partner who lists their own build and tells us where it hurt. Raise a hand on either seat.")}, NULL, NULL, 'openproduct-web', ${q(at(3))}, ${q(at(3))}, 'launch');`,
  );
  const tags = [[NEW[0], ["cloudflare-workers", "nextjs", "d1"]], [NEW[1], ["cloudflare-workers", "open-source"]]];
  for (const [id, topics] of tags) for (const t of topics) sql(`INSERT OR IGNORE INTO content_topics (content_kind, content_id, topic, created_at) VALUES ('article', ${q(id)}, ${q(t)}, ${q(at(2))});`);
}

process.stdout.write(out.join("\n") + "\n");
