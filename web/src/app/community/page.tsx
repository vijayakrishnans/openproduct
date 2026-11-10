import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TabBar } from "@/components/tab-bar";
import { ThreadRow, TrendingRow } from "@/components/thread-row";
import { ArticleCard } from "@/components/article-card";
import { listArticles, type Article } from "@/lib/auth/articles";
import { listLocalThreads } from "@/lib/auth/discussions";
import { FORUM_ORDERS, TAG_LABELS, THREAD_TAGS, loadThreads, mergeThreads, parseOrder, parseTag, type ForumOrder, type Thread, type ThreadTag } from "@/lib/forum";
import { COMMUNITY, type CommunityChannel } from "@/lib/links";
import { database } from "@/lib/server/env";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Community",
  description: "Discussions between builders, threads about the builds on openproduct, and where builders talk: Discord, Reddit, YouTube and X.",
};

type Search = Promise<{ order?: string; tag?: string }>;

/** A small mark per channel, in the channel's own colour. */
const MARK: Record<CommunityChannel["key"], { glyph: string; bg: string }> = {
  discord: { glyph: "D", bg: "#5865F2" },
  reddit: { glyph: "r/", bg: "#FF4500" },
  youtube: { glyph: "▶", bg: "#FF0000" },
  x: { glyph: "X", bg: "#000000" },
};

function href(order: ForumOrder, tag: ThreadTag | null) {
  const q = new URLSearchParams();
  if (order !== "latest") q.set("order", order);
  if (tag) q.set("tag", tag);
  return q.size ? `/community?${q}` : "/community";
}

function ChannelRow({ channel }: { channel: CommunityChannel }) {
  const mark = MARK[channel.key];
  const body = (
    <>
      <span className="channel-mark" style={{ background: mark.bg }} aria-hidden>{mark.glyph}</span>
      <span className="channel-text">
        <strong>{channel.name}</strong>
        <span>{channel.url ? channel.cta : "Coming soon"}</span>
      </span>
    </>
  );
  return channel.url ? (
    <a className="channel-row" href={channel.url} target="_blank" rel="noopener noreferrer">{body}</a>
  ) : (
    <div className="channel-row is-soon">{body}</div>
  );
}

export default async function CommunityPage({ searchParams }: { searchParams: Search }) {
  const q = await searchParams;
  const order = parseOrder(q.order);
  const tag = parseTag(q.tag);
  // Trending is the most-replied list across every category; when that is
  // already the main list, it is not fetched twice.
  const sameList = order === "replied" && !tag;
  const db = await database();
  const here = (o: ForumOrder, t: ThreadTag | null): Promise<Thread[]> => (db ? listLocalThreads(db, o, t).catch(() => []) : Promise.resolve([]));
  const [remote, remoteReplied, local, localReplied, articles] = await Promise.all([
    loadThreads(order, tag),
    sameList ? null : loadThreads("replied", null),
    here(order, tag),
    sameList ? null : here("replied", null),
    db ? listArticles(db, { limit: 3 }).catch((): Article[] => []) : Promise.resolve([] as Article[]),
  ]);
  // Threads written here and threads from openproduct.live, as one list.
  // If openproduct.live can't be reached, this site's threads still show.
  const threads: Thread[] | "unreachable" =
    remote === "unreachable" && local.length === 0 ? "unreachable" : mergeThreads(local, remote === "unreachable" ? [] : remote, order);
  const trendingSource = sameList
    ? threads === "unreachable" ? [] : threads
    : mergeThreads(localReplied ?? [], remoteReplied === "unreachable" || !remoteReplied ? [] : remoteReplied, "replied");
  const hot = trendingSource.filter((t) => t.replies > 1 || (!t.local && t.replies > 0)).slice(0, 5);

  return (
    <>
      <SiteHeader current="/community" />
      <main className="wrap section">
        <div className="forum-head">
          <div>
            <h1>Community</h1>
            <p className="sub">Questions, proposals and design notes, between builders and about the builds here.</p>
          </div>
          <div className="forum-head-actions">
            <Link className="btn btn-ghost" href="/posts/new">Write a post</Link>
            <Link className="btn btn-dark" href="/community/new">+ Start a discussion</Link>
          </div>
        </div>
        {articles.length ? (
          <section className="from-builders" aria-labelledby="from-builders">
            <div className="section-head">
              <h2 id="from-builders">From the builders</h2>
              <Link className="link" href="/posts">All posts →</Link>
            </div>
            <div className="article-grid">{articles.map((a) => <ArticleCard key={a.id} article={a} />)}</div>
          </section>
        ) : null}
        <div className="forum">
          <section className="forum-main" aria-label="Threads">
            <div className="forum-tools">
              <nav className="cats" aria-label="Categories">
                <Link href={href(order, null)} aria-current={!tag ? "true" : undefined}>All</Link>
                {THREAD_TAGS.map((t) => (
                  <Link key={t} href={href(order, t)} aria-current={t === tag ? "true" : undefined}>{TAG_LABELS[t]}</Link>
                ))}
              </nav>
              <nav className="tabs" aria-label="Order">
                {FORUM_ORDERS.map((o) => (
                  <Link key={o.key} href={href(o.key, tag)} aria-current={o.key === order ? "true" : undefined}>{o.label}</Link>
                ))}
              </nav>
            </div>
            {threads === "unreachable" ? (
              <div className="unreachable">The threads could not be loaded just now. Try again in a minute.</div>
            ) : threads.length ? (
              <div className="thread-list">
                {threads.map((t) => <ThreadRow key={t.id} thread={t} />)}
              </div>
            ) : (
              <div className="forum-empty">
                <strong>{tag ? `No ${TAG_LABELS[tag].toLowerCase()} threads yet.` : "No threads yet."}</strong>
                <p>A question, a proposal, a design note, or a debate about tools. Start the first one.</p>
                <Link className="btn btn-ghost" href="/community/new">Start a discussion</Link>
              </div>
            )}
          </section>
          <aside className="forum-side">
            <div className="side-box">
              <h2>Trending threads</h2>
              {hot.length ? (
                <div className="trend-list">{hot.map((t) => <TrendingRow key={t.id} thread={t} />)}</div>
              ) : (
                <p className="muted">Nothing trending yet. Threads with the most replies show up here.</p>
              )}
            </div>
            <div className="side-box">
              <h2>Talk with builders</h2>
              <div className="channel-list">
                {COMMUNITY.map((c) => <ChannelRow key={c.key} channel={c} />)}
              </div>
            </div>
          </aside>
        </div>
      </main>
      <SiteFooter />
      <TabBar current="/community" />
    </>
  );
}
