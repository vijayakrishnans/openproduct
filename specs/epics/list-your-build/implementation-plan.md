# list-your-build (LB): implementation plan

Each milestone is one task and one pull request, merged in order. Every one leaves the site working, and anything not yet built simply doesn't appear.

## LB0: the spec (OP-27)

This doc set.

**Done when:** merged.

## LB1: list and verify (OP-28)

- Migration: `listings`, `listing_maintainers`.
- `/list`: the form (repo, slug, tagline, category, stack tags). The repo is read from GitHub to check it's public and to suggest a slug and tags. Signed-out visitors go to sign in; anyone without a builder profile is asked to start one.
- Verification: the owner fast path (D2.1), else the `.openproduct` file with its code and a "Check again" button (D2.2).
- Drafts and publishing (D5); the draft banner lists what's missing.
- The directory merges listings from here (`source: "here"`); `/builds/<slug>` renders them. The slug namespace is checked against openproduct.live at create time (D1).
- "List your build" in the header, hero and How it works points to `/list`.
- Limits: three listings a day and ten drafts per account.

**Done when:** a builder signed in with GitHub lists a repo they own, it's verified in one click, and after publishing it shows in Open builds and at `/builds/<slug>`. A repo owned by someone else stays a draft until the `.openproduct` file is in place, and a private repo is refused.

## LB2: live from the repo (OP-29)

- `listing_stats`: changes in 7 days, licence, last commit and languages from GitHub, cached for an hour and refreshed on read, with BP7's backoff.
- Ranking, the pulse and cards use them. A private or deleted repo puts the listing in `unavailable` (out of the directory); an archived one shows "Archived".

**Done when:** a commit merged into a listed repo shows as a change on its card within the hour. Making the repo private takes the listing out of Open builds within the hour, and making it public again brings it back.

## LB3: open roles (OP-30)

- `listing_roles`; maintainers add, edit and close seats on the listing's edit page.
- Seats show on the build page, `/roles`, the home sidebar and the seat deep link; raising a hand works (OP-25).

**Done when:** a seat added to a listing here shows on `/roles` and in the home sidebar, and a builder can raise a hand for it.

## LB4: maintainers and contributors (OP-31)

- Invite a co-maintainer by handle, with accept and decline; remove one; at least one owner always remains.
- Contributors from GitHub's contributors API, matched to builders by GitHub login.
- `maintainsOf`, the badges, a builder's projects and build support links all count listings made here.

**Done when:** an invited builder accepts, and the build shows on their profile with "Maintains 1" and their support-link form. A builder whose PR is in the repo's contributors gets "Contributor · slug".

## LB5: the pitch, a cover and a live link (OP-32)

- An R2 bucket per environment for covers, served by a route that sets the content type itself. PNG, JPEG or WebP up to 2 MB, checked by magic bytes.
- The pitch (Markdown subset) and the live URL.
- The optional Orunbase workspace link and the "Fork & deploy" panel (D8, once Q1 is answered).

**Done when:** a listing shows its uploaded cover on its card and its pitch on its page, and a file that isn't an image is refused even when it's named `.png`.

## LB6: moderation and lifecycle (OP-33)

- Report a listing; moderators hide and restore it from the queue.
- Maintainers unpublish, delete, or rename a listing's slug. The old slug redirects for 30 days, and votes, follows and raised hands move with it.
- Unverified drafts are deleted after 14 days.
- A slug that openproduct.live later takes is renamed by its maintainers (D1).

**Done when:** a reported listing hidden by a moderator leaves Open builds and its page answers 404 to everyone else. A renamed listing keeps its upvotes, and its old address redirects.

## Sequencing

LB1 first: everything else edits a listing. LB2 can follow straight away, and is what makes a listing rank. LB3 and LB4 are independent of each other. LB5 needs an R2 bucket, which I can create, and the owner's answer to Q1 for its Orunbase part. LB6 last, once there's something to moderate.
