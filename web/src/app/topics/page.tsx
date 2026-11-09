import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TabBar } from "@/components/tab-bar";
import { loadDirectory } from "@/lib/directory";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Topics", description: "Browse openproduct builds by what kind of product they are." };

export default async function TopicsPage() {
  const dir = await loadDirectory();
  return (
    <>
      <SiteHeader current="/topics" />
      <main className="wrap section">
        <div className="section-head">
          <h1 style={{ margin: 0, fontSize: 34, letterSpacing: "-0.02em" }}>Topics</h1>
          <span className="sub">What kind of product each build is. One per build, picked by its maintainers.</span>
        </div>
        {dir.ok ? (
          <div className="topic-grid">
            {[...dir.topics]
              .sort((a, b) => b.products - a.products || a.label.localeCompare(b.label))
              .map((t) => {
                const builds = dir.builds.filter((b) => b.category === t.value);
                return (
                  <Link key={t.value} href={`/topics/${t.value}`} className="topic-card">
                    <strong>{t.label}</strong>
                    <span className="mono">
                      {builds.length} {builds.length === 1 ? "build" : "builds"}
                    </span>
                    {builds.length > 0 ? (
                      <span className="topic-sample">{builds.slice(0, 3).map((b) => b.slug).join(" · ")}</span>
                    ) : null}
                  </Link>
                );
              })}
          </div>
        ) : (
          <div className="unreachable">The directory could not be reached just now. Try again in a minute.</div>
        )}
      </main>
      <SiteFooter />
      <TabBar current="/topics" />
    </>
  );
}
