# builder-profiles (BP): implementation status

What actually shipped, and every place the code departed from `design.md`.

| Milestone | State | PR |
|---|---|---|
| BP0: the spec | ✅ Shipped | [#14](https://github.com/vijayakrishnans/openproduct/pull/14) |
| BP1: badges and projects | 🚧 In review | |
| BP2: support links | ⏳ Not started | |
| BP3: community discussions | ⏳ Not started | |
| BP4: builder posts | ⏳ Not started | |
| BP5: merged-PR badges | ⏳ Not started | |

## Departures from the design

### A "Launched a build" badge (BP1)

The design's BP1 list didn't include it, but the public builders list already carries `launched`, so BP1 shows it. The profile read doesn't carry that field, so the builder page takes it from the list. If the list can't be read, the badge is left out rather than guessed.

### Each badge's source is printed, not only in a tooltip (BP1)

On the builder page, each badge shows what it was computed from under its name. A tooltip alone doesn't work on phones. The small badges on cards keep it in the tooltip and the accessible name.
