import Link from "next/link";
import type { Build, BuildFilter, Sort, Topic } from "@/lib/directory";
import { BUILD_FILTERS, PAGE_SIZE, SORTS, belowFloor, filterBuilds, sortBuilds } from "@/lib/directory";
import { BuildCard } from "./build-card";

export type BuildsView = { sort: Sort; cat: string | null; q: string; filters: BuildFilter[]; show: number };

/** The address of a view of Open builds; every control keeps the others. */
function href(v: BuildsView, change: Partial<BuildsView> = {}, anchor = "builds") {
  const n = { ...v, ...change };
  const p = new URLSearchParams();
  if (n.sort !== "active") p.set("sort", n.sort);
  if (n.cat) p.set("cat", n.cat);
  if (n.q) p.set("q", n.q);
  if (n.filters.length) p.set("f", n.filters.join(","));
  if (n.show > PAGE_SIZE) p.set("show", String(n.show));
  const s = p.toString();
  return s ? `/?${s}#${anchor}` : `/#${anchor}`;
}

/**
 * Open builds (OP-37): search, filters and a ranking, 20 at a time with
 * "Load more". Plain links and a GET form, so it works without script.
 */
export function OpenBuilds({ builds, topics, view }: { builds: Build[]; topics: Topic[]; view: BuildsView }) {
  const matched = sortBuilds(filterBuilds(builds, { q: view.q, cat: view.cat, filters: view.filters, topics }), view.sort);
  // Under "Most active" the quiet ones (no changes this week) already sort last;
  // each keeps a quiet tag rather than hiding in a drawer.
  const shown = matched.slice(0, view.show);
  const narrowed = !!(view.q || view.cat || view.filters.length);
  const reset = { q: "", cat: null, filters: [] as BuildFilter[], show: PAGE_SIZE };
  const left = matched.length - shown.length;

  return (
    <section className="section" id="builds" aria-labelledby="builds-h">
      <div className="toolbar">
        <div>
          <div className="section-head" style={{ marginBottom: 2 }}>
            <h2 id="builds-h">Open builds</h2>
          </div>
        </div>
        <nav className="tabs" aria-label="Rank by">
          {SORTS.map((s) => (
            <Link key={s.key} href={href(view, { sort: s.key, show: PAGE_SIZE })} aria-current={s.key === view.sort ? "true" : undefined}>
              {s.label}
            </Link>
          ))}
        </nav>
      </div>

      <form className="builds-search" action="/" method="get" role="search">
        {view.sort !== "active" ? <input type="hidden" name="sort" value={view.sort} /> : null}
        {view.cat ? <input type="hidden" name="cat" value={view.cat} /> : null}
        {view.filters.length ? <input type="hidden" name="f" value={view.filters.join(",")} /> : null}
        <label className="search">
          <span aria-hidden>⌕</span>
          <span className="sr-only">Search builds</span>
          <input name="q" defaultValue={view.q} placeholder="Search builds by name, what they do, or stack" maxLength={80} />
        </label>
        <button className="btn btn-ghost" type="submit">Search</button>
      </form>

      <nav className="cats builds-filters" aria-label="Filters">
        {BUILD_FILTERS.map((f) => {
          const on = view.filters.includes(f.key);
          const filters = on ? view.filters.filter((x) => x !== f.key) : [...view.filters, f.key];
          return (
            <Link key={f.key} href={href(view, { filters, show: PAGE_SIZE })} aria-current={on ? "true" : undefined}>
              {on ? "✓ " : ""}
              {f.label}
            </Link>
          );
        })}
      </nav>
      <nav className="cats" id="topics" aria-label="Categories">
        <Link href={href(view, { cat: null, show: PAGE_SIZE })} aria-current={!view.cat ? "true" : undefined}>All</Link>
        {topics.map((t) => (
          <Link key={t.value} href={href(view, { cat: t.value, show: PAGE_SIZE })} aria-current={view.cat === t.value ? "true" : undefined}>
            {t.label}
          </Link>
        ))}
      </nav>

      <div className="builds-meta">
        <div className="formula" id="ranking">
          Most active = (changes + 1) × (upvotes + 1), 7 days
          <span className="formula-note">Builds with no public changes this week are marked quiet.</span>
        </div>
        <span className="muted builds-count">
          {matched.length ? `Showing ${shown.length} of ${matched.length} ${matched.length === 1 ? "build" : "builds"}` : null}
          {narrowed ? (
            <>
              {" · "}
              <Link className="link" href={href(view, reset)}>Clear search and filters</Link>
            </>
          ) : null}
        </span>
      </div>

      {shown.length ? (
        <div className="grid">
          {shown.map((b, i) => (
            <BuildCard key={b.slug} build={b} topics={topics} quiet={belowFloor(b)} anchor={i > 0 && i % PAGE_SIZE === 0 ? `more-${i}` : undefined} />
          ))}
        </div>
      ) : (
        <div className="forum-empty">
          <strong>No builds match.</strong>
          <p>Try fewer words, or clear a filter.</p>
          <Link className="btn btn-ghost" href={href(view, reset)}>Show every build</Link>
        </div>
      )}

      {left > 0 ? (
        <div className="load-more">
          <Link className="btn btn-ghost" href={href(view, { show: view.show + PAGE_SIZE }, `more-${view.show}`)}>
            Load {Math.min(PAGE_SIZE, left)} more
          </Link>
          <span className="muted">{left} more {left === 1 ? "build" : "builds"}</span>
        </div>
      ) : null}
      <p className="sample-note">
        <b>Live data:</b> names, taglines, categories, licences, open roles and changes come from the openproduct directory and the repos of builds listed here; upvotes add the ones made here.
      </p>
    </section>
  );
}
