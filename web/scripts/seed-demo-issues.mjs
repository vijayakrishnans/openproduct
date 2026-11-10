#!/usr/bin/env node
// Demo issues (topics-and-community TC3): one solved, two open, with topics.
// Run after seed-demo.mjs and seed-demo-topics.mjs. Prints SQL; --remove
// prints the SQL that undoes it. Ids start de300000-0000-4000-8003/8004.

const remove = process.argv.includes("--remove");
const NOW = Date.now();
const at = (hoursAgo) => new Date(NOW - hoursAgo * 3600_000).toISOString();
const q = (v) => (v === null || v === undefined ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);
const out = [];
const sql = (s) => out.push(s);
const T = (n) => `de300000-0000-4000-8003-${String(n).padStart(12, "0")}`;
const P = (n) => `de300000-0000-4000-8004-${String(n).padStart(12, "0")}`;

sql(`DELETE FROM content_topics WHERE content_id LIKE 'de300000-0000-4000-8003-%';`);
sql(`DELETE FROM threads WHERE id LIKE 'de300000-0000-4000-8003-%';`);

if (!remove) {
  // [thread n, author, hours ago, title, body, topics, solution reply index, replies: [author, hours ago, body]]
  const issues = [
    [1, "sam", 30, "wrangler dev can't find my D1 binding", "`env.DB` is undefined locally, but the deploy works. I've run the migrations. What am I missing?", ["d1", "cloudflare-workers"], 0, [
      ["tomas", 28, "Check the binding is in the **same** config file you pass to `wrangler dev`. If you use `--config wrangler.jsonc`, the `d1_databases` block has to be there, not only in a per-environment file."],
      ["priya", 27, "Also: with `--local`, the local database is separate from the remote one. Run your migrations with `--local` too."],
    ]],
    [2, "priya", 9, "Video posts don't start on iPhone in Low Power Mode", "Tapping play on a YouTube post does nothing on my iPhone when Low Power Mode is on. Desktop is fine. Anyone else?", ["design", "accessibility"], null, [
      ["mira", 6, "Same here. I think iOS blocks autoplay-ish starts in Low Power Mode; a second tap works for me."],
    ]],
    [3, "mira", 2, "Topic chips wrap awkwardly on narrow phones", "On a 320px screen the topic chips under a post title wrap into three uneven rows. Could they scroll sideways instead?", ["design"], null, []],
  ];
  for (const [n, author, h, title, body, topics, solution, replies] of issues) {
    const last = replies.length ? replies[replies.length - 1][1] : h;
    const sol = solution === null ? null : P(n * 10 + 1 + solution);
    sql(`INSERT INTO threads (id, author_account_id, tag, title, created_at, last_post_at, post_count, kind, solution_post_id) VALUES (${q(T(n))}, 'demo-${author}', 'question', ${q(title)}, ${q(at(h))}, ${q(at(last))}, ${replies.length + 1}, 'issue', ${q(sol)});`);
    sql(`INSERT INTO posts (id, thread_id, author_account_id, body, created_at) VALUES (${q(P(n * 10))}, ${q(T(n))}, 'demo-${author}', ${q(body)}, ${q(at(h))});`);
    replies.forEach(([who, rh, text], i) => sql(`INSERT INTO posts (id, thread_id, author_account_id, body, created_at) VALUES (${q(P(n * 10 + 1 + i))}, ${q(T(n))}, 'demo-${who}', ${q(text)}, ${q(at(rh))});`));
    for (const t of topics) sql(`INSERT OR IGNORE INTO content_topics (content_kind, content_id, topic, created_at) VALUES ('thread', ${q(T(n))}, ${q(t)}, ${q(at(h))});`);
  }
}

process.stdout.write(out.join("\n") + "\n");
