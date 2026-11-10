# Epic: topics-and-community (TC)

**Topics become where you learn, and Community becomes where everyone talks. A topic such as `cloudflare-workers`, `auth` or `pricing` is a living page of what builders have written about it: blogs, tutorials, docs, baselines and discussions, with the people best at it and the builds that lead it. You follow topics, and they shape your own feed, like following interests on Instagram. Community is the public square: issues and their solutions, new ways of doing things, and launches, open to everyone and ranked for everyone.**

Today a topic is only a build category (one per build, from openproduct.live), and opening one lists builds. Community has discussions and a "From the builders" row of posts. This epic turns topics into tags that writing carries, adds the kinds of writing the owner asked for, and adds rankings for posts, contributors and builds, each with its formula shown.

## Status

| Field | Value |
|-------|-------|
| Status | 📝 Proposed |
| Cluster | **TC** (TC0–TC5) · Orunbase epic **EP-3** `topics-and-community` · tasks OP-38–OP-43 |
| Owner(s) | `web/` here. openproduct.live is not changed. |
| Builds on | builder-profiles (posts, discussions, moderation, badges, BP7's merged PRs), list-your-build (listings and their stats), OP-25 (follows), OP-37 (search) |
| Decisions locked | (1) A **topic is a tag**: lowercase words joined by hyphens. Anyone creates one by using it, and build categories and stacks seed the first ones. (2) Posts and discussions carry **one to five topics**. (3) Writing comes in **kinds**: blog, tutorial, doc, baseline, launch; discussions are discussion or issue, and an issue can be **solved** by a reply. (4) **Topics are personal** (follow them, a "For you" feed); **Community is public** (one square for everyone, sorted by kind). (5) Every ranking shows its formula, and **no ranking counts anything bought or self-reported**. |
| Open | Q1: may anyone start a topic, or only pick from a list? Default: anyone; a topic page appears once two pieces of writing use it, and moderators can merge or hide topics. Q2: what's a "baseline" post? Default: a starter template others can copy, with its repo link and "Use this baseline" pointing at Orunbase. |
| Gate | TC1 (topics as tags) comes before everything else. |

## Read order

1. `design.md`: the model, the rankings, and the alternatives we rejected
2. `implementation-plan.md`: the milestones and what "done" means for each
3. `risks-and-open-questions.md`
4. `IMPLEMENTATION-STATUS.md`

## Milestones at a glance

| Milestone | What it lands | Done when |
|---|---|---|
| TC0: the spec | this doc set | merged |
| TC1: topics as tags | writing and discussions carry topics; a topic's page shows its writing, newest first, with its builds moved to a side panel; the topics index lists topics by activity | a tutorial tagged `cloudflare-workers` shows on that topic's page, and the topic is on the index |
| TC2: kinds of writing | tutorials, docs, baselines and launches beside blogs, each with what it needs (steps, a repo, "Use this baseline"); kind tabs on topic pages | a topic page's Tutorials tab lists only tutorials, and a baseline shows "Use this baseline" |
| TC3: Community as the public square | issues with a solution a reply can be, and Community in sections: Issues, Solved, New ways, Launches, Discussions | an issue's author marks a reply as the solution, and it moves to Solved with the answer on top |
| TC4: personal topics | follow topics, a "For you" feed on Topics, and trending topics ranked by searches, new writing and follows this week | after following two topics, For you shows only their writing, newest first; a topic searched for often climbs Trending |
| TC5: rankings | "Helpful" votes on writing and replies; top contributors per topic, and top builds per topic, each with its formula | a topic page names its top three contributors, each with what earned them the place |
