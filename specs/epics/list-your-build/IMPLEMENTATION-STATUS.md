# list-your-build (LB): implementation status

| Milestone | State | PR |
|---|---|---|
| LB0: the spec | ✅ Shipped | [#28](https://github.com/vijayakrishnans/openproduct/pull/28) |
| LB1: list and verify | ✅ Shipped | [#30](https://github.com/vijayakrishnans/openproduct/pull/30) |
| LB2: live from the repo | ✅ Shipped | [#31](https://github.com/vijayakrishnans/openproduct/pull/31) |
| LB3: open roles | 🚧 In review | |
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

### Changes are commits to the default branch (LB2)

D3 said "merged pull requests plus commits to the default branch". A squash-merged PR already is a commit on the default branch, so adding both would count it twice; LB2 counts commits since a week ago, up to 300. That's three pages of GitHub's commits API, plus one call for the repo and one for languages, per listing per hour.

### A missing repo is a stats status, not a listing state (LB2)

D3 described `state: "unavailable"`. Instead, `listing_stats.status` is `missing` while GitHub answers 404, and the directory and public build page skip such listings. A maintainer still sees the page, with a banner saying why. The listing's own state (draft, published) is never changed behind the maintainer's back, and it comes back by itself when the repo does.

### Refreshing never makes a page wait (LB2)

The directory refreshes at most three stale listings after the response is sent (`waitUntil`). The build page refreshes its one listing inline, if an hour old, so a freshly listed build shows real numbers on first view.

### The repo's licence wins once read (LB2)

The licence stored at listing time is used only until the repo has been read; after that, GitHub's answer is shown, "no licence" included. Demo listings no longer claim MIT.

### Seats: a kind to pick, twelve at most, and closed ones kept (LB3)

A maintainer may pick the seat's kind (engineering, design, advisor, growth, design partner, contributor) or leave it to be read from the title, as openproduct.live's seats are. A build has at most twelve seats, open or closed. Closing a seat keeps it (`open = 0`) so a raised hand or a link to it still resolves; the settings page can reopen it. Seat ids start `lr_`, so they never collide with openproduct.live's `opr_` ids in raised hands.
