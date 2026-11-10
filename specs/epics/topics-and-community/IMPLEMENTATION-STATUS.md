# topics-and-community (TC): implementation status

| Milestone | State | PR |
|---|---|---|
| TC0: the spec | ✅ Shipped | [#39](https://github.com/vijayakrishnans/openproduct/pull/39) |
| TC1: topics as tags | ✅ Shipped | [#40](https://github.com/vijayakrishnans/openproduct/pull/40) |
| TC2: kinds of writing | ✅ Shipped | [#41](https://github.com/vijayakrishnans/openproduct/pull/41) |
| TC3: Community as the public square | 🚧 In review | |
| TC4: personal topics | ⏳ Not started | |
| TC5: rankings | ⏳ Not started | |

## Departures from the design

### A topic page exists from one piece of writing or one build (TC1)

D1 said a topic page appears from two pieces of writing. The page now exists as soon as anything carries the topic, so a builder's first tutorial on a new topic links somewhere. The **index** still lists a topic only once it has two pieces of writing, or a build.

### Builds join topics by category and stack (TC1)

A build's topics are its category and its stack, normalised (so openproduct.live's `workers` stack is `cloudflare-workers`). A topic page lists its six most active builds, with "All N" linking to the Open builds search.

### Trending in TC1 counts new writing only

Until TC4 adds searches and follows, "Trending this week" ranks topics by new writing in the last 7 days, and the page says so.

### Kinds are a picker on the one post form (TC2)

The write form gets a "What are you writing?" picker, and the per-kind fields (repo, minutes, build) are always on the form with their kinds named, so it works without script. A doc's "last reviewed" is its author's last save. "Use this baseline" links to Orunbase's app, as "Fork & deploy" does: there's no per-repo copy address yet. A launch checks the author maintains the build only when the kind is launch, so other posts don't wait on openproduct.live.

### Community's sections, and solved issues (TC3)

Community's overview has five sections (Issues, Solved, New ways, Launches, Discussions), each with "See all". Issues, Solved and Discussions open as full lists in Community; New ways and Launches open the posts index on that kind. A solved issue also reads as "answered", the state openproduct.live's threads use. Discussions from openproduct.live stay discussions: they're read-only here and can't be marked solved (Q3). The "From the builders" row is replaced by New ways and Launches.

openproduct.live's thread reads now give up after 8 seconds, so a slow response can't hang Community; it already handled "unreachable".
