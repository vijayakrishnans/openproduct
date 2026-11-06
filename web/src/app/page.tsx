import { HowItWorks } from "@/components/how-it-works";
import { LivePulse, PulseTicker } from "@/components/live-pulse";
import { OpenBuilds } from "@/components/open-builds";
import { RolesRow } from "@/components/roles-row";
import { TabBar } from "@/components/tab-bar";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SORTS, type Sort, belowFloor, loadDirectory, loadRoles } from "@/lib/directory";
import { OPENPRODUCT, SOURCE } from "@/lib/links";

// The directory is read per request: it is the live list, not a snapshot.
export const dynamic = "force-dynamic";

type Search = Promise<{ sort?: string; cat?: string }>;

export default async function Home({ searchParams }: { searchParams: Search }) {
  const q = await searchParams;
  const sort: Sort = SORTS.some((s) => s.key === q.sort) ? (q.sort as Sort) : "active";
  const dir = await loadDirectory();
  const cat = dir.ok && dir.topics.some((t) => t.value === q.cat) ? q.cat! : null;
  const updated = new Date().toISOString().slice(11, 16);
  const roles = dir.ok ? (await loadRoles(dir.builds, 8)).slice(0, 8) : [];
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
              Every build is a public repo and a public workspace on Orunbase. List yours for free, find people to
              build with, and fork anything you like. The directory itself is open source too.
            </p>
            <div className="hero-actions">
              <a className="btn btn-accent" href={OPENPRODUCT}>List your build</a>
              <a className="btn btn-ghost" href={SOURCE}>&lt;&gt; Read this site&apos;s source</a>
            </div>
            {dir.ok ? (
              <div className="hero-meta mono">
                {dir.builds.length} builds · {dir.builds.filter(belowFloor).length} below the floor · updated {updated} UTC
              </div>
            ) : null}
          </div>
          {dir.ok ? <LivePulse builds={dir.builds} topics={dir.topics} /> : null}
        </section>
        {dir.ok ? <PulseTicker builds={dir.builds} /> : null}
        <RolesRow roles={roles} />
        {dir.ok ? (
          <OpenBuilds builds={dir.builds} topics={dir.topics} sort={sort} cat={cat} />
        ) : (
          <div className="unreachable">
            The directory could not be reached just now ({dir.reason}). The listings live at{" "}
            <a className="link" href={OPENPRODUCT}>openproduct.live</a>.
          </div>
        )}
        <HowItWorks />
      </main>
      <SiteFooter />
      <TabBar current="/" />
    </>
  );
}
