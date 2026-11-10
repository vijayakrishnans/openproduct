import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TabBar } from "@/components/tab-bar";
import { loadTopics, type TopicSummary } from "@/lib/server/topics-here";

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
      {t.thisWeek ? <span className="topic-week">+{t.thisWeek} this week</span> : null}
    </Link>
  );
}

/** Topics (TC1): what builders write about, trending first. */
export default async function TopicsPage() {
  const { topics } = await loadTopics();
  const trending = [...topics].filter((t) => t.thisWeek > 0).sort((a, b) => b.thisWeek - a.thisWeek || b.writing - a.writing).slice(0, 6);
  const all = [...topics].sort((a, b) => b.writing * 3 + b.builds - (a.writing * 3 + a.builds) || a.label.localeCompare(b.label));
  return (
    <>
      <SiteHeader current="/topics" />
      <main className="wrap section">
        <div className="section-head">
          <h1 style={{ margin: 0, fontSize: 34, letterSpacing: "-0.02em" }}>Topics</h1>
          <span className="sub">What builders write about: tutorials, build logs and discussions, with the builds in each topic.</span>
        </div>
        {trending.length ? (
          <section className="topics-block" aria-labelledby="trending-h">
            <h2 id="trending-h">Trending this week</h2>
            <p className="formula">Ranked by new writing on the topic in the last 7 days.</p>
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
