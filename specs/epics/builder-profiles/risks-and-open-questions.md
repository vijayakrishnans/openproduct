# builder-profiles (BP): risks and open questions

## Risks

**R1. Support links used for phishing or scams.** Mitigation: the host allowlist (D5), HTTPS only, the provider derived on the server, and the existing report flow on profiles.

**R2. Embedded video as an attack surface or a tracker.** Mitigation: only YouTube, Vimeo and Loom, stored as an id, embedded through the privacy-enhanced YouTube host, in a sandboxed iframe that loads lazily. A page with no post loads no third-party script.

**R3. Badges read as a ranking of people.** Mitigation: no scores, tiers capped at 10, no badge leaderboard, and every badge names what it was computed from (D1, D2).

**R4. Starter threads read as astroturfing.** Mitigation: they're posted under the repo owner's real account, written as genuine questions, with no fake replies.

**R6. Account takeover.** Mitigation: no merging of accounts by email (D9), state and PKCE on every OAuth flow, hashed session tokens, origin checks on every write, and claims proved by GitHub, never by a typed name.

**R7. Provider setup blocks launch.** Each provider needs credentials only the owner can create. Mitigation: a provider without secrets is hidden (D12), so BP2 ships with whichever of GitHub, Google and Orunbase are ready.

**R8. Apple and email need a domain.** Apple verifies the return address and email needs a sending domain; `workers.dev` works for neither. Mitigation: they're their own milestone (BP3), after a domain is chosen.

**R5. The core outage on 2026-11-09 (database unreachable).** New read paths fail the same way existing ones did. This site already shows an "unreachable" state instead of an empty profile. Keep that for every new section.

## Open questions, with defaults

**Q1. Should editing move to this site?** Answered 2026-11-09: yes, everything is built here (D4).

**Q5. Which domain does the site move to?** Needed for BP3. Default: stay on `workers.dev` until the owner picks one.

**Q6. Can someone without a GitHub link on openproduct.live claim their profile?** Default: not yet; they add the link there first (D10).

**Q2. More video providers (Twitch, Bilibili, PeerTube)?** Default: not now. Each one is a single line in the allowlist once someone asks for it.

**Q3. Can a post be about someone else's build?** Default: yes, if the build is public. It shows on the author's page, and the build page shows it under "Written about this build".

**Q4. Merged-PR identity: GitHub login or openproduct handle?** Default: count only builders signed in with GitHub (BP7). Anyone else gets no badge, not zero.
