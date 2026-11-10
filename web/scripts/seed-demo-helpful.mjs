#!/usr/bin/env node
// Demo helpful votes (topics-and-community TC5), so the topic rankings have
// something to rank. Demo builders mark some of each other's demo posts and
// replies helpful, never their own. Run after the other seed-demo scripts.
// Prints SQL; --remove prints the SQL that undoes it.

const remove = process.argv.includes("--remove");
const at = new Date().toISOString();
const voters = ["demo-sam", "demo-priya", "demo-mira", "demo-tomas"];
const who = voters.map((v) => `SELECT '${v}' AS id`).join(" UNION ALL ");
const out = [`DELETE FROM helpful WHERE account_id IN (${voters.map((v) => `'${v}'`).join(", ")});`];

if (!remove) {
  // A fixed, uneven spread: whether a voter marks a piece depends on both ids.
  const pick = (col) => `(unicode(substr(${col}, -1)) + unicode(substr(v.id, 6, 1)) + length(v.id)) % 3 != 0`;
  out.push(
    `INSERT OR IGNORE INTO helpful (account_id, target_kind, target_id, created_at) SELECT v.id, 'article', a.id, '${at}' FROM articles a, (${who}) v WHERE a.id LIKE 'de300000-%' AND a.hidden = 0 AND a.author_account_id != v.id AND ${pick("a.id")};`,
    `INSERT OR IGNORE INTO helpful (account_id, target_kind, target_id, created_at) SELECT v.id, 'post', p.id, '${at}' FROM posts p, (${who}) v WHERE p.id LIKE 'de300000-%' AND p.hidden = 0 AND p.author_account_id IS NOT NULL AND p.author_account_id != v.id AND ${pick("p.id")};`,
  );
}

process.stdout.write(out.join("\n") + "\n");
