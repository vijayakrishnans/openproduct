# topics-and-community (TC): implementation status

| Milestone | State | PR |
|---|---|---|
| TC0: the spec | ✅ Shipped | [#39](https://github.com/vijayakrishnans/openproduct/pull/39) |
| TC1: topics as tags | ✅ Shipped | [#40](https://github.com/vijayakrishnans/openproduct/pull/40) |
| TC2: kinds of writing | ✅ Shipped | [#41](https://github.com/vijayakrishnans/openproduct/pull/41) |
| TC3: Community as the public square | ✅ Shipped | [#42](https://github.com/vijayakrishnans/openproduct/pull/42) |
| TC4: personal topics | ✅ Shipped | [#43](https://github.com/vijayakrishnans/openproduct/pull/43) |
| TC5: rankings | 🚧 In review | |

## Departures from the design

### A topic page exists from one piece of writing or one build (TC1)

D1 said a topic page appears from two pieces of writing. The page now exists as soon as anything carries the topic, so a builder's first tutorial on a new topic links somewhere. The **index** still lists a topic only once it has two pieces of writing, or a build.

### Builds join topics by category and stack (TC1)

A build's topics are its category and its stack, normalised (so openproduct.live's `workers` stack is `cloudflare-workers`). A topic page lists its six most active builds, with "All N" linking to the Open builds search.

### Trending in TC1 counted new writing only

From TC1 to TC3, "Trending this week" ranked topics by new writing alone. TC4 brings in searches and follows, so it is now D4's formula, shown on the page.

### Kinds are a picker on the one post form (TC2)

The write form gets a "What are you writing?" picker, and the per-kind fields (repo, minutes, build) are always on the form with their kinds named, so it works without script. A doc's "last reviewed" is its author's last save. "Use this baseline" links to Orunbase's app, as "Fork & deploy" does: there's no per-repo copy address yet. A launch checks the author maintains the build only when the kind is launch, so other posts don't wait on openproduct.live.

### Community's sections, and solved issues (TC3)

Community's overview has five sections (Issues, Solved, New ways, Launches, Discussions), each with "See all". Issues, Solved and Discussions open as full lists in Community; New ways and Launches open the posts index on that kind. A solved issue also reads as "answered", the state openproduct.live's threads use. Discussions from openproduct.live stay discussions: they're read-only here and can't be marked solved (Q3). The "From the builders" row is replaced by New ways and Launches.

openproduct.live's thread reads now give up after 8 seconds, so a slow response can't hang Community; it already handled "unreachable".

### Topic follows get their own table (TC4)

The plan said to reuse `follows`. Its `kind` is held to build or builder by a CHECK constraint, and SQLite can't change a CHECK without rebuilding the table, so topic follows live in `topic_follows` (account, topic, when). Deleting an account removes them. Searches live in `topic_searches`: one row per topic per day holding a count, nothing else (D5).

### Which searches count (TC4)

A search counts when someone follows a topic link from the search page to that topic (the link carries `?from=search` and isn't prefetched). The search page's topics are now this site's topics (categories, stacks and writing), not only the directory's categories. The Open builds search doesn't link to topics yet, so it doesn't feed Trending.

### For you mixes writing and discussions (TC4)

"For you" holds the 20 newest posts and discussions in the topics you follow, newest first. Signed out, Topics shows Trending and All topics only. One account can follow up to 50 topics.

### Rankings as built (TC5)

- **Helpful** is a button under each post and each reply written here. Your own writing shows its count with no button. A hidden post can't be voted on, and its votes stop counting while it's hidden.
- **A topic page's side panel** has three boxes, top to bottom: Top contributors (up to 5), Most helpful (top 3 posts or replies, all time) and Top builds. Each prints its formula. Fewer than three entries are listed without places (D4).
- **Accepted solutions** count only when the solution is someone else's reply, so marking your own reply doesn't score.
- **Merged PRs** come from the day's cached GitHub counts (BP7) and count in every topic of the build they went to. Unlike the rest of the score, they aren't limited to 90 days, because the cache keeps totals, not dates. Repos the login owns and builds the account maintains here don't count.
- **Only builders** (accounts with a builder profile) are listed, since a place links to a profile.
- **"Known for"** on a builder profile shows their three best topics by the same score, with what earned each one, and "#n in" when they're in a topic's top three.
- On phones, the side panel now comes after the feed.
