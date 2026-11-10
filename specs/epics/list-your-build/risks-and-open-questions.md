# list-your-build (LB): risks and open questions

## Risks

**R1. Someone lists a repo that isn't theirs.** Mitigation: nothing is published unverified (D2, D5). Verification is the repo owner's GitHub login or a file only someone with write access can add. A draft holds its slug for 14 days at most.

**R2. Spam and slug squatting.** Mitigation: a builder profile is needed to list; three listings a day and ten drafts per account; reports and hiding (LB6); unverified drafts expire.

**R3. GitHub rate limits.** Every listing's numbers come from GitHub. Mitigation: hourly cache per listing, refresh on read only when stale, BP7's 15-minute backoff, `GITHUB_TOKEN` if set. A failed read keeps the last good numbers.

**R4. Cover images as an attack surface.** Mitigation: three formats checked by magic bytes, 2 MB, served by a route that sets `Content-Type` and `X-Content-Type-Options: nosniff`, and never SVG. Images can be reported like anything else.

**R5. Two directories disagree.** A slug could exist here and later on openproduct.live. Mitigation: openproduct.live's wins on the shared address, and the listing here keeps working under `?from=here` until its maintainers rename it (D1, LB6).

**R6. A repo changes hands.** Whoever verified a listing may lose access to the repo later. Mitigation: re-verification on the listing's yearly anniversary, and on any change of the repo's owner seen by the hourly refresh. Until re-verified, the listing stays up but can't be edited.

## Open questions

**Q1. Must a listing be an Orunbase workspace?** The site says "Every build is a public repo and a public workspace on Orunbase". Requiring it would keep listings to Orunbase users and let the "Fork & deploy" button always work. **Default: no.** A workspace link is optional, and the button shows only when there is one (D8). Needed from the owner before LB5's Orunbase part.

**Q2. Should listings made here also reach openproduct.live?** **Default: no.** The owner asked that this site not depend on or send people to openproduct.live (OP-25), and writing to its API would need its owners' agreement.

**Q3. Who may list?** **Default: any signed-in builder with a profile** (D6). A stricter rule, such as GitHub sign-in only, would make the owner fast path the only path and drop the verification file.
