import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TabBar } from "@/components/tab-bar";
import { ThreadRow, TrendingRow } from "@/components/thread-row";
import { FORUM_ORDERS, TAG_LABELS, THREAD_TAGS, loadThreads, parseOrder, parseTag, type ForumOrder, type ThreadTag } from "@/lib/forum";
import { COMMUNITY, OPENPRODUCT, type CommunityChannel } from "@/lib/links";

export const metadata: Metadata = {
  title: "Community",
  description: "Threads about the builds on openproduct, and where builders talk: Discord, Reddit, YouTube and X.",
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
  const [threads, replied] = await Promise.all([
    loadThreads(order, tag),
    sameList ? null : loadThreads("replied", null),
  ]);
  const trending = sameList ? threads : replied;
  const hot = trending === "unreachable" || !trending ? [] : trending.filter((t) => t.replies > 0).slice(0, 5);

  return (
    <>
      <SiteHeader current="/community" />
      <main className="wrap section">
        <div className="forum-head">
          <div>
            <h1>Community</h1>
            <p className="sub">Threads about the builds here: questions, proposals and design notes.</p>
          </div>
          <a className="btn btn-dark" href={`${OPENPRODUCT}/threads`}>+ Start a thread</a>
        </div>
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
                <p>A thread is a titled conversation about one build: a question, a proposal, a design note. Start the first one.</p>
                <a className="btn btn-ghost" href={`${OPENPRODUCT}/threads`}>Start a thread</a>
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
