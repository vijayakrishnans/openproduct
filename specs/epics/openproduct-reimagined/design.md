# openproduct-reimagined — design

The reference is the PDF "openproduct.live — reimagined" (desktop home,
build page, phone home). Where this file and the PDF disagree on layout, the
PDF wins; where they disagree on data, this file wins.

## 1. The resource

No database. Every page is rendered on the Worker per request from the
public API, with a short `fetch` cache. One module, `apps/web/src/lib/directory.ts`,
turns the API's shapes into the app's own:

```
Build
  slug          text        the listing's slug, also /builds/<slug>
  name          text        the slug, as the PDF shows it
  tagline       text        tagline.value
  category      text        category.value → a topic label from /v1/public/openproduct/topics
  licence       text        licence.value
  changes7d     int         metrics["merges.7d"]
  upvotes       int         metrics["endorsements.total"]
  roles         Role[]      openings[] (detail) or openRoles.value (list count)
  stack         text[]      stack.value
  lastCommitAt  timestamp   lastCommitAt.value
  pieces        Piece[]     the app map (§4: sample until the API has it)
  sample        text[]      which fields on this build are sample data

Role
  title         text        openings[].title.value
  firstTask     text|null   sample (the API has no first task yet)
  skills        text[]      sample
```

Ranking is the PDF's own: most active = (changes7d + 1) × (upvotes + 1);
newest = publishedAt; upvoted = upvotes; roles = role count. A build with no
change in 7 days is "below the floor": listed, in the collapsed quiet row.

## 2. The API

Read-only, anonymous, server-side only (no CORS needed):

```
GET https://api.openproduct.live/v1/products                     the list
GET https://api.openproduct.live/v1/products/{slug}              one build, with openings and pitch
GET https://api.openproduct.live/v1/public/openproduct/topics    category labels and counts
GET https://api.openproduct.live/v1/public/openproduct/feed      the week's activity, for the pulse
```

`API_ORIGIN` is a build-time constant so a later fork can point at its own.
A failed read renders the page with an inline "the directory could not be
reached" state, never a 500.

## 3. The pages

- `/` (OP1, OP3): nav (Builds, Open roles, Topics, People, search, Sign in,
  List your build); hero with the three chips, the two buttons and the
  counts line; live pulse panel (OP3); "Looking for people" row (OP3);
  "Open builds": sort tabs, category chips, the ranking formula line, the
  card grid; the quiet row; the dark "How a build gets here" band; footer.
- `/builds/<slug>` (OP2): header (initials tile, name, category, licence,
  Live), tagline, repo and workspace links, Upvote, Follow, Fork & deploy;
  the app map with the piece detail; the build log with a pinned note; Run
  your own copy; Open roles; People; Embed this build.
- `/roles` (OP3): every open role across builds.
- Phone (OP3): the two-column card grid, a ticker for the pulse, the bottom
  bar (Builds, Roles, List yours, Topics).

Links out: Sign in and List your build → `https://openproduct.live`;
Fork & deploy → the Orunbase console; repo → the listing's `repoUrl` when set.

## 4. Events, secrets, and integrations

None. No secrets beyond the baseline's brokered Cloudflare deploy token. What
the API does not carry yet is SAMPLE, generated deterministically from the
slug so it is stable between visits, and labelled where shown:

- the app map's pieces and which moved last,
- the build log's entries and the pinned note,
- the pulse lines, when the feed is empty,
- a role's first task and skills,
- maintainer and contributor counts, when `maintainers` is empty.

## 5. Out of scope

Sign-in, listing, upvoting, following, forking, the digest, collections, the
RSS feed and the API pages: they link to openproduct.live. Changing
openproduct.live itself, or its API, is a separate decision this sample is
meant to inform.
