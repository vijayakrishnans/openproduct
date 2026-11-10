# list-your-build (LB): design

## Where things stand

- Every build on this site is read from `api.openproduct.live` (`loadDirectory`, `loadBuild`). They're shaped as `Build` / `BuildDetail`, with ranking `(changes + 1) × (upvotes + 1)`.
- This site has accounts (GitHub, Google, Orunbase, Apple, email), builder profiles, a D1 database per environment that migrates itself, and moderation (reports, hiding). It also has upvotes, follows and raised hands stored here (OP-25).
- "List your build" goes to Orunbase. There is no way to create a listing here.

## Decisions

### D1. A listing is stored here and shown with openproduct.live's

A listing lives in this site's D1. The directory merges listings from here with openproduct.live's into one list of `Build`s, carrying `source: "here" | "openproduct"`. Cards, sorting, topics, search, the home sidebar and build pages treat both the same. **Why:** one directory for visitors, and the owner's rule that nothing goes to openproduct.live (OP-25).

**One slug namespace.** A slug is refused when it's taken here or on openproduct.live (checked live at create time). If openproduct.live later lists the same slug, its build wins on `/builds/<slug>`, as with builder profiles. The listing here is renamed by its maintainers (LB6), and is shown at `/builds/<slug>?from=here` until then.

### D2. A listing is a public GitHub repo the lister has proved they control

The lister names a repo (`owner/name` or its URL). It must be public: GitHub's API answers 404 for a private repo, and that is refused. Control is proved one of two ways:

1. **Owner fast path.** The lister is signed in with GitHub and the repo's owner is their GitHub login. Verified at once.
2. **Verification file.** Anyone else, including an organisation's repo or a lister signed in another way, adds a file `.openproduct` to the repo's default branch. It contains a code the site shows them, unique to that listing. The site reads it through GitHub's contents API. Once it matches, the listing is verified, and the file can be deleted.

**Why:** proving write access with a file needs no stored GitHub token and works for organisations. The fast path covers the common case in one click.

**Alternative rejected: keep the GitHub OAuth token and ask GitHub for the lister's permission on the repo.** It would need a broader scope than `read:user` and storing tokens. This site deliberately throws tokens away after sign-in (builder-profiles D9).

**Alternative rejected: no proof.** Anyone could list someone else's repo, squat a slug, or collect raised hands on a build they don't run.

### D3. The numbers come from the repo

Changes in the last 7 days (merged pull requests plus commits to the default branch), licence (GitHub's detected SPDX id), last commit, and the top languages are read from GitHub's API. They're cached per listing for an hour, with the same backoff as BP7. Upvotes are this site's. The form never asks for a number. **Why:** the directory's promise is "every line comes from a public repo; nothing is self-reported."

When the repo goes private, is deleted, or is archived, the next refresh notices. A private or deleted repo takes the listing out of the directory (`state: "unavailable"`) until it comes back; an archived one shows "Archived".

### D4. What the lister writes

- **Slug:** 2–40 characters, a–z, 0–9 and single hyphens, with reserved words refused (`new`, `list`, `edit`, …).
- **Tagline:** up to 120 characters.
- **Category:** one of the directory's topics.
- **Stack tags:** up to six, suggested from the repo's languages.
- **Pitch** (LB5): up to 5,000 characters, in the posts' Markdown subset.
- **Live URL** (LB5): `https` only, shown as a plain link.
- **Cover image** (LB5): PNG, JPEG or WebP up to 2 MB, stored in R2.
- **Open roles** (LB3): title, type, description and commitment, each validated like the rest.

Nothing is stored as HTML.

### D5. Drafts, publishing and who sees what

A new listing is a **draft**. Only its maintainers see it, at `/builds/<slug>`, with a banner listing what's missing. It's **published** once it's verified and has a tagline and a category. The maintainer can unpublish it again. A draft holds its slug for 14 days; after that an unverified draft is deleted.

### D6. Maintainers

The lister is the first maintainer. Maintainers invite others by builder handle (LB4); an invite is accepted or declined by the invitee. Maintainers can edit the listing, manage roles and set the build's support links (BP4 already reads "maintainer" through `maintainsOf`; that now includes listings here). Only a builder with a profile can list or maintain, so every listing has a face. **Why:** raised hands and support links point at people, so the people should be real profiles.

### D7. Contributors come from the repo

A listing's contributors are read from GitHub's contributors API and matched to builders here by their GitHub login (LB4). Matched builders get the "Contributor · slug" badge and see the build in their projects, just as openproduct.live's `contributesToListings` does. **Why:** badges stay computed, never awarded (builder-profiles D1).

### D8. Orunbase is optional

A listing may link an Orunbase workspace (open question Q1). When it does, the build page shows "Fork & deploy on Orunbase"; when it doesn't, that panel is left out rather than pointing at a generic Orunbase page. **Why:** requiring Orunbase would keep out most public repos, and the owner hasn't asked for that. The default is reversible.

### D9. Moderation and limits

Anyone signed in can report a listing. Moderators hide and restore listings, just as with posts. An account can create three listings a day and hold at most ten drafts. **Why:** listings are public pages under this site's name.

## The data

- `listings` holds: slug (PK, NOCASE), repo `owner/name`, state (`draft` | `published` | `hidden` | `unavailable`), verified_at, verify_code, tagline, category, stack JSON, pitch, live_url, cover key, workspace ref, created_by, created_at, updated_at.
- `listing_maintainers`: (slug, account_id, role `owner` | `maintainer`, accepted_at).
- `listing_roles`: (id, slug, title, type, description, commitment, open).
- `listing_stats`: (slug, changes_7d, licence, last_commit_at, languages JSON, fetched_at). Cached GitHub reads.
- Reports reuse `reports`, with `target_kind = 'listing'`. Votes, follows and raised hands already key on slug.
