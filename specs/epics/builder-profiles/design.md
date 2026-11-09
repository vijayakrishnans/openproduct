# builder-profiles (BP): design

## What exists today

- **Public builder record** (`/v1/public/openproduct/people/<handle>`): display name, bio, GitHub URL, website URL, "open to a project", when the page was published, the public listings they maintain, the public listings they contribute to, and a follower count. `reviews` is null.
- **Maker marks** (openproduct.live, PE2): *First launch*, *Clean vote*, *Maintains N*. Each is computed from a read the page already makes, and each links the formula that produced it. No table of awards exists.
- **Profile editing** on openproduct.live (`/me`): bio, GitHub, website, open to a project. Sign-in runs through the gateway's sessions.
- **Discussions**: every thread belongs to a listing (`slug` is required on create), carries one of six tags, and renders its body with the render subset: text, emphasis, code, links, lists, quotes and mentions. There's no HTML and no embeds.
- **This site** reads the public API and writes nothing.

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
| First launch, Clean vote | the existing maker-mark inputs, once the public API exposes them | BP2 (additive field) |
| Started a discussion / *N* posts | community threads and posts by the builder | BP3, BP4 |
| First PR merged / *N* PRs merged | merged pull requests to openproduct builds, observed | BP5 |

Tiers stop at 10 on purpose. A leaderboard of people isn't the goal (D1), and maker marks already refuse scores.

### D3. Projects are public listings only

The project grid shows `maintains` and `contributesToListings`, which the API already limits to public listings. The site adds nothing that could reach a private workspace. Each project shows its cover (OP-9's tile), its tagline, and the builder's relationship to it: maintainer or contributor.

### D4. Builders edit on openproduct.live; this site displays

Support links, posts and community threads are written through openproduct.live's existing sign-in and settings, then published on the public API, and this site renders them. Each editable section here carries an "Edit on openproduct.live" link for the signed-in owner, and plain text for everyone else.

**Alternative rejected: sign-in on this site.** That needs a second front door to the gateway's sessions: a cookie scoped to another domain, CSRF handling across origins, and a second place where an account can be taken over. That's a lot of risk for a site that's still a redesign sample. If this site becomes openproduct.live, editing moves here with the domain, and the APIs this epic adds don't change.

### D5. Support links are allowlisted

A builder, and separately a listing, can have up to four support links. Hosts accepted: `patreon.com`, `github.com/sponsors/…`, `ko-fi.com`, `buymeacoffee.com`, `opencollective.com`, `liberapay.com`, `polar.sh`, `gumroad.com`. The server stores `{provider, url}`, and the provider comes from the host, not from the user. Everything goes over HTTPS. **Why:** a free-form "pay me" link on a trusted directory is a phishing surface. The allowlist is a line of contracts code, so adding a provider is a one-line PR.

### D6. Community threads have no listing

A thread can now be created without a `slug`, with its `profileId` null. Those threads live in a **Community** space, show in the forum index under the same six tags, and are the home for discussions like "Vercel vs Cloudflare". Thread creation, posting, moderation, reports and rate limits are unchanged. **Why:** forcing a general discussion onto some listing would put it in a stranger's comment section.

### D7. Posts are a builder's own writing, and videos are embedded by id

A **post** belongs to a builder: a title, a body in the existing render subset, an optional video, and an optional build it's about. A video URL is accepted only from YouTube (`youtube.com/watch`, `youtu.be`, `youtube.com/shorts`), Vimeo or Loom. It's parsed to `{provider, id}` on the server, and the page builds the embed itself: `youtube-nocookie.com/embed/<id>`, `player.vimeo.com/video/<id>`, `loom.com/embed/<id>`, in a sandboxed iframe with `loading="lazy"`. A stored post never carries an iframe or any HTML. **Why:** an embed is third-party code on our page. Allowing only known players, built from an id, means a post can't inject anything else. Posts go through the same report and moderation flow as discussion posts.

### D8. Additive API only

Every new field (`supportLinks`, `makerMarkInputs`, `posts`, `mergedPrs`) is additive under the public API's "additive forever" rule, with null meaning "not observed", never a zero that reads as a judgement.
