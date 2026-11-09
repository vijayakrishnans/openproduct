# builder-profiles (BP): risks and open questions

## Risks

**R1. Support links used for phishing or scams.** Mitigation: the host allowlist (D5), HTTPS only, the provider derived on the server, and the existing report flow on profiles.

**R2. Embedded video as an attack surface or a tracker.** Mitigation: only YouTube, Vimeo and Loom, stored as an id, embedded through the privacy-enhanced YouTube host, in a sandboxed iframe that loads lazily. A page with no post loads no third-party script.

**R3. Badges read as a ranking of people.** Mitigation: no scores, tiers capped at 10, no badge leaderboard, and every badge names what it was computed from (D1, D2).

**R4. Starter threads read as astroturfing.** Mitigation: they're posted under the repo owner's real account, written as genuine questions, with no fake replies.

**R5. The core outage on 2026-11-09 (database unreachable).** New read paths fail the same way existing ones did. This site already shows an "unreachable" state instead of an empty profile. Keep that for every new section.

## Open questions, with defaults

**Q1. Should editing move to this site?** Default: no, until this site becomes openproduct.live (D4).

**Q2. More video providers (Twitch, Bilibili, PeerTube)?** Default: not now. Each one is a single line in the allowlist once someone asks for it.

**Q3. Can a post be about someone else's build?** Default: yes, if the build is public. It shows on the author's page, and the build page shows it under "Written about this build".

**Q4. Merged-PR identity: GitHub login or openproduct handle?** Default: count only builders who have linked their GitHub URL. An unlinked builder gets null, not zero.
