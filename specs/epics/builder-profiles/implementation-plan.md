# builder-profiles (BP): implementation plan

Order: BP1 needs no backend change, so it ships first. BP2 and BP3 are small backend additions. BP3 comes before BP4 because the starter discussions were asked for directly, and BP4 is the largest piece. BP5 depends on an observation openproduct.live doesn't make yet.

Backend milestones are two PRs each: one in orun-cloud (`apps/openproduct`) with its own task there, then one here to render the new fields.

## BP0: the spec (OP-14)

**Done when:** this doc set is merged.

## BP1: badges and projects (OP-15)

- `web/src/lib/badges.ts`: `builderBadges(person)` returns `{kind, label, from, href?}[]` per D2's BP1 rows, with unit tests.
- Builder page: a badge row under the bio, where each badge's tooltip and accessible label says what it was computed from. Below it, a **Projects** grid of public listings with cover, tagline, and a "Maintainer" or "Contributor" tag.
- Builder cards on `/builders`: up to three badges.

**Done when:**
- Every builder page shows its badges, and each badge says what it was computed from.
- The projects grid shows exactly the builder's public maintained and contributed listings.
- Tests cover every badge rule, including a builder with no contributions (no contributor badges and no zero-count badge).

## BP2: support links (orun-cloud task, then OP-16)

- contracts: the `SUPPORT_PROVIDERS` allowlist, `parseSupportLink(url)`, and `supportLinks` on `PublicContributor` and on the public listing. Also `makerMarkInputs` on `PublicContributor`.
- db: a migration adding `support_links` (JSON, at most 4) to contributor and listing records.
- core: `PUT /me` and the listing edit accept `supportLinks`, validated with `parseSupportLink`.
- openproduct.live `/me` and the listing settings: a "Support links" editor.
- This site: a **Support** block on the builder page and on the build page, with provider icons, plus the First launch and Clean vote badges.

**Done when:**
- A builder adds a Patreon link on openproduct.live and it appears on their builder page here.
- A maintainer adds a GitHub Sponsors link to a listing and it appears on that build page.
- A link to any host not on the allowlist is refused with a message naming the hosts that are accepted.

## BP3: community discussions (orun-cloud task, then OP-17)

- core: `handleCreateThread` accepts a missing `slug` and creates a community thread. The forum index and thread page include community threads, labelled **Community** in place of a listing.
- openproduct.live: a "Start a discussion" button on `/threads`.
- This site: the community page shows community threads, plus "Start a discussion" linking to openproduct.live. Builder badges: Started a discussion.
- Starter threads, posted under the account of the repo owner (vijayakrishnans) after they approve the drafts:
  1. **Vercel vs Cloudflare for a side project that might grow up** (question)
  2. **How much freedom do you actually get: Base44 vs Orunbase?** (design)
  3. **Your first PR to someone else's build: what made it easy or hard?** (contributing)
  4. **Funding open builds: Patreon, GitHub Sponsors, or nothing?** (governance)
  5. **What's the smallest accessible thing every build should ship?** (accessibility)

**Done when:**
- The starter threads are live on openproduct.live and on this site's community page, and anyone signed in can reply.

## BP4: builder posts (orun-cloud task, then OP-18)

- contracts: the `Post` type, `parseVideoUrl(url)` returning `{provider, id}` for YouTube, Vimeo or Loom (anything else returns null), and `videoEmbedSrc`.
- db: a `posts` table (id, author subject, title, body, video provider and id, optional listing, created and updated times, moderation state).
- core: create, edit and delete for the author; public list by builder and a public community feed; reports through the existing moderation flow.
- openproduct.live: a "Write a post" form on `/me`.
- This site: **Posts** on the builder page, a **From the builders** feed on the community page, and a post page with a sandboxed embed. Badge: *N* posts.

**Done when:**
- A builder publishes a post with a YouTube link on openproduct.live, and the video plays on their builder page and on the community page here.
- A post with a non-allowlisted video URL is refused, and no stored post contains HTML.

## BP5: merged-PR badges (orun-cloud task, then OP-19)

- core: count merged pull requests per GitHub login on public listings' repos, using the sweep's existing repo observation, and publish `mergedPrs` (null where unobserved).
- This site: First PR merged and *N* PRs merged badges.

**Done when:**
- A builder whose first PR to an openproduct build merges shows "First PR merged" within one sweep, without anyone setting it.
