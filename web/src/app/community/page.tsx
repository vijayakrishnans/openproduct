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
  description: "The public square: issues and their solutions, new ways of doing things, launches, and discussions between builders.",
};

type View = "issues" | "solved" | "discussions" | null;
type Search = Promise<{ view?: string; order?: string; tag?: string }>;

const parseView = (v: string | undefined): View => (v === "issues" || v === "solved" || v === "discussions" ? v : null);

/** A small mark per channel, in the channel's own colour. */
const MARK: Record<CommunityChannel["key"], { glyph: string; bg: string }> = {
  discord: { glyph: "D", bg: "#5865F2" },
  reddit: { glyph: "r/", bg: "#FF4500" },
  youtube: { glyph: "▶", bg: "#FF0000" },
  x: { glyph: "X", bg: "#000000" },
};

function forumHref(order: ForumOrder, tag: ThreadTag | null) {
  const q = new URLSearchParams({ view: "discussions" });
  if (order !== "latest") q.set("order", order);
  if (tag) q.set("tag", tag);
  return `/community?${q}`;
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

/** One section of the square: a heading, its "See all", and its items. */
function Section({ id, title, sub, all, children }: { id: string; title: string; sub: string; all: string; children: React.ReactNode }) {
  return (
    <section className="square-section" aria-labelledby={`${id}-h`}>
      <div className="section-head">
        <h2 id={`${id}-h`}>{title}</h2>
        <span className="sub">{sub}</span>
        <Link className="link end" href={all}>See all</Link>
      </div>
      {children}
    </section>
  );
}

function Empty({ text, href, cta }: { text: string; href: string; cta: string }) {
  return (
    <p className="square-empty">
      {text} <Link className="link" href={href}>{cta}</Link>
    </p>
  );
}

/**
 * Community (TC3): the public square. Open issues and the ones solved, new
 * ways of doing things (tutorials and blogs), launches, and discussions,
 * the same for everyone. Topics are the personal side.
 */
export default async function CommunityPage({ searchParams }: { searchParams: Search }) {
  const q = await searchParams;
  const view = parseView(q.view);
  const order = parseOrder(q.order);
  const tag = parseTag(q.tag);
  const db = await database();
  const none = Promise.resolve([] as never[]);

  const [openIssues, solved, tutorials, blogs, launches, localDiscussions, remote, localReplied, remoteReplied] = await Promise.all([
    db && (view === null || view === "issues") ? listLocalThreads(db, "latest", null, view ? 50 : 4, undefined, { kind: "issue", solved: false }).catch(() => []) : none,
    db && (view === null || view === "solved") ? listLocalThreads(db, "latest", null, view ? 50 : 3, undefined, { kind: "issue", solved: true }).catch(() => []) : none,
    db && view === null ? listArticles(db, { kind: "tutorial", limit: 3 }).catch((): Article[] => []) : none,
    db && view === null ? listArticles(db, { kind: "blog", limit: 3 }).catch((): Article[] => []) : none,
    db && view === null ? listArticles(db, { kind: "launch", limit: 3 }).catch((): Article[] => []) : none,
    db && (view === null || view === "discussions") ? listLocalThreads(db, order, tag, view ? 50 : 6, undefined, { kind: "discussion" }).catch(() => []) : none,
    view === null || view === "discussions" ? loadThreads(order, tag) : Promise.resolve("unreachable" as const),
    db ? listLocalThreads(db, "replied", null, 20).catch(() => []) : none,
    loadThreads("replied", null),
  ]);

  const discussions: Thread[] | "unreachable" =
    remote === "unreachable" && localDiscussions.length === 0 ? "unreachable" : mergeThreads(localDiscussions, remote === "unreachable" ? [] : remote, order, view ? 50 : 6);
  const hot = mergeThreads(localReplied, remoteReplied === "unreachable" ? [] : remoteReplied, "replied")
    .filter((t) => t.replies > 1 || (!t.local && t.replies > 0))
    .slice(0, 5);
  // New ways: the latest tutorials and blogs together.
  const newWays = [...tutorials, ...blogs].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 3);

  const tabs: { key: View; label: string; href: string }[] = [
    { key: null, label: "Overview", href: "/community" },
    { key: "issues", label: "Issues", href: "/community?view=issues" },
    { key: "solved", label: "Solved", href: "/community?view=solved" },
    { key: "discussions", label: "Discussions", href: "/community?view=discussions" },
  ];

  return (
    <>
      <SiteHeader current="/community" />
      <main className="wrap section">
        <div className="forum-head">
          <div>
            <h1>Community</h1>
            <p className="sub">The public square: what&apos;s broken and how it got fixed, new ways of doing things, and what people just shipped.</p>
          </div>
          <div className="forum-head-actions">
            <Link className="btn btn-ghost" href="/community/new?kind=issue">Raise an issue</Link>
            <Link className="btn btn-ghost" href="/posts/new">Write a post</Link>
            <Link className="btn btn-dark" href="/community/new">+ Start a discussion</Link>
          </div>
        </div>
        <nav className="tabs square-tabs" aria-label="Community sections">
          {tabs.map((t) => (
            <Link key={t.label} href={t.href} aria-current={view === t.key ? "true" : undefined}>{t.label}</Link>
          ))}
          <Link href="/posts?kind=tutorial">New ways</Link>
          <Link href="/posts?kind=launch">Launches</Link>
        </nav>

        <div className="forum">
          <div className="forum-main">
            {view === null ? (
              <>
                <Section id="issues" title="Issues" sub="Open: something's broken or unclear." all="/community?view=issues">
                  {openIssues.length ? (
                    <div className="thread-list">{openIssues.map((t) => <ThreadRow key={t.id} thread={t} />)}</div>
                  ) : (
                    <Empty text="No open issues." href="/community/new?kind=issue" cta="Raise one" />
                  )}
                </Section>
                <Section id="solved" title="Solved" sub="Issues with an accepted solution." all="/community?view=solved">
                  {solved.length ? (
                    <div className="thread-list">{solved.map((t) => <ThreadRow key={t.id} thread={t} />)}</div>
                  ) : (
                    <Empty text="Nothing solved yet." href="/community?view=issues" cta="Help with an open issue" />
                  )}
                </Section>
                <Section id="new-ways" title="New ways" sub="Tutorials and write-ups from builders." all="/posts?kind=tutorial">
                  {newWays.length ? (
                    <div className="article-grid">{newWays.map((a) => <ArticleCard key={a.id} article={a} />)}</div>
                  ) : (
                    <Empty text="No tutorials yet." href="/posts/new" cta="Write the first" />
                  )}
                </Section>
                <Section id="launches" title="Launches" sub="Just shipped." all="/posts?kind=launch">
                  {launches.length ? (
                    <div className="article-grid">{launches.map((a) => <ArticleCard key={a.id} article={a} />)}</div>
                  ) : (
                    <Empty text="No launches yet." href="/posts/new" cta="Announce yours" />
                  )}
                </Section>
                <Section id="discussions" title="Discussions" sub="Questions, proposals and design notes." all="/community?view=discussions">
                  {discussions === "unreachable" ? (
                    <div className="unreachable">The discussions could not be loaded just now.</div>
                  ) : discussions.length ? (
                    <div className="thread-list">{discussions.map((t) => <ThreadRow key={t.id} thread={t} />)}</div>
                  ) : (
                    <Empty text="No discussions yet." href="/community/new" cta="Start one" />
                  )}
                </Section>
              </>
            ) : view === "issues" || view === "solved" ? (
              <section aria-label={view === "issues" ? "Open issues" : "Solved issues"}>
                {(view === "issues" ? openIssues : solved).length ? (
                  <div className="thread-list">{(view === "issues" ? openIssues : solved).map((t) => <ThreadRow key={t.id} thread={t} />)}</div>
                ) : (
                  <div className="forum-empty">
                    <strong>{view === "issues" ? "No open issues." : "Nothing solved yet."}</strong>
                    <Link className="btn btn-ghost" href="/community/new?kind=issue">Raise an issue</Link>
                  </div>
                )}
              </section>
            ) : (
              <section aria-label="Discussions">
                <div className="forum-tools">
                  <nav className="cats" aria-label="Categories">
                    <Link href={forumHref(order, null)} aria-current={!tag ? "true" : undefined}>All</Link>
                    {THREAD_TAGS.map((t) => (
                      <Link key={t} href={forumHref(order, t)} aria-current={t === tag ? "true" : undefined}>{TAG_LABELS[t]}</Link>
                    ))}
                  </nav>
                  <nav className="tabs" aria-label="Order">
                    {FORUM_ORDERS.map((o) => (
                      <Link key={o.key} href={forumHref(o.key, tag)} aria-current={o.key === order ? "true" : undefined}>{o.label}</Link>
                    ))}
                  </nav>
                </div>
                {discussions === "unreachable" ? (
                  <div className="unreachable">The threads could not be loaded just now. Try again in a minute.</div>
                ) : discussions.length ? (
                  <div className="thread-list">{discussions.map((t) => <ThreadRow key={t.id} thread={t} />)}</div>
                ) : (
                  <div className="forum-empty">
                    <strong>{tag ? `No ${TAG_LABELS[tag].toLowerCase()} threads yet.` : "No threads yet."}</strong>
                    <Link className="btn btn-ghost" href="/community/new">Start a discussion</Link>
                  </div>
                )}
              </section>
            )}
          </div>
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
