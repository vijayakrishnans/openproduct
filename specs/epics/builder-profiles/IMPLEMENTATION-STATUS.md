# builder-profiles (BP): implementation status

What actually shipped, and every place the code departed from `design.md`.

| Milestone | State | PR |
|---|---|---|
| BP0: the spec | ✅ Shipped | [#14](https://github.com/vijayakrishnans/openproduct/pull/14), [#16](https://github.com/vijayakrishnans/openproduct/pull/16) |
| BP1: badges and projects | ✅ Shipped | [#15](https://github.com/vijayakrishnans/openproduct/pull/15) |
| BP2: accounts | ✅ Shipped | [#17](https://github.com/vijayakrishnans/openproduct/pull/17) |
| BP3: Apple and email sign-in | 🚧 Built, off until configured | [#26](https://github.com/vijayakrishnans/openproduct/pull/26) |
| BP4: support links | ✅ Shipped | [#18](https://github.com/vijayakrishnans/openproduct/pull/18) |
| BP5: community discussions | ✅ Shipped | [#20](https://github.com/vijayakrishnans/openproduct/pull/20), [#21](https://github.com/vijayakrishnans/openproduct/pull/21) |
| BP6: builder posts | ✅ Shipped | [#22](https://github.com/vijayakrishnans/openproduct/pull/22) |
| BP7: merged-PR badges | ✅ Shipped | [#23](https://github.com/vijayakrishnans/openproduct/pull/23) |

## Departures from the design

### A "Launched a build" badge (BP1)

The design's BP1 list didn't include it, but the public builders list already carries `launched`, so BP1 shows it. The profile read doesn't carry that field, so the builder page takes it from the list. If the list can't be read, the badge is left out rather than guessed.

### Each badge's source is printed, not only in a tooltip (BP1)

On the builder page, each badge shows what it was computed from under its name. A tooltip alone doesn't work on phones. The small badges on cards keep it in the tooltip and the accessible name.

### Support links were first built on openproduct.live, then withdrawn (BP2, first version)

Under the first design, support links were built in orun-cloud as a migration and a feature PR (sourceplane/orun-cloud#2301 and #2302). The owner asked for the work to live on this site instead, so both were closed unmerged on 2026-11-09, and the design was revised (D4, D8 to D12).

### No OAuth library: the flows are written here (BP2)

D9 named the Arctic library. On 2026-11-09 npm marked every Arctic version "Package no longer supported. Contact Support", which is what npm shows for a package that has been pulled. A pulled package doesn't belong in the sign-in path, so `web/src/lib/auth/providers.ts` implements the three flows directly: authorization code with PKCE (S256) and state, using `fetch` and Web Crypto. There are no new dependencies.

### The schema migrates itself at runtime (BP2)

D8 said migrations would be applied by wrangler before the deploy. The deploy pipeline (stack-tectonic `cloudflare-workers-assets-turbo`) runs `wrangler deploy` and has no migration step. So `web/src/lib/server/db.ts` applies any migration the database hasn't recorded, once per isolate, before the first query. Every statement is `IF NOT EXISTS`, and `schema_migrations` records what ran.

### One wrangler config, the database chosen at build time (BP2)

The pipeline deploys stage and prod from the same `wrangler.jsonc` and changes only the worker name. `web/scripts/select-env.mjs` swaps in prod's D1 id when `ORUN_ENVIRONMENT=prod`, set through the composition's `environmentBuildVar`.

### Orunbase's client expires, so the site re-registers (BP2)

Orunbase forgets a self-registered client 30 days after it was last used. The site stores its client id per callback address, and registers a new client if 25 days pass without a sign-in.

### Maintainers come from the claimed profile, and a build's links follow its maintainer (BP4)

The public build data lists no maintainers (`maintainers` is empty on every listing). So "maintains this build" means the build is in the `maintains` list of the account's claimed openproduct.live profile, read live. A build's links render only while whoever set them still maintains it, which needs one more profile read on build pages that have links.

### Drafts open on openproduct.live (BP4, fixes BP1)

The directory leaves out drafts (no tagline or no category), so `/builds/<draft>` is a 404. Project cards on builder pages, and the account page's build links, now send drafts to their openproduct.live listing. A draft's support links are saved, and show once it's listed.

### The support badge is "Open to support" (BP4)

D2 called it "Has support links". The badge reads "Open to support" and says how many ways are listed.

### Posting needs a builder profile; moderators are GitHub logins (BP5)

Posting and replying need a builder profile (claimed or started here), so every post names a builder. Reporting only needs an account. A moderator is an account signed in with a GitHub login on the `MODERATORS` list (a Worker secret, comma-separated). It defaults to the site owner, `vijayakrishnans`. A moderator can hide or restore a thread or post, and sees open reports at `/community/moderation`. Limits: 3 threads and 20 posts per account per hour.

### BP5 landed in two pull requests

#20 was stacked on the dark-mode branch (#19, OP-23, outside this epic) and merged into that branch after #19 had already merged, so it never reached `main`. #21 carries the same commit to `main` unchanged.

### Posts are stored as "articles" (BP6)

The `posts` table already holds discussion replies, so builder posts live in `articles`. The site calls them posts everywhere a person reads. A video is two columns, `video_provider` and `video_id`, and `storedVideo` re-checks them on every read.

### Posts get headings; discussions don't (BP6)

A blog post needs sections, so the post body adds `##` and `###` to the render subset. Discussions keep the subset openproduct.live's API uses, so a thread here reads the same as one from there.

### Deleting an account deletes its posts (BP6)

A discussion reply outlives its author as "deleted builder" (D11), because other replies answer it. A post is the builder's own page, so it goes with the account (`ON DELETE CASCADE`).

### Reports cover posts; the table was rebuilt (BP6)

SQLite can't widen a `CHECK` in place, so migration 4 copies `reports` into a new table that also accepts `article`, inside one transaction. Running it twice copies the already-rebuilt table, so racing isolates lose nothing; a test covers reports made before it.

### Also added: an index of posts and a limit per day (BP6)

`/posts` lists every post, and the community page shows the latest three under "From the builders". A builder can publish five posts a day.

### Demo data

`web/scripts/seed-demo.mjs` prints SQL for four demo builders (bios start "Demo profile"), discussions with replies, five posts with YouTube and Vimeo videos, and one open report. Every row is marked (`demo-` accounts, `de300000-` ids), demo accounts have no way to sign in, and `--remove` prints the SQL that deletes them all. It's for stage and local; prod gets none.

### Your own builds don't count (BP7)

The plan counts merged PRs "to the public repos of openproduct builds". Today every merged PR to those repos was merged by the repo's owner into their own build, so a literal count would hand everyone a badge for merging their own work. The count leaves out repos the GitHub login owns and builds the profile maintains: the badge means a PR to *someone else's* build.

### The count stops at 10, and links GitHub's search (BP7)

"First PR merged", then "*N* PRs merged", then "10+ PRs merged", like the contribution tiers (D2). The badge links a GitHub search for exactly the PRs it counted, so anyone can check it (D1).

### How GitHub is read (BP7)

- The build listing doesn't carry `repoUrl`, so each build's page is read once a day for its repo, and the map is kept in `settings` (`build_repos`). If the refresh fails, yesterday's map is used.
- Search queries OR the build repos (`repo:a repo:b …`), packed under GitHub's 256-character limit. Per-repo counts for each login are kept a day in `merged_prs`, keyed by the public login, not the account.
- Requests authenticate with `GITHUB_TOKEN` if set, else the OAuth app's id and secret. A 403 or 429 backs off for 15 minutes and keeps the last good count; with none, there's no badge.
- Only the builder page asks GitHub. Cards on the builders list don't, so one page view never fans out into dozens of searches.

### Nothing sends people to openproduct.live (OP-25, outside the ladder)

The owner asked that no button leave for openproduct.live. Its data is still read from its public API, but every action now happens here:

- **Upvote** and **Follow** on a build, and **Follow** on a builder, are stored here (`votes`, `follows`). Counts show openproduct.live's number plus the ones made here, on cards, sorting and build pages alike.
- **Claim this seat** on a build with no repo becomes **Raise your hand** (`seat_hands`): only a builder can raise one, and the build page lists who did, linked to their profiles. A build with a repo still offers "Claim with a PR" too.
- **Replying to an openproduct.live thread** is written here, under a stand-in thread row with the same id marked `remote`; it carries the replies, reports and hiding, and is never listed on its own.
- **List your build** goes to Orunbase, where builds are made. Listing a build *on this site* would be a new milestone.
- Drafts, the footer, the ranking note and every error message no longer link out. A test fails if any source file links to the openproduct.live site again.

Migration 6 adds a column with `ALTER TABLE`, which can't be repeated, so `ensureSchema` now tolerates another isolate having applied a migration first: the failed batch changed nothing, and if the version is recorded it moves on.

### Apple and email sign-in ship switched off (BP3)

Both are built and tested, and each appears on the sign-in page only once its setup exists, like GitHub and Google (D12). Neither needs a code change to switch on.

**Sign in with Apple** asks Apple for no name or email. Without scopes Apple returns by a plain GET (`response_mode=query`) to the same callback as the other providers, so no cross-site POST or relaxed cookie is needed. Apple doesn't take PKCE, so the flow's secret verifier is hashed into a nonce, and the ID token must carry it back. The token is read for its subject after checking issuer, audience, expiry and nonce; it comes straight from Apple in exchange for the code, so its signature isn't checked (OIDC Core 3.1.3.7). To switch it on:

1. In Apple Developer, create a Services ID with Sign in with Apple, and add the return URL `https://<host>/auth/apple/callback` for each environment.
2. Create a key with Sign in with Apple enabled and download the `.p8`.
3. Set four Worker secrets on `openproduct-web-stage` and `openproduct-web-prod`: `APPLE_CLIENT_ID` (the Services ID), `APPLE_TEAM_ID`, `APPLE_KEY_ID`, and `APPLE_PRIVATE_KEY` (the `.p8` file's text).

**Email links** go through Cloudflare Email Service. The link lands on a page with a "Sign in" button rather than signing in on open, because mail scanners open links and would use them up. It works once (a single `UPDATE … RETURNING`) and expires after 15 minutes. Only the token's SHA-256 is stored, and three links per address per 15 minutes is the most. The form answers "check your inbox" whether or not the address has an account. An email identity is the address alone and is never merged with another account by address (D9). To switch it on:

1. Put a domain on Cloudflare DNS, and onboard it in Email Service → Email Sending. This needs the Workers Paid plan.
2. Add `"send_email": [{ "name": "EMAIL" }]` to `web/wrangler.jsonc`.
3. Set `EMAIL_FROM` (for example `signin@<domain>`) as a variable on both workers.

The binding isn't in `wrangler.jsonc` yet, so the deploy can't fail on an account that hasn't onboarded a domain.

## What waits on the owner (2026-11-10)

All eight milestones are built and deployed to stage and prod, with migrations 1–7 applied on both databases. Three things finish the epic, and each needs the owner:

1. **BP5's starter threads.** The five drafts are written. The owner signs in on prod, starts or claims a builder profile, and approves them; they are then posted under that account.
2. **BP3 setup.** Apple: a Services ID, a key and four secrets. Email: a domain on Cloudflare onboarded to Email Sending, the `send_email` binding, and `EMAIL_FROM`. The steps are in "Apple and email sign-in ship switched off" above.
3. **GitHub sign-in secrets** (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`) on both workers. Without them only Orunbase sign-in shows, and BP7's merged-PR badge can't appear for anyone on the live site.
