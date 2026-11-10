# list-your-build (LB): implementation status

| Milestone | State | PR |
|---|---|---|
| LB0: the spec | ✅ Shipped | [#28](https://github.com/vijayakrishnans/openproduct/pull/28) |
| LB1: list and verify | 🚧 In review | |
| LB2: live from the repo | ⏳ Not started | |
| LB3: open roles | ⏳ Not started | |
| LB4: maintainers and contributors | ⏳ Not started | |
| LB5: the pitch, a cover and a live link | ⏳ Not started | |
| LB6: moderation and lifecycle | ⏳ Not started | |

## Departures from the design

### LB1 lists at zero activity, and takes licence and description once

Changes, upvotes from openproduct.live and seats are zero until LB2 and LB3. The licence, description and suggested stack are read from the repo when the listing is created, then refreshed by LB2. Builds listed here skip the sample app map and sample build log that openproduct.live's builds show, since neither has real data yet.

### The "Fork & deploy" panel is left out for listings here

Per D8, until a listing can link an Orunbase workspace (LB5, Q1).

### Verification also re-checks the owner fast path

"Check again" on an unverified listing first tries the GitHub-login match, then the `.openproduct` file. Someone who signed in with GitHub after creating the listing doesn't need the file.

### Demo listings have their own seed script

`web/scripts/seed-demo-listings.mjs` adds two published listings on the owner's public repos (`openproduct`, `hired-in-the-ai-era`), under demo builders, and a draft that still needs verifying. It runs after `seed-demo.mjs`, and is stage only.
