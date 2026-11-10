# topics-and-community (TC): implementation plan

Each milestone is one task and one pull request, merged in order. Demo data for every milestone goes onto stage and prod, so the owner can see each one with a demo account.

## TC0: the spec (OP-38)

This doc set.

**Done when:** merged.

## TC1: topics as tags (OP-39)

- `topics` and `content_topics`; topic parsing and aliases (D1); a topic picker (up to five) on the post and discussion forms.
- `/topics/<topic>` shows the topic's writing and discussions, newest first, with its builds (category or stack) in a side panel. A topic page appears once two pieces of writing carry it.
- `/topics` lists topics by activity this week. Topic chips appear on posts, threads and build pages.

**Done when:** a tutorial tagged `cloudflare-workers` shows on that topic's page, the topic is on the index, and its builds are in the side panel.

## TC2: kinds of writing (OP-40)

- A kind on posts: blog, tutorial, doc, baseline, launch. Each kind's own fields (D2) are on the write form and shown on the post.
- Kind tabs on topic pages, and on `/posts`.

**Done when:** a topic page's Tutorials tab lists only tutorials, and a baseline post shows its repo and "Use this baseline".

## TC3: Community as the public square (OP-41)

- A kind on discussions: discussion or issue. The issue's author marks a reply as the solution; the thread shows "Solved" with the answer first.
- `/community` in sections: Issues (open), Solved, New ways (tutorials and blogs), Launches, Discussions. Each section has "See all".

**Done when:** an issue's author marks a reply as the solution, and the issue moves from Issues to Solved with that reply on top.

## TC4: personal topics (OP-42)

- Follow a topic (reusing `follows`). Topics gets "Your topics" and a "For you" feed of their latest writing; signed-out visitors see Trending and All.
- Searches that land on a topic are counted per day (D5), and Trending uses them (D4), with its formula on the page.

**Done when:** after following two topics, For you shows only their writing, newest first; a topic searched for often climbs Trending.

## TC5: rankings (OP-43)

- "Helpful" on posts and replies, one per account; an accepted solution counts as 5.
- Top contributors per topic (90 days), and top builds per topic, each showing what earned the place (D4). They also appear as a "Known for" line on builder profiles.

**Done when:** a topic page names its top three contributors, each with what earned the place, and the formula is on the page.

## Sequencing

TC1 first: everything else hangs off topics. TC2 and TC3 are independent of each other. TC4 needs TC1's topics. TC5 needs TC2's kinds and TC3's solutions to have something to count.
