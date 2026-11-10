import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BuildCard } from "@/components/build-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TabBar } from "@/components/tab-bar";
import { loadDirectory, sortBuilds } from "@/lib/directory";
import { loadDirectoryHere } from "@/lib/server/directory-here";

export const dynamic = "force-dynamic";

type Params = Promise<{ topic: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { topic } = await params;
  return { title: topic.replace(/-/g, " ") };
}

export default async function TopicPage({ params }: { params: Params }) {
  const { topic } = await params;
  const dir = await loadDirectoryHere();
  if (!dir.ok) {
    return (
      <>
        <SiteHeader current="/topics" />
        <main className="wrap section">
          <div className="unreachable">The directory could not be reached just now. Try again in a minute.</div>
        </main>
        <SiteFooter />
        <TabBar current="/topics" />
      </>
    );
  }
  const t = dir.topics.find((x) => x.value === topic);
  if (!t) notFound();
  const builds = sortBuilds(dir.builds.filter((b) => b.category === t.value), "active");
  return (
    <>
      <SiteHeader current="/topics" />
      <main className="wrap section">
        <Link className="link" href="/topics">← Topics</Link>
        <div className="section-head" style={{ marginTop: 12 }}>
          <h1 style={{ margin: 0, fontSize: 34, letterSpacing: "-0.02em" }}>{t.label}</h1>
          <span className="sub">
            {builds.length} {builds.length === 1 ? "build" : "builds"}, most active first.
          </span>
        </div>
        {builds.length > 0 ? (
          <div className="grid">{builds.map((b) => <BuildCard key={b.slug} build={b} topics={dir.topics} />)}</div>
        ) : (
          <div className="unreachable">No listed build in this topic yet.</div>
        )}
      </main>
      <SiteFooter />
      <TabBar current="/topics" />
    </>
  );
}
