import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TabBar } from "@/components/tab-bar";
import { TopicFeed, type FeedItem } from "@/components/topic-feed";
import { listArticles } from "@/lib/auth/articles";
import { listLocalThreads } from "@/lib/auth/discussions";
import { topicRow } from "@/lib/auth/topics";
import { initials } from "@/lib/directory";
import { database } from "@/lib/server/env";
import { buildsInTopic, loadTopics } from "@/lib/server/topics-here";
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
 * builds in a side panel. Kind tabs come in TC2, contributors in TC5.
 */
export default async function TopicPage({ params }: { params: Params }) {
  const { topic } = await params;
  const slug = normalizeTopic(decodeURIComponent(topic));
  if (!slug) notFound();
  // "next-js" and "#NextJS" land on the one topic page.
  if (slug !== topic) redirect(`/topics/${slug}`);

  const [db, { topics, builds }] = await Promise.all([database(), loadTopics()]);
  const [row, posts, threads] = db
    ? await Promise.all([
        topicRow(db, slug).catch(() => null),
        listArticles(db, { topic: slug, limit: 30 }).catch(() => []),
        listLocalThreads(db, "latest", null, 30, slug).catch(() => []),
      ])
    : [null, [], []];
  if (row?.hidden) notFound();
  const summary = topics.find((t) => t.slug === slug);
  const inTopic = buildsInTopic(builds, slug);
  if (!summary && !posts.length && !threads.length && !inTopic.length) notFound();
  const label = summary?.label ?? row?.label ?? topicLabel(slug);

  const feed: FeedItem[] = [
    ...posts.map((p) => ({ kind: "post" as const, at: p.createdAt, post: p })),
    ...threads.map((t) => ({ kind: "thread" as const, at: t.lastPostAt ?? t.createdAt, thread: t })),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  return (
    <>
      <SiteHeader current="/topics" />
      <main className="wrap section">
        <Link className="link" href="/topics">← Topics</Link>
        <div className="topic-head">
          <div>
            <h1>#{label}</h1>
            <p className="sub">
              {feed.length} {feed.length === 1 ? "piece of writing" : "pieces of writing"} · {inTopic.length} {inTopic.length === 1 ? "build" : "builds"}
            </p>
          </div>
          <div className="topic-acts">
            <Link className="btn btn-dark" href={`/posts/new?topics=${slug}`}>Write about {label}</Link>
            <Link className="btn btn-ghost" href={`/community/new?topic=${slug}`}>Start a discussion</Link>
          </div>
        </div>

        <div className="topic-cols">
          <section className="topic-main" aria-label="Writing">
            {feed.length ? (
              <TopicFeed items={feed} />
            ) : (
              <div className="forum-empty">
                <strong>Nothing written about {label} yet.</strong>
                <p>A tutorial, a build log or a question: the first one starts this topic.</p>
                <Link className="btn btn-ghost" href={`/posts/new?topics=${slug}`}>Write the first post</Link>
              </div>
            )}
          </section>
          <aside className="topic-side">
            <div className="side-box">
              <div className="side-head">
                <h2>Builds</h2>
                {inTopic.length > 6 ? <Link className="link" href={`/?q=${encodeURIComponent(slug.replace(/-/g, " "))}#builds`}>All {inTopic.length}</Link> : null}
              </div>
              {inTopic.length ? (
                <div className="side-roles">
                  {inTopic.slice(0, 6).map((b) => (
                    <Link key={b.slug} className="side-role" href={`/builds/${b.slug}`}>
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
            </div>
          </aside>
        </div>
      </main>
      <SiteFooter />
      <TabBar current="/topics" />
    </>
  );
}
