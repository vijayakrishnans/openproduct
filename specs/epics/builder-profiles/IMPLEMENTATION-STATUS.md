# builder-profiles (BP): implementation status

What actually shipped, and every place the code departed from `design.md`.

| Milestone | State | PR |
|---|---|---|
| BP0: the spec | ✅ Shipped | [#14](https://github.com/vijayakrishnans/openproduct/pull/14), [#16](https://github.com/vijayakrishnans/openproduct/pull/16) |
| BP1: badges and projects | ✅ Shipped | [#15](https://github.com/vijayakrishnans/openproduct/pull/15) |
| BP2: accounts | ✅ Shipped | [#17](https://github.com/vijayakrishnans/openproduct/pull/17) |
| BP3: Apple and email sign-in | ⏳ Not started | |
| BP4: support links | ✅ Shipped | [#18](https://github.com/vijayakrishnans/openproduct/pull/18) |
| BP5: community discussions | ✅ Shipped | [#20](https://github.com/vijayakrishnans/openproduct/pull/20), [#21](https://github.com/vijayakrishnans/openproduct/pull/21) |
| BP6: builder posts | ✅ Shipped | [#22](https://github.com/vijayakrishnans/openproduct/pull/22) |
| BP7: merged-PR badges | 🚧 In review | |

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
