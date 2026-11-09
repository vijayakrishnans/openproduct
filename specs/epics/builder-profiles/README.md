# Epic: builder-profiles (BP)

**A builder's page should add up to something. Today it's a name, a bio and two lists. This epic gives every builder a profile that builds up from what they've done on openproduct: badges earned from contributions, the public projects they work on, links where people can pay them (Patreon, GitHub Sponsors, Ko-fi and the like), and their own blog posts and videos. It also gives the community a place for discussions that aren't about one build, such as "Vercel vs Cloudflare", and starts it with a few threads.**

Profiles stay honest. Every badge is computed from public data, and each one says what it was computed from. Nobody awards a badge by hand, and a private project never appears.

## Status

| Field | Value |
|-------|-------|
| Status | 📝 Proposed |
| Cluster | **BP** (BP0–BP7) |
| Owner(s) | `web/` here. Nothing in orun-cloud: openproduct.live is not changed by this epic (revised 2026-11-09) |
| Builds on | openproduct-reimagined (OP), and openproduct.live's existing profiles, maker marks (PE2), discussions and render subset |
| Decisions locked | (1) Badges are computed from public data, never awarded. (2) **This site gets its own accounts and its own database** (Cloudflare D1). Builders sign in here with GitHub, Google, Apple, Orunbase or an email link, and everything they add lives here. openproduct.live stays read-only to us. (3) Videos are embedded only from an allowlist of providers, stored as provider plus video id, never as raw HTML. (4) Support links accept an allowlist of hosts. (5) Only public listings appear on a profile. |
| Gate | BP2 (accounts) comes before anything a builder writes. |
| Revised | 2026-11-09: the first version put editing on openproduct.live; the owner asked for everything to live on this site instead. D4 is reversed, and D9 to D12 are new. |

## Read order

1. `design.md`: the model, the decisions, and the alternative we rejected
2. `implementation-plan.md`: the milestones and what "done" means for each
3. `risks-and-open-questions.md`: what could go wrong and what's decided
4. `IMPLEMENTATION-STATUS.md`: what actually shipped

## Milestones at a glance

| Milestone | What it lands | Done when |
|---|---|---|
| BP0: the spec | this doc set (and its revision) | merged |
| BP1: badges and projects | badges computed from public data, and the builder's public projects | ✅ shipped (#15) |
| BP2: accounts | a D1 database, sessions, and sign-in with GitHub, Google and Orunbase; a builder claims their openproduct profile or starts a new one | a builder signs in with any of the three and sees "Edit profile" on their own page |
| BP3: Apple and email sign-in | Sign in with Apple, and a one-time email link | both work on the site's own domain |
| BP4: support links | builders and maintainers add up to four support links; shown on builder and build pages | a builder adds a Patreon link here and it shows on their page |
| BP5: community discussions | threads written here, listed with openproduct.live's; the starter discussions | "Vercel vs Cloudflare" and the other starter threads are live here and open for replies |
| BP6: builder posts | blog posts and YouTube, Vimeo or Loom videos, on the builder page and in the community | a post with a YouTube video plays on the builder page and in the community feed |
| BP7: merged-PR badges | badges for merged pull requests to openproduct builds, read from GitHub | a builder signed in with GitHub whose PR merged shows "First PR merged" |
