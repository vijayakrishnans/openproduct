# builder-profiles (BP): implementation status

What actually shipped, and every place the code departed from `design.md`.

| Milestone | State | PR |
|---|---|---|
| BP0: the spec | ✅ Shipped | [#14](https://github.com/vijayakrishnans/openproduct/pull/14), [#16](https://github.com/vijayakrishnans/openproduct/pull/16) |
| BP1: badges and projects | ✅ Shipped | [#15](https://github.com/vijayakrishnans/openproduct/pull/15) |
| BP2: accounts | 🚧 In review | |
| BP3: Apple and email sign-in | ⏳ Not started | |
| BP4: support links | ⏳ Not started | |
| BP5: community discussions | ⏳ Not started | |
| BP6: builder posts | ⏳ Not started | |
| BP7: merged-PR badges | ⏳ Not started | |

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
