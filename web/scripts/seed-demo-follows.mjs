#!/usr/bin/env node
// Demo topic follows and searches (topics-and-community TC4), so Trending
// and "Your topics" have something to show. Run after seed-demo.mjs and
// seed-demo-topics.mjs. Prints SQL; --remove prints the SQL that undoes it.
// Searches are counts per topic per day with no account, so --remove clears
// the seeded topics' counts for the last 7 days, real ones included.

const remove = process.argv.includes("--remove");
const NOW = Date.now();
const at = (hoursAgo) => new Date(NOW - hoursAgo * 3600_000).toISOString();
const day = (daysAgo) => new Date(NOW - daysAgo * 86_400_000).toISOString().slice(0, 10);
const q = (v) => `'${String(v).replace(/'/g, "''")}'`;
const out = [];
const sql = (s) => out.push(s);

// [account, topic, hours ago]
const follows = [
  ["sam", "cloudflare-workers", 50], ["sam", "d1", 49], ["sam", "auth", 20],
  ["priya", "design", 70], ["priya", "accessibility", 30], ["priya", "cloudflare-workers", 12],
  ["mira", "design", 40], ["mira", "javascript", 8],
  ["tomas", "cloudflare-workers", 100], ["tomas", "sqlite", 60], ["tomas", "contributing", 5],
];
// [topic, [searches per day, today first]]
const searches = [
  ["cloudflare-workers", [6, 4, 5, 3, 2, 1, 2]],
  ["auth", [3, 2, 1, 0, 1, 0, 0]],
  ["design", [1, 2, 0, 1, 0, 0, 1]],
  ["sqlite", [0, 1, 0, 0, 1, 0, 0]],
];

sql(`DELETE FROM topic_follows WHERE account_id IN (${[...new Set(follows.map((f) => q(`demo-${f[0]}`)))].join(", ")});`);
sql(`DELETE FROM topic_searches WHERE topic IN (${searches.map((s) => q(s[0])).join(", ")}) AND day >= ${q(day(7))};`);

if (!remove) {
  for (const [who, topic, h] of follows) sql(`INSERT OR IGNORE INTO topic_follows (account_id, topic, created_at) VALUES (${q(`demo-${who}`)}, ${q(topic)}, ${q(at(h))});`);
  for (const [topic, counts] of searches)
    counts.forEach((n, d) => n && sql(`INSERT INTO topic_searches (topic, day, count) VALUES (${q(topic)}, ${q(day(d))}, ${n});`));
}

process.stdout.write(out.join("\n") + "\n");
