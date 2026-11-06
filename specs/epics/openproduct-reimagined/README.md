# Epic: openproduct-reimagined (OP)

**openproduct.live lists products built in the open, but its pages read as a catalogue: a listing is a form a maker filled in. This epic builds a sample of the redesign, "Products built in the open", as an app of its own: a directory where every card is a small living map of the build (data, sign-in, payments, deploy), ranked by what actually changed, with open roles you join by opening a PR. It reads the real directory from openproduct.live's public API, and says so plainly wherever the API has nothing yet and the page shows sample data.**

It is for showing the direction to a collaborator before anyone changes openproduct.live itself. When it ships there is a public URL to send, the real listings rendered in the new design, and a clear line between what is live data and what is mocked.

## Status

| Field | Value |
|-------|-------|
| Status | ✅ Shipped |
| Cluster | **OP** (OP0–OP4) |
| Owner(s) | `apps/web` (the whole app) |
| Builds on | Nothing: a fresh repository. orun builds and deploys it with the stack-tectonic `cloudflare-workers-assets-turbo` composition, against the newopenproduct workspace |
| Changes | A single Next.js app in `web/`, an `intent.yaml` and an orun CI workflow. No database, no runtime secrets, no sign-in. |
| Decisions locked | (1) Read-only from `https://api.openproduct.live`; nothing is written. (2) Sample data is labelled on the page wherever it appears. (3) Sign in, List your build, Upvote, Follow and Fork & deploy link to the real openproduct.live and Orunbase. |
| Gate | OP1 is the first user-visible change: the home page on real data. |
| Shipped as | PRs #1–#5 on 2026-11-06; prod: https://openproduct-web-prod.vijayakrishnan12994.workers.dev |

## Read order

1. `design.md`: the pages, the data each section reads, what is sample
2. `implementation-plan.md`: the milestones and what "done" means for each
3. `risks-and-open-questions.md`: what could go wrong and what was decided
4. `IMPLEMENTATION-STATUS.md`: what actually shipped

## Milestones at a glance

| Milestone | What it lands | Done when |
|---|---|---|
| OP0 — the spec | this doc set | merged |
| OP1 — the directory | home: hero, build cards with app maps, filters, sorting, the quiet row, how-it-works, footer | stage and prod show the real listings in the new design |
| OP2 — the build page | `/builds/<slug>`: header, app map, build log, run-your-own, roles, people, embed | every listing opens its own page |
| OP3 — the pulse, roles and phone | live pulse, "Looking for people" row, `/roles`, the phone layout and bottom bar | screenshots at 1440 and 390 px match the PDF's layout |
| OP4 — polish and hand-off | fixes from a screenshot pass, the share link | the link is sent |
