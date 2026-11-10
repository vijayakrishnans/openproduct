#!/usr/bin/env node
// Demo comments under builds (OP-46). Run after seed-demo.mjs. Prints SQL;
// --remove prints the SQL that undoes it. Ids start de300000-0000-4000-8005.

const remove = process.argv.includes("--remove");
const NOW = Date.now();
const at = (hoursAgo) => new Date(NOW - hoursAgo * 3600_000).toISOString();
const q = (v) => `'${String(v).replace(/'/g, "''")}'`;
const C = (n) => `de300000-0000-4000-8005-${String(n).padStart(12, "0")}`;
const out = [
  `DELETE FROM reports WHERE target_kind = 'comment' AND target_id LIKE 'de300000-0000-4000-8005-%';`,
  `DELETE FROM build_comments WHERE id LIKE 'de300000-0000-4000-8005-%';`,
];

if (!remove) {
  // [build, author, hours ago, body]
  const comments = [
    ["openproduct-web", "sam", 20, "Love that every number links to where it came from. Is there a plan for an RSS feed of new builds?"],
    ["openproduct-web", "tomas", 18, "Not yet, but it's a small one. If you want it, raise your hand on the frontend seat and I'll point you at the route."],
    ["openproduct-web", "mira", 9, "The topic pages feel great on mobile now. One nit: the follow button could sit next to the title on narrow screens."],
    ["openproduct-web", "priya", 3, "Tried listing a build end to end with the demo account: took about four minutes. The repo check was the only step I had to read twice."],
    ["pipebill", "sam", 30, "How do you handle a run that's retried after the first attempt already billed?"],
    ["pipebill", "tomas", 28, "We bill the first *successful* attempt only and record retries for free. There's a write-up in my posts."],
    ["flakeless", "priya", 12, "Does it work with Vitest or only Jest?"],
  ];
  comments.forEach(([slug, who, h, body], i) =>
    out.push(`INSERT INTO build_comments (id, slug, author_account_id, body, created_at) VALUES (${q(C(i + 1))}, ${q(slug)}, ${q(`demo-${who}`)}, ${q(body)}, ${q(at(h))});`),
  );
}

process.stdout.write(out.join("\n") + "\n");
