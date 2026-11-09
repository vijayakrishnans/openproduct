# builder-profiles (BP): design

## What exists today

- **Public builder record** (`/v1/public/openproduct/people/<handle>`): display name, bio, GitHub URL, website URL, "open to a project", when the page was published, the public listings they maintain, the public listings they contribute to, and a follower count. `reviews` is null.
- **Maker marks** (openproduct.live, PE2): *First launch*, *Clean vote*, *Maintains N*. Each is computed from a read the page already makes, and each links the formula that produced it. No table of awards exists.
- **Profile editing** on openproduct.live (`/me`): bio, GitHub, website, open to a project. Sign-in runs through the gateway's sessions.
- **Discussions**: every thread belongs to a listing (`slug` is required on create), carries one of six tags, and renders its body with the render subset: text, emphasis, code, links, lists, quotes and mentions. There's no HTML and no embeds.
- **This site** reads the public API. Until BP2 it has no sign-in and no storage of its own.

## Decisions

### D1. A badge is computed, never awarded

Every badge is a pure function of public data, and the page says what it was computed from, the way maker marks already work. There's no awards table and no field anyone can set. **Why:** a badge is a claim about a person. If a reader can't check it, it's decoration, and if someone can grant it, it can be gamed or sold.

### D2. The badges

| Badge | Computed from | Milestone |
|---|---|---|
| Builder since *Sep 2026* | `publishedAt` | BP1 |
| Maintains *N* | `maintains` | BP1 |
| Contributor: one badge per build they contribute to, linking that build | `contributesToListings` | BP1 |
| First contribution / 3 builds / 10 builds (tiers) | `contributesToListings` count | BP1 |
| Open to a project | `openToProject` | BP1 |
| Has support links | their support links here | BP4 |
| Started a discussion / *N* posts | threads and posts they wrote here | BP5, BP6 |
| First PR merged / *N* PRs merged | merged pull requests to openproduct builds, read from GitHub for a builder signed in with GitHub | BP7 |

Tiers stop at 10 on purpose. A leaderboard of people isn't the goal (D1), and maker marks already refuse scores.

### D3. Projects are public listings only

The project grid shows `maintains` and `contributesToListings`, which the API already limits to public listings. The site adds nothing that could reach a private workspace. Each project shows its cover (OP-9's tile), its tagline, and the builder's relationship to it: maintainer or contributor.

### D4. Builders sign in and edit here (revised)

The first version of this design put editing on openproduct.live and rejected sign-in on this site. The owner reversed that on 2026-11-09: everything a builder adds (support links, posts, discussions) is written and stored **here**, and openproduct.live is not changed. D9 to D12 describe how.

**Alternative now rejected: editing on openproduct.live.** It would have reused that site's sign-in, but it changes a production system the owner wants left alone, and it keeps this site a read-only sample.

### D5. Support links are allowlisted

A builder, and separately a build they maintain, can have up to four support links. Hosts accepted: `patreon.com`, `github.com/sponsors/…`, `ko-fi.com`, `buymeacoffee.com`, `opencollective.com`, `liberapay.com`, `polar.sh`, `gumroad.com`. The server stores `{provider, url}`, and the provider comes from the host, not from the user. Everything goes over HTTPS. **Why:** a free-form "pay me" link on a trusted directory is a phishing surface. The allowlist is a line of contracts code, so adding a provider is a one-line PR.

### D6. Community threads live here

A thread written on this site is stored here, has no listing, carries one of the same six tags, and is listed together with openproduct.live's threads on the community page (newest or most replied, across both). Replies to a thread written here are written here. Threads from openproduct.live stay read-only, with a link to reply there. **Why:** one community page, without changing openproduct.live.

### D7. Posts are a builder's own writing, and videos are embedded by id

A **post** belongs to a builder: a title, a body in the existing render subset, an optional video, and an optional build it's about. A video URL is accepted only from YouTube (`youtube.com/watch`, `youtu.be`, `youtube.com/shorts`), Vimeo or Loom. It's parsed to `{provider, id}` on the server, and the page builds the embed itself: `youtube-nocookie.com/embed/<id>`, `player.vimeo.com/video/<id>`, `loom.com/embed/<id>`, in a sandboxed iframe with `loading="lazy"`. A stored post never carries an iframe or any HTML. **Why:** an embed is third-party code on our page. Allowing only known players, built from an id, means a post can't inject anything else. Posts and threads written here can be reported by any signed-in person; the site owner can hide a post, and a hidden post stays hidden until restored.

### D8. Storage: one D1 database per environment

Accounts, sessions, claims, support links, threads, replies and posts live in a Cloudflare D1 database bound to the worker, one each for stage and prod. Migrations are SQL files in `web/migrations/`, applied by wrangler before the deploy. Public data from openproduct.live is never copied in; it's read live as today.

### D9. Sign-in: five ways in, one account

| Provider | How | Needs |
|---|---|---|
| GitHub | OAuth app | a GitHub OAuth app (client id and secret) |
| Google | OpenID Connect | a Google Cloud OAuth client |
| Orunbase | Orunbase's OAuth 2.1 server, PKCE, a public client registered for this site | nothing secret; the client id is registered once |
| Apple | Sign in with Apple | an Apple Developer account, a Services ID and a key, and a domain Apple can verify |
| Email | a one-time link, valid 15 minutes, used once | an email-sending service and a domain to send from |

A person has one **account**, and each way in is an **identity** attached to it. Signing in with a second provider while signed in adds it to the same account. Signing in with a new provider while signed out makes a new account; the site never merges two accounts because their email addresses match, since an unverified address would let a stranger take over an account.

OAuth uses the Arctic library (small, no framework), with state and PKCE on every flow. A session is a random 256-bit token in an `HttpOnly`, `Secure`, `SameSite=Lax` cookie; the database stores only its SHA-256, so a leaked database can't be replayed. Sessions last 30 days and are refreshed on use. Every form that writes checks the request's origin.

The Orunbase token is used once to read who signed in, then thrown away. This site never calls Orunbase on the person's behalf.

**Alternative rejected: a hosted auth service (Clerk, Auth0).** It's quicker to start, but it puts every builder's identity with a third party and costs money per user. Five providers with Arctic is a few hundred lines this repo owns.

### D10. Claiming an openproduct profile

openproduct.live's builders already have pages here (read from the API). A signed-in person can **claim** one, which lets them add to it. A claim is accepted only when it can be proved: the profile's GitHub link matches the GitHub account they signed in with. Anyone else starts a **new builder profile** here, with a handle that isn't taken on openproduct.live or here. A new profile has a name, bio and links, and gets the same badges once it has activity.

A claim that can't be proved automatically (no GitHub link on the openproduct profile) isn't possible yet. The person adds their GitHub link on openproduct.live, then claims here.

### D11. Personal data

The site stores, per account: the provider's account id, the name and avatar the provider returns, and an email address only when the person signed in by email or the provider returned a verified one. Emails are never shown on a page. A person can delete their account, which deletes their identities, sessions, claims and support links, and replaces their name on threads and posts with "deleted builder".

### D12. Secrets stay out of the repository

OAuth client secrets and the Apple key are Worker secrets, set by the owner with `wrangler secret put` (or brokered through Orunbase), never committed. A provider whose secrets are missing doesn't appear on the sign-in page, so the site can ship with some providers and gain the rest later.
