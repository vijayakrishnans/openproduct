# list-your-build (LB): implementation status

| Milestone | State | PR |
|---|---|---|
| LB0: the spec | ✅ Shipped | [#28](https://github.com/vijayakrishnans/openproduct/pull/28) |
| LB1: list and verify | ✅ Shipped | [#30](https://github.com/vijayakrishnans/openproduct/pull/30) |
| LB2: live from the repo | ✅ Shipped | [#31](https://github.com/vijayakrishnans/openproduct/pull/31) |
| LB3: open roles | ✅ Shipped | [#32](https://github.com/vijayakrishnans/openproduct/pull/32) |
| LB4: maintainers and contributors | ✅ Shipped | [#33](https://github.com/vijayakrishnans/openproduct/pull/33) |
| LB5: the pitch, a cover and a live link | ✅ Shipped | [#34](https://github.com/vijayakrishnans/openproduct/pull/34) |
| LB6: moderation and lifecycle | ✅ Shipped | [#36](https://github.com/vijayakrishnans/openproduct/pull/36) |

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

### Owners hand over; anyone leaves; contributors stay computed (LB4)

An invite is a maintainer row with no `accepted_at`, so it never grants anything until accepted. Any maintainer can invite. Only an owner removes others or makes someone an owner, so a team can hand a build over; anyone can leave, and the last owner can't. Contributors are the repo's own (up to 100 people, bots left out), read with the hourly stats, and count for a builder only by an exact GitHub-login match through a GitHub sign-in, never by a typed name. A listing counts toward badges, projects and support links only while it's published.

### Covers live in R2, one bucket per environment (LB5)

`openproduct-web-covers-stage` and `openproduct-web-covers-prod` (created 2026-11-10), bound as `COVERS`; `select-env.mjs` swaps in prod's for prod. A cover is checked by its magic bytes (PNG, JPEG, WebP; never SVG), capped at 2 MB, stored under `covers/<slug>/<random>.<ext>` with its true type, and served by `/covers/…` with `nosniff` and a sandboxing CSP. Only keys of that shape can be requested. Replacing a cover deletes the old object.

### Q1 answered by its default: the workspace link is optional (LB5)

openproduct.live's builds carry an Orunbase reference like `org_…`, and their "Fork & deploy" goes to the Orunbase app; there's no per-workspace fork address. A listing takes the same kind of reference (`org_…` or `ws_…`), and shows the same button and panel only when one is set.

### Hiding is a listing state; restoring puts back what was there (LB6)

A moderator's Hide sets `state = 'hidden'` and resolves the listing's reports. Restore publishes it again if it's still publishable (verified, tagline, category), otherwise returns it to a draft. Only published listings can be reported. A hidden listing is a 404 to everyone except moderators, who see a "Hidden by a moderator" banner with Restore; its maintainers see the same note in its settings.

### Renames move everything keyed by the slug, and never chain (LB6)

Maintainers, seats and stats follow by `ON UPDATE CASCADE`; votes, build follows, raised hands, build support links, listing reports and posts about the build are updated in the same batch. Earlier names are re-pointed at the newest, so `/builds/<old>` is always one redirect. A name renamed away from is held for 30 days, so nobody else can take a just-vacated address. Renaming and deleting are owners only; deleting asks for the build's name to be typed.

### `?from=here` (D1, LB6)

If openproduct.live ever lists a slug that a listing here already has, theirs wins on `/builds/<slug>`, and `?from=here` still shows this site's listing until its owners rename it.

## Closed (2026-11-10)

All seven milestones shipped, LB0 through LB6, in PRs #28 and #30–#34 and #36. Along the way, OP-34 (#29) and OP-35 (#35) added demo sign-in, so the site can be shown without real accounts. Both stage and prod carry marked demo data (`web/scripts/seed-demo.mjs`, `seed-demo-listings.mjs`). In Orunbase, EP-2 rolls up 7/7 tasks done; its status label is set in the Orunbase console, since neither the CLI nor the MCP tools can change it.

What stays open, none of it blocking:

- **Before going live:** set `DEMO_SIGNIN` to `"off"` in `web/wrangler.jsonc`, remove the demo data (`--remove` on both seed scripts), and set the GitHub sign-in secrets or have Orunbase approve this site's sign-in address (OP-35).
- **GitHub rate limits:** set `GITHUB_TOKEN` (or the GitHub sign-in secrets) on both workers once listings grow past a handful; anonymous reads allow 60 an hour.
- **R6:** re-verifying a listing when its repo changes hands isn't built; a listing keeps its verification.
