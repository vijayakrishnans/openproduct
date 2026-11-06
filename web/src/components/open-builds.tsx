import Link from "next/link";
import type { Build, Sort, Topic } from "@/lib/directory";
import { SORTS, belowFloor, sortBuilds } from "@/lib/directory";
import { BuildCard } from "./build-card";

const href = (sort: Sort, cat: string | null) => {
  const q = new URLSearchParams();
  if (sort !== "active") q.set("sort", sort);
  if (cat) q.set("cat", cat);
  const s = q.toString();
  return s ? `/?${s}#builds` : "/#builds";
};

export function OpenBuilds({ builds, topics, sort, cat }: { builds: Build[]; topics: Topic[]; sort: Sort; cat: string | null }) {
  const inCat = cat ? builds.filter((b) => b.category === cat) : builds;
  const sorted = sortBuilds(inCat, sort);
  const loud = sorted.filter((b) => !belowFloor(b));
  const quiet = sorted.filter(belowFloor);
  // A quiet week would otherwise show an almost empty grid: below five
  // active builds, the quiet row starts open.
  return (
    <section className="section" id="builds" aria-labelledby="builds-h">
      <div className="toolbar">
        <div>
          <div className="section-head" style={{ marginBottom: 2 }}>
            <h2 id="builds-h">Open builds</h2>
          </div>
          <div className="sub" style={{ color: "var(--ink-3)", fontSize: 14 }}>
            Each box is a living app map: the pieces it uses, and the one that moved last.
          </div>
        </div>
        <nav className="tabs" aria-label="Sort">
          {SORTS.map((s) => (
            <Link key={s.key} href={href(s.key, cat)} aria-current={s.key === sort ? "true" : undefined}>
              {s.label}
            </Link>
          ))}
        </nav>
      </div>
      <nav className="cats" id="topics" aria-label="Categories">
        <Link href={href(sort, null)} aria-current={!cat ? "true" : undefined}>All</Link>
        {topics.map((t) => (
          <Link key={t.value} href={href(sort, t.value)} aria-current={cat === t.value ? "true" : undefined}>
            {t.label}
          </Link>
        ))}
      </nav>
      <div className="formula" id="ranking">
        Most active = (changes + 1) × (upvotes + 1), 7 days
        <a href="https://openproduct.live/transparency">How ranking works</a>
      </div>
      {loud.length > 0 ? (
        <div className="grid">{loud.map((b) => <BuildCard key={b.slug} build={b} topics={topics} />)}</div>
      ) : (
        <p className="sample-note">No build in this view changed in the last 7 days. They are all below the floor.</p>
      )}
      {quiet.length > 0 ? (
        <details className="quiet" open={loud.length < 5}>
          <summary>
            <span>
              <b style={{ color: "var(--ink)" }}>Below the floor</b> · {quiet.length} {quiet.length === 1 ? "build" : "builds"} had no public changes this week. They stay listed, just quieter.
            </span>
            <span className="btn btn-ghost">
              <span className="when-closed">Show {quiet.length} quiet builds</span>
              <span className="when-open">Hide quiet builds</span>
            </span>
          </summary>
          <div className="grid">{quiet.map((b) => <BuildCard key={b.slug} build={b} topics={topics} />)}</div>
        </details>
      ) : null}
      <p className="sample-note">
        <b>Live data:</b> names, taglines, categories, licences, open roles, changes and upvotes, from api.openproduct.live.{" "}
        <b>Sample:</b> the app map on each card, until the API describes a build&apos;s integrations.
      </p>
    </section>
  );
}
