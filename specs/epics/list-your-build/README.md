# Epic: list-your-build (LB)

**Anyone with a public GitHub repo can list their build on this site in a few minutes, without going anywhere else. They prove they control the repo, write a tagline, pick a category and open a few seats. The listing then sits in Open builds next to openproduct.live's, ranked by the same formula. Its activity is read from the repo, not typed in, so a listing here is as honest as one from there.**

Today "List your build" sends people to Orunbase, and every build on this site comes from openproduct.live's API. The site can show builds but can't take one. This epic adds listings stored here, using the accounts, database and moderation that builder-profiles built.

## Status

| Field | Value |
|-------|-------|
| Status | 📝 Proposed |
| Cluster | **LB** (LB0–LB6) · Orunbase epic **EP-2** `list-your-build` · tasks OP-27–OP-33 |
| Owner(s) | `web/` here. openproduct.live is not changed and is not written to. |
| Builds on | builder-profiles (accounts, D1, builder profiles, support links, moderation, merged-PR reads from GitHub) and OP-25 (votes, follows, raised hands) |
| Decisions locked | (1) A listing is a **public GitHub repo** whose control the lister has proved. (2) Listings are stored **here** and shown **with** openproduct.live's, in one slug namespace. (3) Numbers on a listing (changes, licence, last commit) come **from the repo**, never from a form. (4) A listing is a draft, seen only by its maintainers, until it's verified and has a tagline and a category. |
| Open | Q1: must a listing also be an Orunbase workspace? Default: no, it's optional and adds the "Fork & deploy" button (see risks). |
| Gate | LB1 (list and verify) comes before anything else. |

## Read order

1. `design.md`: the model, the decisions, and the alternatives we rejected
2. `implementation-plan.md`: the milestones and what "done" means for each
3. `risks-and-open-questions.md`: what could go wrong, and what still needs the owner
4. `IMPLEMENTATION-STATUS.md`: what actually shipped

## Milestones at a glance

| Milestone | What it lands | Done when |
|---|---|---|
| LB0: the spec | this doc set | merged |
| LB1: list and verify | the "List your build" form, repo verification, drafts, publishing; listings appear in Open builds and at `/builds/<slug>` | a builder lists a repo they own, verifies it, and sees it in Open builds and on its own page |
| LB2: live from the repo | changes in the last 7 days, licence, last commit and languages read from GitHub and cached; ranking uses them; a repo that goes private or disappears takes its listing down | a commit merged into the repo shows as a change on its card within the hour |
| LB3: open roles | maintainers add, edit and close seats; they show on `/roles`, the home sidebar and the build page; raising a hand works | a seat added to a listing here shows on `/roles` and a builder can raise a hand for it |
| LB4: maintainers and contributors | invite co-maintainers by handle; contributors read from the repo; badges, projects and support links count listings made here | an invited builder accepts, and the build shows on their profile with "Maintains 1" |
| LB5: the pitch, a cover and a live link | a longer pitch, a cover image stored in R2, and a live URL | a listing shows its uploaded cover on its card and its pitch on its page |
| LB6: moderation and lifecycle | report and hide a listing, delist or delete it, change its slug safely | a reported listing hidden by a moderator leaves Open builds and its page answers 404 to everyone else |
