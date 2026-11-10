import { HowItWorks } from "@/components/how-it-works";
import { LivePulse, PulseTicker } from "@/components/live-pulse";
import { OpenBuilds } from "@/components/open-builds";
import { HomeSide } from "@/components/home-side";
import { TabBar } from "@/components/tab-bar";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { listArticles, type Article } from "@/lib/auth/articles";
import { listLocalThreads } from "@/lib/auth/discussions";
import { SORTS, type Sort } from "@/lib/directory";
import { loadThreads, mergeThreads, type Thread } from "@/lib/forum";
import { database } from "@/lib/server/env";
import { loadDirectoryHere, loadRolesHere } from "@/lib/server/directory-here";
import { SOURCE } from "@/lib/links";

// The directory is read per request: it is the live list, not a snapshot.
export const dynamic = "force-dynamic";

type Search = Promise<{ sort?: string; cat?: string }>;

export default async function Home({ searchParams }: { searchParams: Search }) {
  const q = await searchParams;
  const sort: Sort = SORTS.some((s) => s.key === q.sort) ? (q.sort as Sort) : "active";
  const [dir, db] = await Promise.all([loadDirectoryHere(), database()]);
  const cat = dir.ok && dir.topics.some((t) => t.value === q.cat) ? q.cat! : null;
  // The sidebar: open seats, and the community's latest, from here and openproduct.live.
  const [roles, remoteThreads, localThreads, articles] = await Promise.all([
    dir.ok ? loadRolesHere(dir.builds, 6).then((r) => r.slice(0, 6)) : Promise.resolve([]),
    loadThreads("latest", null).catch(() => "unreachable" as const),
    db ? listLocalThreads(db, "latest", null, 4).catch((): Thread[] => []) : Promise.resolve([] as Thread[]),
    db ? listArticles(db, { limit: 2 }).catch((): Article[] => []) : Promise.resolve([] as Article[]),
  ]);
  const threads = mergeThreads(localThreads, remoteThreads === "unreachable" ? [] : remoteThreads, "latest", 4);
  return (
    <>
      <SiteHeader current="/" />
      <main className="wrap">
        <section className="hero">
          <div>
            <div className="chips">
              <span className="chip">OPEN SOURCE</span>
              <span className="chip">FREE TO LIST</span>
              <span className="chip">BUILT ON ORUNBASE</span>
            </div>
            <h1>Products built in the open.</h1>
            <p className="lede-short">Public repos, public workspaces. List yours free, fork anything.</p>
            <p className="lede">
              Every build is a public repo and a public workspace on Orunbase. List yours for free, find builders to
              build with, and fork anything you like. The directory itself is open source too.
            </p>
            <div className="hero-actions">
              <a className="btn btn-accent" href="/list">List your build</a>
              <a className="btn btn-ghost" href={SOURCE}>&lt;&gt; Read this site&apos;s source</a>
            </div>
          </div>
          {dir.ok ? <LivePulse builds={dir.builds} topics={dir.topics} /> : null}
        </section>
        {dir.ok ? <PulseTicker builds={dir.builds} /> : null}
        <div className="home-cols">
          <div className="home-main">
            {dir.ok ? (
              <OpenBuilds builds={dir.builds} topics={dir.topics} sort={sort} cat={cat} />
            ) : (
              <div className="unreachable section">
                The directory could not be reached just now ({dir.reason}). Try again in a minute.
              </div>
            )}
          </div>
          <HomeSide roles={roles} topics={dir.ok ? dir.topics : []} threads={threads} articles={articles} />
        </div>
        <HowItWorks />
      </main>
      <SiteFooter />
      <TabBar current="/" />
    </>
  );
}
