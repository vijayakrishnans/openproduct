# topics-and-community (TC): design

## Where things stand

- A **topic** is a build's category (`productivity`, `dev-tools`, …), one per build, read from openproduct.live. `/topics` lists categories with build counts; `/topics/<topic>` lists builds.
- **Community** has discussions (six tags: design, proposal, question, governance, contributing, accessibility) from here and openproduct.live, and a row of the latest builder posts.
- **Builder posts** (BP6) are blogs with an optional video. There are no tutorials, docs, baselines or launches, and nothing ranks writing or people.

## Decisions

### D1. A topic is a tag that writing carries

A topic is `lowercase-words-with-hyphens`, 2–32 characters. Posts (BP6) and discussions (BP5) carry one to five. Typing `#Cloudflare Workers` or `cloudflare-workers` gives the same topic, and a short alias list folds obvious twins (`nextjs` and `next-js`, `cf-workers` and `cloudflare-workers`). Build categories and listing stacks seed the first topics, so builds still appear under them. **Why:** the owner wants topics to hold "blogs … tutorials, documents, baselines to discuss", not apps. Tags are how writing finds its readers, and they grow with the community instead of from a fixed list.

**Alternative rejected: a fixed, curated list of topics.** It keeps things tidy, but every new tool or idea waits for someone to add it, and topics stop reflecting what builders actually write about.

### D2. Kinds of writing

| Kind | What it is | What it adds |
|---|---|---|
| Blog | a build log, a lesson, an opinion | (as BP6) |
| Tutorial | how to do one thing, step by step | numbered steps are encouraged; "time to complete" |
| Doc | reference others will come back to | a "last reviewed" date the author bumps |
| Baseline | a starter others can copy | a repo link (required) and "Use this baseline" (to Orunbase) |
| Launch | "we shipped this" | the build it launches (required, one of theirs) |

Discussions gain a kind too: **discussion** (as now) or **issue** (something is broken or unclear). An issue's author can mark one reply as **the solution**; the thread shows "Solved" and puts the answer first.

### D3. Topics are personal; Community is public

**Topics** (`/topics`):

- **Trending:** this week's most active topics.
- **Your topics:** the ones you follow.
- **For you:** the latest writing in your topics.
- **All topics:** everything, by activity.

A topic page has tabs by kind (All, Tutorials, Blogs, Docs, Baselines, Discussions), its top contributors, and its top builds.

**Community** (`/community`) is the same for everyone. It has sections: **Issues** (open), **Solved**, **New ways** (tutorials and blogs), **Launches**, and **Discussions**. **Why:** the owner's line: "topics … is more personal like Instagram, community is more like public."

### D4. Rankings, each with its formula on the page

- **Trending topic** (7 days) = searches that land on it + 3 × new writing + 5 × new follows. Searches are counted per topic per day, never per person.
- **Helpful post or reply** = helpful votes, one per account. An accepted solution counts as 5.
- **Top contributor in a topic** (90 days) = 3 × writing in the topic + helpful votes on it + 5 × accepted solutions + 5 × merged PRs to builds in the topic (BP7). Each contributor shows what earned the place: "4 tutorials, 2 solutions".
- **Top build in a topic** = the directory's "Most active", limited to builds in the topic.

Nobody can buy, set or award a place. Ties go to the earliest. A ranking needs at least three entries before it shows; until then the page lists them unranked. **Why:** "there should be some rankings for products and contributors", and builder-profiles D1: a number people can't check is decoration.

### D5. Search feeds topics

The header search (OP-11) and the Open builds search (OP-37) also match topics. Each search that lands on a topic page counts toward Trending (D4). Nothing about who searched is stored.

### D6. Moderation reaches topics

Moderators can hide a topic (its page goes, its writing stays) or merge one into another. Topics with fewer than two pieces of visible writing don't get a page.

**Alternative rejected: one feed with filters instead of separate Topics and Community.** It's simpler to build, but it loses the difference the owner asked for: a personal place to follow and learn, and a public place to raise issues and launches.

## The data

- `topics`: slug (PK), label, created_at, hidden, merged_into.
- `content_topics`: (content_kind `article`|`thread`, content_id, topic). Indexed by topic.
- `articles` gains `kind` (default `blog`), `repo_url`, `build_slug` (exists), `reviewed_at`, `minutes`. `threads` gains `kind` (default `discussion`), `solution_post_id`.
- `helpful`: (account_id, target_kind, target_id). `topic_follows`: reuses `follows` with kind `topic`. `topic_searches`: (topic, day, count).
