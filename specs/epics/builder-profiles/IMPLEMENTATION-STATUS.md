# builder-profiles (BP): implementation status

What actually shipped, and every place the code departed from `design.md`.

| Milestone | State | PR |
|---|---|---|
| BP0: the spec | ✅ Shipped, revision in review | [#14](https://github.com/vijayakrishnans/openproduct/pull/14) |
| BP1: badges and projects | ✅ Shipped | [#15](https://github.com/vijayakrishnans/openproduct/pull/15) |
| BP2: accounts | ⏳ Not started | |
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
