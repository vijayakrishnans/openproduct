# Epic: builder-profiles (BP)

**A builder's page should add up to something. Today it's a name, a bio and two lists. This epic gives every builder a profile that builds up from what they've done on openproduct: badges earned from contributions, the public projects they work on, links where people can pay them (Patreon, GitHub Sponsors, Ko-fi and the like), and their own blog posts and videos. It also gives the community a place for discussions that aren't about one build, such as "Vercel vs Cloudflare", and starts it with a few threads.**

Profiles stay honest. Every badge is computed from public data, and each one says what it was computed from. Nobody awards a badge by hand, and a private project never appears.

## Status

| Field | Value |
|-------|-------|
| Status | 📝 Proposed |
| Cluster | **BP** (BP0–BP5) |
| Owner(s) | `web/` here; `apps/openproduct/{core,gateway,web,packages}` in orun-cloud for the backend milestones |
| Builds on | openproduct-reimagined (OP), and openproduct.live's existing profiles, maker marks (PE2), discussions and render subset |
| Decisions locked | (1) Badges are computed from public data, never awarded. (2) Builders edit on openproduct.live, where sign-in already exists, and this site displays the result. (3) Videos are embedded only from an allowlist of providers, stored as provider plus video id, never as raw HTML. (4) Support links accept an allowlist of hosts. (5) Only public listings appear on a profile. |
| Gate | BP1 ships on today's API with no backend change. |

## Read order

1. `design.md`: the model, the decisions, and the alternative we rejected
2. `implementation-plan.md`: the milestones and what "done" means for each
3. `risks-and-open-questions.md`: what could go wrong and what's decided
4. `IMPLEMENTATION-STATUS.md`: what actually shipped

## Milestones at a glance

| Milestone | What it lands | Where | Done when |
|---|---|---|---|
| BP0: the spec | this doc set | openproduct | merged |
| BP1: badges and projects | builder page shows badges computed from public data and a grid of public projects; badges also appear on builder cards | openproduct | every builder page shows its badges, each with what it was computed from |
| BP2: support links | builders and builds can list up to four support links (Patreon, GitHub Sponsors, Ko-fi…); edited on openproduct.live, shown here | orun-cloud, then openproduct | a builder adds a Patreon link on openproduct.live and it shows on their page here |
| BP3: community discussions | threads that aren't about one build; the starter discussions are posted | orun-cloud, then openproduct | "Vercel vs Cloudflare" and the other starter threads are live and open for replies |
| BP4: builder posts | builders write blog posts and share videos (YouTube, Vimeo, Loom); shown on their page and in the community | orun-cloud, then openproduct | a builder publishes a post with a YouTube video and it plays on their page and in the community feed |
| BP5: merged-PR badges | badges for merged pull requests to openproduct builds | orun-cloud, then openproduct | a builder whose first PR merges gets "First PR merged" without anyone setting it |
