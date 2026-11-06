# openproduct-reimagined (OP) — Implementation status

As-built ≠ intent. This file records what actually shipped, and every place
the code departed from `design.md`.

| Milestone | State | PR |
|---|---|---|
| OP0 — the spec | ✅ Shipped | [#1](https://github.com/vijayakrishnans/openproduct/pull/1) |
| OP1 — the directory | ✅ Shipped | [#2](https://github.com/vijayakrishnans/openproduct/pull/2) |
| OP2 — the build page | ✅ Shipped | [#3](https://github.com/vijayakrishnans/openproduct/pull/3) |
| OP3 — the pulse, roles and phone | | |
| OP4 — polish and hand-off | | |

## Departures from the design

### The quiet row starts open on a quiet week (OP1)

The design shows the quiet row collapsed. On 2026-11-06, 30 of the 31 live
builds had no change in seven days, which left a one-card grid. The row now
starts open when fewer than five builds are active.

### Drafts are left out (OP1)

The API lists four entries with no tagline or category, which look like
unfinished drafts. The directory leaves out any entry without both.

### The pulse is real, so it is not "the last hour" (OP3)

The design's pulse reads "public commits · last hour". The API's feed is empty,
and the newest real commit times (`lastCommitAt`) are from a day to weeks
ago. The pulse shows the five newest of those with their real age, headed
"public commits · newest first", rather than sample lines. Each line says
"pushed to main" because the API carries the time, not the commit message.
