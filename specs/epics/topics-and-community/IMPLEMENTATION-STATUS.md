# topics-and-community (TC): implementation status

| Milestone | State | PR |
|---|---|---|
| TC0: the spec | ✅ Shipped | [#39](https://github.com/vijayakrishnans/openproduct/pull/39) |
| TC1: topics as tags | 🚧 In review | |
| TC2: kinds of writing | ⏳ Not started | |
| TC3: Community as the public square | ⏳ Not started | |
| TC4: personal topics | ⏳ Not started | |
| TC5: rankings | ⏳ Not started | |

## Departures from the design

### A topic page exists from one piece of writing or one build (TC1)

D1 said a topic page appears from two pieces of writing. The page now exists as soon as anything carries the topic, so a builder's first tutorial on a new topic links somewhere. The **index** still lists a topic only once it has two pieces of writing, or a build.

### Builds join topics by category and stack (TC1)

A build's topics are its category and its stack, normalised (so openproduct.live's `workers` stack is `cloudflare-workers`). A topic page lists its six most active builds, with "All N" linking to the Open builds search.

### Trending in TC1 counts new writing only

Until TC4 adds searches and follows, "Trending this week" ranks topics by new writing in the last 7 days, and the page says so.
