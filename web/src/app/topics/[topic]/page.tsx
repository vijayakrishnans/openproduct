import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TabBar } from "@/components/tab-bar";
import { TopicFeed, type FeedItem } from "@/components/topic-feed";
import { KindTabs, parseKindTab } from "@/components/kind-tabs";
import { POST_KIND } from "@/lib/post-kinds";
import { listArticles } from "@/lib/auth/articles";
import { listLocalThreads } from "@/lib/auth/discussions";
import { topicRow } from "@/lib/auth/topics";
import { recordTopicSearch, topicFollowState } from "@/lib/auth/topic-follows";
import { currentSession } from "@/lib/auth/request";
import { initials } from "@/lib/directory";
import { database } from "@/lib/server/env";
import { buildTopicMap, buildsInTopic, loadTopics } from "@/lib/server/topics-here";
import { MIN_RANKED, earnedLine, mostHelpful, topContributors } from "@/lib/auth/rankings";
import { Avatar } from "@/components/person-card";
import { normalizeTopic, topicLabel } from "@/lib/topics";

export const dynamic = "force-dynamic";

type Params = Promise<{ topic: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { topic } = await params;
  const slug = normalizeTopic(decodeURIComponent(topic));
  return { title: slug ? topicLabel(slug) : "Topic" };
}

/**
 * A topic (TC1): its writing and discussions, newest first, with its
 * builds in a side panel; kind tabs (TC2), following (TC4), and its top
 * contributors, most helpful writing and top builds (TC5).
 */
export default async function TopicPage({ params, searchParams }: { params: Params; searchParams: Promise<{ kind?: string; from?: string }> }) {
  const { topic } = await params;
  const sp = await searchParams;
  const tab = parseKindTab(sp.kind, true);
  const slug = normalizeTopic(decodeURIComponent(topic));
  if (!slug) notFound();
  // "next-js" and "#NextJS" land on the one topic page.
  if (slug !== topic) redirect(`/topics/${slug}${sp.from === "search" ? "?from=search" : ""}`);

  const [db, session, { topics, builds }] = await Promise.all([database(), currentSession(), loadTopics()]);
  const me = session?.account.id ?? null;
  const [row, posts, threads, follow] = db
    ? await Promise.all([
        topicRow(db, slug).catch(() => null),
        listArticles(db, { topic: slug, limit: 30 }).catch(() => []),
        listLocalThreads(db, "latest", null, 30, slug).catch(() => []),
        topicFollowState(db, slug, me).catch(() => ({ count: 0, mine: false })),
      ])
    : [null, [], [], { count: 0, mine: false }];
  // TC5: rankings, each with its formula on the page.
  const [contributors, helpful] = db
    ? await Promise.all([
        topContributors(db, slug, { buildTopics: buildTopicMap(builds) }).catch(() => []),
        mostHelpful(db, slug).catch(() => []),
      ])
    : [[], []];
  if (row?.hidden) notFound();
  const summary = topics.find((t) => t.slug === slug);
  const inTopic = buildsInTopic(builds, slug);
  if (!summary && !posts.length && !threads.length && !inTopic.length) notFound();
  const label = summary?.label ?? row?.label ?? topicLabel(slug);
  // TC4 (D5): a search that landed here counts once for today; who searched is not kept.
  if (db && sp.from === "search") await recordTopicSearch(db, slug).catch(() => undefined);

  const all: FeedItem[] = [
    ...posts.map((p) => ({ kind: "post" as const, at: p.createdAt, post: p })),
    ...threads.map((t) => ({ kind: "thread" as const, at: t.lastPostAt ?? t.createdAt, thread: t })),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  // TC2: one tab per kind of writing, plus discussions.
  const counts: Record<string, number> = { all: all.length, discussions: threads.length };
  for (const p of posts) counts[p.kind] = (counts[p.kind] ?? 0) + 1;
  const feed = all.filter((i) => !tab || (tab === "discussions" ? i.kind === "thread" : i.kind === "post" && i.post.kind === tab));

  return (
    <>
      <SiteHeader current="/topics" />
      <main className="wrap section">
        <Link className="link" href="/topics">← Topics</Link>
        <div className="topic-head">
          <div>
            <h1>#{label}</h1>
            <p className="sub">
              {all.length} {all.length === 1 ? "piece of writing" : "pieces of writing"} · {inTopic.length} {inTopic.length === 1 ? "build" : "builds"} · {follow.count}{" "}
              {follow.count === 1 ? "follower" : "followers"}
            </p>
          </div>
          <div className="topic-acts">
            <form method="post" action="/act" className="act-form">
              <input type="hidden" name="action" value="follow" />
              <input type="hidden" name="kind" value="topic" />
              <input type="hidden" name="key" value={slug} />
              <input type="hidden" name="next" value={`/topics/${slug}`} />
              <button type="submit" className={`btn btn-ghost${follow.mine ? " is-on" : ""}`}>{follow.mine ? "✓ Following" : `Follow #${label}`}</button>
            </form>
            <Link className="btn btn-dark" href={`/posts/new?topics=${slug}`}>Write about {label}</Link>
            <Link className="btn btn-ghost" href={`/community/new?topic=${slug}`}>Start a discussion</Link>
          </div>
        </div>

        <div className="topic-cols">
          <section className="topic-main" aria-label="Writing">
            <KindTabs base={`/topics/${slug}`} current={tab} discussions counts={counts} />
            {feed.length ? (
              <TopicFeed items={feed} />
            ) : (
              <div className="forum-empty">
                <strong>{tab ? `No ${tab === "discussions" ? "discussions" : POST_KIND[tab].plural.toLowerCase()} on ${label} yet.` : `Nothing written about ${label} yet.`}</strong>
                <p>A tutorial, a build log or a question: the first one starts this topic.</p>
                <Link className="btn btn-ghost" href={`/posts/new?topics=${slug}`}>Write the first post</Link>
              </div>
            )}
          </section>
          <aside className="topic-side">
            <div className="side-box">
              <h2>Top contributors</h2>
              {contributors.length ? (
                <ol className={`rank-list${contributors.length >= MIN_RANKED ? "" : " unranked"}`}>
                  {contributors.map((c, i) => (
                    <li key={c.accountId}>
                      {contributors.length >= MIN_RANKED ? <span className="rank mono">#{i + 1}</span> : null}
                      <Link className="rank-who" href={`/builders/${encodeURIComponent(c.handle)}`}>
                        <Avatar handle={c.handle} size={26} />
                        <span className="rank-text">
                          <strong>{c.name}</strong>
                          <span>{earnedLine(c)}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="muted">Nobody yet. Write about {label}, or answer an issue in it.</p>
              )}
              <p className="formula rank-formula">
                3 × writing + helpful votes + 5 × solutions + 5 × merged PRs to builds in the topic, 90 days.
                {contributors.length && contributors.length < MIN_RANKED ? ` Places show from ${MIN_RANKED} contributors.` : ""}
              </p>
            </div>
            {helpful.length ? (
              <div className="side-box">
                <h2>Most helpful</h2>
                <ol className={`rank-list${helpful.length >= MIN_RANKED ? "" : " unranked"}`}>
                  {helpful.map((h, i) => (
                    <li key={h.id}>
                      {helpful.length >= MIN_RANKED ? <span className="rank mono">#{i + 1}</span> : null}
                      <Link className="rank-who" href={h.href}>
                        <span className="rank-text">
                          <strong>{h.kind === "post" ? `Reply in “${h.title}”` : h.title}</strong>
                          <span>
                            {h.name} · ▲ {h.votes}
                            {h.solution ? " · ✓ solution" : ""}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
                <p className="formula rank-formula">Helpful votes, plus 5 for an accepted solution.</p>
              </div>
            ) : null}
            <div className="side-box">
              <div className="side-head">
                <h2>Top builds</h2>
                {inTopic.length > 6 ? <Link className="link" href={`/?q=${encodeURIComponent(slug.replace(/-/g, " "))}#builds`}>All {inTopic.length}</Link> : null}
              </div>
              {inTopic.length ? (
                <div className="side-roles">
                  {inTopic.slice(0, 6).map((b, i) => (
                    <Link key={b.slug} className="side-role" href={`/builds/${b.slug}`}>
                      {inTopic.length >= MIN_RANKED ? <span className="rank mono">#{i + 1}</span> : null}
                      <span className="pulse-tile mono" aria-hidden>{initials(b.slug)}</span>
                      <span className="side-role-text">
                        <strong>{b.slug}</strong>
                        <span>{b.changes7d} changes · ⌃ {b.upvotes}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="muted">No build lists this topic yet.</p>
              )}
              {inTopic.length ? <p className="formula rank-formula">Most active = (changes + 1) × (upvotes + 1), 7 days.</p> : null}
            </div>
          </aside>
        </div>
      </main>
      <SiteFooter />
      <TabBar current="/topics" />
    </>
  );
}
