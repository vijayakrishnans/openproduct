import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TabBar } from "@/components/tab-bar";
import { TopicFeed, type FeedItem } from "@/components/topic-feed";
import { listArticles } from "@/lib/auth/articles";
import { listLocalThreads } from "@/lib/auth/discussions";
import { currentSession } from "@/lib/auth/request";
import { followedTopics } from "@/lib/auth/topic-follows";
import { database } from "@/lib/server/env";
import { loadTopics, type TopicSummary } from "@/lib/server/topics-here";
import { topicLabel } from "@/lib/topics";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Topics",
  description: "What builders write about: tutorials, build logs and discussions by topic, with the builds in each.",
};

function TopicCard({ t, rank }: { t: TopicSummary; rank?: number }) {
  return (
    <Link href={`/topics/${t.slug}`} className="topic-card">
      <strong>
        {rank ? <span className="topic-rank mono">#{rank}</span> : null}
        {t.label}
      </strong>
      <span className="mono muted">
        {t.writing} {t.writing === 1 ? "piece of writing" : "pieces of writing"} · {t.builds} {t.builds === 1 ? "build" : "builds"}
      </span>
      {t.thisWeek || t.searches || t.newFollows ? (
        <span className="topic-week">
          {[t.thisWeek ? `+${t.thisWeek} written` : "", t.searches ? `${t.searches} ${t.searches === 1 ? "search" : "searches"}` : "", t.newFollows ? `+${t.newFollows} ${t.newFollows === 1 ? "follower" : "followers"}` : ""].filter(Boolean).join(" · ")} this week
        </span>
      ) : null}
    </Link>
  );
}

/** The newest writing and discussions in the topics someone follows (TC4). */
async function forYou(followed: string[]): Promise<FeedItem[]> {
  const db = await database();
  if (!db || !followed.length) return [];
  const [posts, threads] = await Promise.all([
    listArticles(db, { topics: followed, limit: 20 }).catch(() => []),
    listLocalThreads(db, "latest", null, 20, undefined, { topics: followed }).catch(() => []),
  ]);
  return [
    ...posts.map((p) => ({ kind: "post" as const, at: p.createdAt, post: p })),
    ...threads.map((t) => ({ kind: "thread" as const, at: t.createdAt, thread: t })),
  ]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 20);
}

/**
 * Topics: what builders write about. Signed in, the topics you follow and
 * their newest writing come first (TC4); Trending is for everyone.
 */
export default async function TopicsPage() {
  const [{ topics }, session, db] = await Promise.all([loadTopics(), currentSession(), database()]);
  const followed = session && db ? await followedTopics(db, session.account.id).catch(() => []) : [];
  const feed = await forYou(followed);
  const mine = followed.map((slug) => topics.find((t) => t.slug === slug) ?? { slug, label: topicLabel(slug), writing: 0, thisWeek: 0, builds: 0, searches: 0, newFollows: 0, score: 0 });
  // Trending (D4): searches + 3 × new writing + 5 × new follows, last 7 days.
  const trending = [...topics].filter((t) => t.score > 0).sort((a, b) => b.score - a.score || b.writing - a.writing).slice(0, 6);
  const all = [...topics].sort((a, b) => b.writing * 3 + b.builds - (a.writing * 3 + a.builds) || a.label.localeCompare(b.label));
  return (
    <>
      <SiteHeader current="/topics" />
      <main className="wrap section">
        <div className="section-head">
          <h1 style={{ margin: 0, fontSize: 34, letterSpacing: "-0.02em" }}>Topics</h1>
          <span className="sub">What builders write about: tutorials, build logs and discussions, with the builds in each topic.</span>
        </div>
        {session ? (
          <section className="topics-block" aria-labelledby="yours-h">
            <h2 id="yours-h">Your topics</h2>
            {mine.length ? (
              <>
                <div className="topic-grid">{mine.map((t) => <TopicCard key={t.slug} t={t} />)}</div>
                <h3 className="for-you-h">For you</h3>
                <p className="formula">The newest writing and discussions in the topics you follow.</p>
                {feed.length ? <TopicFeed items={feed} /> : <div className="unreachable">Nothing written in your topics yet.</div>}
              </>
            ) : (
              <div className="unreachable">Follow a topic and its newest writing shows up here. Open any topic below and press Follow.</div>
            )}
          </section>
        ) : null}
        {trending.length ? (
          <section className="topics-block" aria-labelledby="trending-h">
            <h2 id="trending-h">Trending this week</h2>
            <p className="formula">Trending = searches + 3 × new writing + 5 × new follows, last 7 days.</p>
            <div className="topic-grid">{trending.map((t, i) => <TopicCard key={t.slug} t={t} rank={i + 1} />)}</div>
          </section>
        ) : null}
        <section className="topics-block" aria-labelledby="all-h">
          <h2 id="all-h">All topics</h2>
          {all.length ? (
            <div className="topic-grid">{all.map((t) => <TopicCard key={t.slug} t={t} />)}</div>
          ) : (
            <div className="unreachable">No topics yet. Give your next post a topic and it starts here.</div>
          )}
        </section>
      </main>
      <SiteFooter />
      <TabBar current="/topics" />
    </>
  );
}
