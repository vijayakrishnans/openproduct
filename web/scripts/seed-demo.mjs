#!/usr/bin/env node
// Demo data for looking at the site with something in it: four builder
// profiles with support links, discussions with replies, builder posts with
// videos, and one open report. Prints SQL; apply it with wrangler:
//
//   node scripts/seed-demo.mjs > /tmp/demo.sql
//   npx wrangler d1 execute DB --local --config wrangler.jsonc --file /tmp/demo.sql
//   npx wrangler d1 execute openproduct-web-stage --remote --file /tmp/demo.sql
//
//   node scripts/seed-demo.mjs --remove   # prints the SQL that deletes it all
//
// Every row is marked: accounts are `demo-…`, threads, replies and posts use
// ids starting `de300000-`, and every profile's bio opens with "Demo
// profile". Running it again replaces the demo rows; nothing else is touched.
// No demo account has an identity, so none of them can sign in.

const remove = process.argv.includes("--remove");
const NOW = Date.now();
const HOUR = 3600_000;
const at = (hoursAgo) => new Date(NOW - hoursAgo * HOUR).toISOString();
const q = (v) => (v === null || v === undefined ? "NULL" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
let n = 0;
const id = (kind) => `de300000-0000-4000-${kind}-${String(++n).padStart(12, "0")}`;

const out = [];
const sql = (s) => out.push(s);

// Order matters: threads and replies only SET NULL on account delete, so they go first.
sql(`DELETE FROM reports WHERE reporter_account_id LIKE 'demo-%' OR target_id LIKE 'de300000-%';`);
sql(`DELETE FROM posts WHERE id LIKE 'de300000-%' OR thread_id LIKE 'de300000-%';`);
sql(`DELETE FROM threads WHERE id LIKE 'de300000-%';`);
sql(`DELETE FROM articles WHERE id LIKE 'de300000-%';`);
sql(`DELETE FROM accounts WHERE id LIKE 'demo-%';`);

if (!remove) {
  const builders = [
    {
      key: "mira",
      handle: "mira-okafor",
      name: "Mira Okafor",
      bio: "Demo profile. Front-end builder. I like small tools that do one thing well, and I write up everything I break.",
      since: 24 * 40,
      support: [
        ["patreon", "https://www.patreon.com/demo-mira-okafor"],
        ["ko-fi", "https://ko-fi.com/demomiraokafor"],
      ],
    },
    {
      key: "tomas",
      handle: "tomas-lind",
      name: "Tomás Lind",
      bio: "Demo profile. Backend and infra. Currently moving everything I own to the edge, one D1 database at a time.",
      since: 24 * 25,
      support: [["github-sponsors", "https://github.com/sponsors/demo-tomas-lind"]],
    },
    {
      key: "priya",
      handle: "priya-raman",
      name: "Priya Raman",
      bio: "Demo profile. Product designer who ships code. Accessibility first, then everything else.",
      since: 24 * 12,
      support: [
        ["buymeacoffee", "https://www.buymeacoffee.com/demopriyaraman"],
        ["opencollective", "https://opencollective.com/demo-priya-raman"],
      ],
    },
    {
      key: "sam",
      handle: "sam-whitfield",
      name: "Sam Whitfield",
      bio: "Demo profile. Weekend builder, weekday SRE. Here to make my first PR to someone else's build.",
      since: 24 * 3,
      support: [],
    },
    {
      key: "mod",
      handle: "demo-moderator",
      name: "Demo Moderator",
      bio: "Demo profile. Sign in as me on stage to see the reports queue and the Hide buttons.",
      since: 24 * 50,
      support: [],
    },
  ];
  const acc = (key) => `demo-${key}`;
  // The moderator is a moderator by GitHub login, as on the real site; the
  // login "demo-moderator" counts only while DEMO_SIGNIN is on (stage).
  const modIdentity = () =>
    sql(`INSERT INTO identities (provider, provider_user_id, account_id, login, created_at) VALUES ('github', 'demo-moderator', 'demo-mod', 'demo-moderator', ${q(at(24 * 50))});`);

  for (const b of builders) {
    sql(`INSERT INTO accounts (id, display_name, created_at) VALUES (${q(acc(b.key))}, ${q(b.name)}, ${q(at(b.since))});`);
    sql(
      `INSERT INTO builders (handle, account_id, kind, display_name, bio, created_at) VALUES (${q(b.handle)}, ${q(acc(b.key))}, 'new', ${q(b.name)}, ${q(b.bio)}, ${q(at(b.since))});`,
    );
    b.support.forEach(([provider, url], i) =>
      sql(
        `INSERT INTO support_links (owner_kind, owner_key, position, provider, url, account_id, updated_at) VALUES ('builder', ${q(b.handle)}, ${i}, ${q(provider)}, ${q(url)}, ${q(acc(b.key))}, ${q(at(b.since - 1))});`,
      ),
    );
  }

  // Discussions: [author, tag, title, hoursAgo, body, replies: [author, hoursAgo, body]]
  modIdentity();

  const threads = [
    [
      "tomas",
      "question",
      "Is SQLite at the edge good enough for a real product?",
      70,
      "I've moved two side projects to **D1** and so far it's been great: one database per environment, migrations in code, no connection pool to babysit.\n\nBut I keep reading that it isn't for \"real\" products. Where did it break for you? Write volume, cross-region reads, backups, something else?",
      [
        ["mira", 66, "Writes were fine for us. What bit us was *reads right after a write* from another region. We now read our own writes from the same request instead of re-querying."],
        ["sam", 50, "Backups. Time travel saved us once, but test your restore before you need it:\n\n```\nwrangler d1 time-travel restore DB --timestamp=…\n```"],
        ["priya", 30, "Not a DB answer, but: whatever you choose, write down *why* in the README. Contributors ask this every time."],
        ["tomas", 6, "Thanks all. Summary so far:\n\n- writes: fine at our size\n- read-your-writes: handle it in the request\n- backups: rehearse the restore"],
      ],
    ],
    [
      "priya",
      "accessibility",
      "Dark mode: follow the system, or ask the user?",
      40,
      "We just shipped dark mode here: it follows your device until you pick light or dark in the header. Some builds only follow the system, some only have a toggle.\n\nWhich do you prefer, and does anyone test contrast in **both** themes before merging?",
      [
        ["mira", 36, "Follow the system, plus an override. Some people want a dark editor and a light everything-else."],
        ["sam", 20, "We added a screenshot check in CI that renders key pages in both themes. Caught three white-on-white buttons on day one."],
      ],
    ],
    [
      "sam",
      "contributing",
      "Proposal: a \"first PR\" label on every build",
      18,
      "Finding a first issue across builds is hard. What if every build tagged a few issues `first-pr`, and this site listed them under Roles?\n\nWould maintainers keep that label up to date?",
      [["tomas", 12, "I'd do it if it were one label across builds. Five different names for \"good first issue\" is how they go stale."]],
    ],
    [
      "mira",
      "design",
      "Show us your empty states",
      8,
      "The first screen a new user sees is usually the empty one. Post a screenshot or a link to your build's empty state, and say what you wanted it to make people do.",
      [],
    ],
  ];

  let reportOn = null;
  for (const [author, tag, title, hoursAgo, body, replies] of threads) {
    const tid = id("8000");
    const last = replies.length ? replies[replies.length - 1][1] : hoursAgo;
    sql(
      `INSERT INTO threads (id, author_account_id, tag, title, created_at, last_post_at, post_count) VALUES (${q(tid)}, ${q(acc(author))}, ${q(tag)}, ${q(title)}, ${q(at(hoursAgo))}, ${q(at(last))}, ${replies.length + 1});`,
    );
    sql(`INSERT INTO posts (id, thread_id, author_account_id, body, created_at) VALUES (${q(id("8001"))}, ${q(tid)}, ${q(acc(author))}, ${q(body)}, ${q(at(hoursAgo))});`);
    for (const [who, ago, text] of replies) {
      const pid = id("8001");
      if (!reportOn && who === "sam") reportOn = pid;
      sql(`INSERT INTO posts (id, thread_id, author_account_id, body, created_at) VALUES (${q(pid)}, ${q(tid)}, ${q(acc(who))}, ${q(text)}, ${q(at(ago))});`);
    }
  }
  // One open report, so the moderation queue has something in it.
  if (reportOn) {
    sql(
      `INSERT INTO reports (target_kind, target_id, reporter_account_id, reason, created_at) VALUES ('post', ${q(reportOn)}, 'demo-mira', 'Demo report: checking the moderation queue.', ${q(at(2))});`,
    );
  }

  // Builder posts: [author, hoursAgo, title, video provider, video id, build, body]
  const articles = [
    [
      "tomas",
      60,
      "Moving flakeless from Vercel to Workers: the honest version",
      "youtube",
      "Sklc_fQBmcs",
      "flakeless",
      "We moved **flakeless** from Vercel to Cloudflare Workers last month. The video above is the primer I sent the team before we started; below is what actually happened.\n\n## What went well\n\n- Cold starts disappeared from our graphs.\n- D1 replaced a hosted Postgres we were paying for and barely using.\n\n## What hurt\n\n1. Two Node APIs we leaned on weren't there. We swapped them for Web APIs.\n2. Preview deploys took a day to get right.\n\n> Would I do it again? Yes, but I'd budget a week, not a weekend.\n\nThe migration PRs are all public if you want to follow along: https://github.com",
    ],
    [
      "priya",
      44,
      "A 10-minute accessibility pass for any build",
      null,
      null,
      null,
      "You don't need an audit to catch most problems. Here's the pass I run on every build before I review its design:\n\n1. **Tab through the page.** Can you see where focus is at every step?\n2. **Zoom to 200%.** Does anything overlap or scroll sideways?\n3. **Switch to dark mode.** Is any text the same colour as its background?\n4. **Turn on reduced motion.** Does anything still spin?\n5. **Read the page title and headings out loud.** Do they make sense on their own?\n\nIf a build passes all five, it's already ahead of most of the web. If it fails one, that's a great `first-pr` issue.",
    ],
    [
      "mira",
      28,
      "Event loops, finally explained (and why our UI froze)",
      "youtube",
      "8aGhZQkoFbQ",
      "rateboard",
      "Our dashboard on **rateboard** froze for a second every time a big report loaded. The fix was one line, but understanding it took this talk, which is still the best explanation of the event loop I know.\n\nThe short version: we parsed a 4 MB JSON response in one go on the main thread. Splitting the work with `setTimeout(…, 0)` between chunks gave the browser room to paint.\n\nWatch the talk, then go look for your own long tasks in the Performance panel.",
    ],
    [
      "sam",
      14,
      "My first week as a contributor",
      "vimeo",
      "76979871",
      null,
      "I joined my first open build last week. Notes for anyone thinking about it:\n\n- Pick a build whose maintainer answers issues within a day. You'll learn more from fast reviews than from big tasks.\n- Read the README **and** the last ten merged PRs. That's the real style guide.\n- Ask before you start anything bigger than an afternoon.\n\n(The video is a stand-in: Vimeo's own player demo, so you can see how a Vimeo post looks.)",
    ],
    [
      "tomas",
      4,
      "pipebill: what we learned billing per pipeline run",
      null,
      null,
      "pipebill",
      "Metered billing sounds simple until a run is retried. We now bill on the run's *first* successful attempt and record retries for free.\n\nIf you're building anything usage-based, decide what a \"unit\" is **before** you write the meter. Changing it later means re-billing history, and nobody enjoys that conversation.",
    ],
  ];
  for (const [author, hoursAgo, title, provider, videoId, build, body] of articles) {
    sql(
      `INSERT INTO articles (id, author_account_id, title, body, video_provider, video_id, build_slug, created_at, updated_at) VALUES (${q(id("8002"))}, ${q(acc(author))}, ${q(title)}, ${q(body)}, ${q(provider)}, ${q(videoId)}, ${q(build)}, ${q(at(hoursAgo))}, ${q(at(hoursAgo))});`,
    );
  }

  // Upvotes, follows and raised hands (OP-25), so builds and seats have some.
  const votes = { mira: ["rateboard", "flakeless", "ackstack"], tomas: ["rateboard", "aitally"], priya: ["rateboard", "grantwell", "ackstack"], sam: ["ackstack"] };
  for (const [who, slugs] of Object.entries(votes)) {
    for (const slug of slugs) sql(`INSERT INTO votes (account_id, slug, created_at) VALUES (${q(acc(who))}, ${q(slug)}, ${q(at(30))});`);
  }
  const follows = [["mira", "build", "rateboard"], ["sam", "build", "ackstack"], ["sam", "builder", "tomas-lind"], ["priya", "builder", "mira-okafor"], ["tomas", "builder", "priya-raman"]];
  for (const [who, kind, key] of follows) sql(`INSERT INTO follows (account_id, kind, key, created_at) VALUES (${q(acc(who))}, ${q(kind)}, ${q(key)}, ${q(at(20))});`);
  // Raised hands need real seat ids: read the first seats of a few builds.
  const handsOn = [["ackstack", ["sam", "priya"]], ["aitally", ["priya"]], ["grantwell", ["sam"]]];
  for (const [slug, who] of handsOn) {
    const res = await fetch(`https://api.openproduct.live/v1/products/${slug}`).catch(() => null);
    const p = res?.ok ? (await res.json()).data?.product : null;
    const seat = Array.isArray(p?.openings) ? p.openings[0]?.id : null;
    if (typeof seat !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(seat)) continue;
    for (const w of who) sql(`INSERT INTO seat_hands (account_id, slug, role_id, created_at) VALUES (${q(acc(w))}, ${q(slug)}, ${q(seat)}, ${q(at(10))});`);
  }
  // A builder post reported too, so the moderation queue shows both kinds.
  sql(`INSERT INTO reports (target_kind, target_id, reporter_account_id, reason, created_at) SELECT 'article', id, 'demo-sam', 'Demo report: is this an ad?', ${q(at(1))} FROM articles WHERE id LIKE 'de300000-%' AND author_account_id = 'demo-tomas' ORDER BY created_at DESC LIMIT 1;`);
}

process.stdout.write(out.join("\n") + "\n");
