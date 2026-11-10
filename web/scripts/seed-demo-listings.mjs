#!/usr/bin/env node
// Demo listings for stage (list-your-build LB1): two published builds on real
// public repos, and a draft still waiting to be verified, so every state of
// the listing flow can be seen. Run after seed-demo.mjs (it needs the demo
// accounts). Prints SQL, like seed-demo.mjs:
//
//   node scripts/seed-demo-listings.mjs > /tmp/listings.sql
//   npx wrangler d1 execute DB --local --config wrangler.jsonc --file /tmp/listings.sql
//
//   node scripts/seed-demo-listings.mjs --remove
//
// Every row belongs to a `demo-` account; the slugs are fixed below.

const remove = process.argv.includes("--remove");
const NOW = Date.now();
const at = (hoursAgo) => new Date(NOW - hoursAgo * 3600_000).toISOString();
const q = (v) => (v === null || v === undefined ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);
const out = [];
const sql = (s) => out.push(s);

const SLUGS = ["openproduct-web", "hired-blog", "weekend-pager"];
sql(`DELETE FROM votes WHERE slug IN (${SLUGS.map(q).join(", ")}) AND account_id LIKE 'demo-%';`);
sql(`DELETE FROM listings WHERE slug IN (${SLUGS.map(q).join(", ")});`);

if (!remove) {
  // [slug, repo, state, verified, tagline, category, stack, owner, other maintainers, hours ago]
  const listings = [
    ["openproduct-web", "vijayakrishnans/openproduct", "published", true, "The open build directory you're looking at, rebuilt on Workers", "dev-tools", ["typescript", "nextjs", "workers"], "tomas", ["mira"], 72],
    ["hired-blog", "vijayakrishnans/hired-in-the-ai-era", "published", true, "Essays and tools on getting hired when AI writes the CV", "productivity", ["typescript", "nextjs"], "priya", [], 30],
    ["weekend-pager", "sam-whitfield/weekend-pager", "draft", false, null, null, ["go"], "sam", [], 5],
  ];
  for (const [slug, repo, state, verified, tagline, category, stack, owner, others, hoursAgo] of listings) {
    const published = state === "published";
    sql(
      `INSERT INTO listings (slug, repo, state, verify_code, verified_at, tagline, category, stack, description, licence, created_by, created_at, updated_at, published_at) VALUES (${q(slug)}, ${q(repo)}, ${q(state)}, ${q(`op-demo-${slug}`)}, ${verified ? q(at(hoursAgo - 1)) : "NULL"}, ${q(tagline)}, ${q(category)}, ${q(JSON.stringify(stack))}, ${q("Demo listing on stage: the maintainers shown here are demo builders.")}, NULL, ${q(`demo-${owner}`)}, ${q(at(hoursAgo))}, ${q(at(hoursAgo))}, ${published ? q(at(hoursAgo - 2)) : "NULL"});`,
    );
    sql(`INSERT INTO listing_maintainers (slug, account_id, role, accepted_at) VALUES (${q(slug)}, ${q(`demo-${owner}`)}, 'owner', ${q(at(hoursAgo))});`);
    for (const o of others) sql(`INSERT INTO listing_maintainers (slug, account_id, role, accepted_at) VALUES (${q(slug)}, ${q(`demo-${o}`)}, 'maintainer', ${q(at(hoursAgo - 3))});`);
  }
  sql(`INSERT OR IGNORE INTO votes (account_id, slug, created_at) VALUES ('demo-sam', 'openproduct-web', ${q(at(8))}), ('demo-priya', 'openproduct-web', ${q(at(7))}), ('demo-mira', 'hired-blog', ${q(at(6))});`);
}

process.stdout.write(out.join("\n") + "\n");
