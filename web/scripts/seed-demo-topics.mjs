#!/usr/bin/env node
// Demo topics (topics-and-community TC1): topics on the demo posts and
// discussions from seed-demo.mjs, plus two posts written for topics. Run
// after seed-demo.mjs. Prints SQL; --remove prints the SQL that undoes it.

const remove = process.argv.includes("--remove");
const NOW = Date.now();
const at = (hoursAgo) => new Date(NOW - hoursAgo * 3600_000).toISOString();
const q = (v) => (v === null || v === undefined ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);
const out = [];
const sql = (s) => out.push(s);
const LABELS = { "cloudflare-workers": "Cloudflare Workers", nextjs: "Next.js", sqlite: "SQLite", d1: "D1", auth: "Auth", accessibility: "Accessibility", design: "Design", javascript: "JavaScript", performance: "Performance", contributing: "Contributing", "open-source": "Open source", pricing: "Pricing", billing: "Billing", migration: "Migration" };

sql(`DELETE FROM content_topics WHERE content_id LIKE 'de300000-%';`);
sql(`DELETE FROM articles WHERE id IN ('de300000-0000-4000-8002-000000000021', 'de300000-0000-4000-8002-000000000022');`);

if (!remove) {
  for (const [slug, label] of Object.entries(LABELS)) sql(`INSERT OR IGNORE INTO topics (slug, label, created_at) VALUES (${q(slug)}, ${q(label)}, ${q(at(200))});`);

  const posts = [
    ["de300000-0000-4000-8002-000000000021", "demo-tomas", 6, "Deploy a Next.js app to Cloudflare Workers in 10 minutes", "A step-by-step from an empty folder to a live URL, using OpenNext.\n\n## 1. Create the app\n\n```\nnpx create-next-app@latest my-app\n```\n\n## 2. Add the adapter\n\n```\nnpm i -D @opennextjs/cloudflare wrangler\n```\n\n## 3. Deploy\n\n```\nnpx opennextjs-cloudflare build && npx wrangler deploy\n```\n\nThat's it: you get a `workers.dev` address. Add a D1 database when you need data.", "youtube", "Sklc_fQBmcs"],
    ["de300000-0000-4000-8002-000000000022", "demo-priya", 30, "Passwordless sign-in with one-time email links on Workers", "Email links are the friendliest sign-in for people who don't want another password. Three things matter:\n\n1. **Store only a hash** of the token.\n2. **One use, short life**: 15 minutes is plenty.\n3. **A confirm button** on the landing page, because mail scanners open links and would use them up.\n\nThis site does exactly this; the code is in the repo.", null, null],
  ];
  for (const [id, author, h, title, body, vp, vid] of posts) {
    sql(`INSERT INTO articles (id, author_account_id, title, body, video_provider, video_id, build_slug, created_at, updated_at) VALUES (${q(id)}, ${q(author)}, ${q(title)}, ${q(body)}, ${q(vp)}, ${q(vid)}, NULL, ${q(at(h))}, ${q(at(h))});`);
  }

  // [content kind, id suffix, topics]
  const tags = [
    ["article", "8002-000000000016", ["cloudflare-workers", "nextjs", "migration"]],
    ["article", "8002-000000000017", ["accessibility", "design"]],
    ["article", "8002-000000000018", ["javascript", "performance"]],
    ["article", "8002-000000000019", ["contributing", "open-source"]],
    ["article", "8002-000000000020", ["pricing", "billing"]],
    ["article", "8002-000000000021", ["cloudflare-workers", "nextjs"]],
    ["article", "8002-000000000022", ["auth", "cloudflare-workers"]],
    ["thread", "8000-000000000001", ["sqlite", "d1", "cloudflare-workers"]],
    ["thread", "8000-000000000007", ["design", "accessibility"]],
    ["thread", "8000-000000000011", ["contributing", "open-source"]],
    ["thread", "8000-000000000014", ["design"]],
  ];
  for (const [kind, suffix, topics] of tags) {
    for (const t of topics) sql(`INSERT OR IGNORE INTO content_topics (content_kind, content_id, topic, created_at) VALUES ('${kind}', 'de300000-0000-4000-${suffix}', ${q(t)}, ${q(at(5))});`);
  }
}

process.stdout.write(out.join("\n") + "\n");
