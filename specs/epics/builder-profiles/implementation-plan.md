# builder-profiles (BP): implementation plan

Revised 2026-11-09: everything is built in this repository, on this site's own accounts and database (design D4, D8 to D12). Nothing changes in orun-cloud.

Order: accounts (BP2) come before anything a builder writes. Apple and email (BP3) need a custom domain and accounts the owner has to create, so they come after the three providers that work on the current `workers.dev` address. BP5 comes before BP6 because the starter discussions were asked for directly.

## BP0: the spec (OP-14, revised in OP-16)

**Done when:** this doc set and its revision are merged.

## BP1: badges and projects (OP-15) ✅

## BP2: accounts (OP-17)

- D1 databases `openproduct-web-stage` and `openproduct-web-prod`, bound as `DB`; `web/migrations/0001_accounts.sql`: accounts, identities, sessions, oauth state, builder profiles, claims.
- `web/src/lib/auth/`: sessions (hashed token, cookie, 30-day sliding expiry), origin check, and a provider for each of GitHub, Google and Orunbase on Arctic. The Orunbase client is registered once with Orunbase's dynamic registration and its id kept in config.
- Routes: `/signin` (shows only providers whose secrets are set), `/auth/<provider>` and `/auth/<provider>/callback`, `/signout`, and `/account` (identities, add a provider, delete the account).
- Header: "Sign in" becomes the account menu when signed in.
- Builder pages: "Claim this profile" when the signed-in GitHub account matches the profile's GitHub link (D10); otherwise "Start your builder profile" makes a new one with a free handle.

**Done when:**
- A person signs in with GitHub, Google or Orunbase and lands back where they started, signed in.
- Signing in with a second provider from `/account` adds it to the same account.
- A GitHub account matching an openproduct profile's GitHub link can claim it; any other can't.
- Sign-out ends the session, and a stolen database row can't be used as a cookie.
- Tests cover sessions, state and PKCE checking, the origin check, the claim rule and handle rules.

## BP3: Apple and email sign-in (OP-18)

Needs: a domain for the site, an Apple Developer account, and an email-sending service (Cloudflare Email Service on that domain).

**Done when:** Sign in with Apple and the email link both work on the custom domain, and an email link works once and expires after 15 minutes.

## BP4: support links (OP-19)

- `web/src/lib/support-links.ts`: the allowlist and parser (D5), with tests.
- An "Edit profile" page with four support-link slots; a maintainer of a build (per its public listing, for a claimed profile) gets the same on the build.
- A **Support** block on builder and build pages, and the "Has support links" badge.

**Done when:**
- A builder adds a Patreon link here and it shows on their page; a maintainer adds one to their build and it shows there.
- A link to a site not on the list is refused with the list of sites that are.

## BP5: community discussions (OP-20)

- Threads and replies tables; "Start a discussion" and reply forms for signed-in builders; the community list merges threads from here and from openproduct.live (D6); report and hide.
- The "Started a discussion" badge.
- The starter threads, posted by the owner's account after they approve the drafts:
  1. Vercel vs Cloudflare for a side project that might grow up (question)
  2. How much freedom do you actually get: Base44 vs Orunbase? (design)
  3. Your first PR to someone else's build: what made it easy or hard? (contributing)
  4. Funding open builds: Patreon, GitHub Sponsors, or nothing? (governance)
  5. What's the smallest accessible thing every build should ship? (accessibility)

**Done when:** the starter threads are live on the community page and signed-in builders can reply.

## BP6: builder posts (OP-21)

- Posts table; write, edit and delete for the author; `parseVideoUrl` for YouTube, Vimeo and Loom (D7).
- Posts on the builder page, a post page, and a "From the builders" feed on the community page; the "*N* posts" badge.

**Done when:** a post with a YouTube link plays on the builder page, its own page and the community feed; any other video URL is refused and no post stores HTML.

## BP7: merged-PR badges (OP-22)

- For a builder signed in with GitHub, count their merged pull requests to the public repos of openproduct builds through GitHub's search API, cached for a day.

**Done when:** a builder whose PR to an openproduct build merged shows "First PR merged" without anyone setting it; a builder without GitHub shows neither badge and no zero.
