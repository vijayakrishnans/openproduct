import type { Metadata } from "next";
import Link from "next/link";
import { BuildCard } from "@/components/build-card";
import { PersonCard } from "@/components/person-card";
import { SearchBox } from "@/components/search-box";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TabBar } from "@/components/tab-bar";
import { loadDirectory, loadPeople } from "@/lib/directory";
import { loadDirectoryHere } from "@/lib/server/directory-here";
import { search } from "@/lib/search";
import { loadTopics } from "@/lib/server/topics-here";

export const metadata: Metadata = { title: "Search", description: "Search openproduct builds, stacks, builders and topics." };

type Search = Promise<{ q?: string | string[] }>;

export default async function SearchPage({ searchParams }: { searchParams: Search }) {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw ?? "").trim().slice(0, 100);
  const [dir, people, here] = q ? await Promise.all([loadDirectoryHere(), loadPeople(), loadTopics()]) : [null, null, null];
  const found = dir && dir.ok ? search(q, dir.builds, people === "unreachable" || !people ? [] : people, dir.topics) : null;
  // TC4: topics are this site's topics (categories, stacks and writing), by their slug.
  const res = found && here ? { ...found, topics: search(q, [], [], here.topics.map((t) => ({ value: t.slug, label: t.label, products: t.builds }))).topics } : found;
  const total = res ? res.builds.length + res.people.length + res.topics.length : 0;

  return (
    <>
      <SiteHeader query={q} />
      <main className="wrap section search-page">
        <h1 style={{ margin: 0, fontSize: 34, letterSpacing: "-0.02em" }}>{q ? <>Results for “{q}”</> : "Search"}</h1>
        <SearchBox initial={q} />
        {!q ? (
          <p className="muted">Search by build name, what it does, its stack (try “nextjs” or “sqlite”), a topic, or a person.</p>
        ) : dir && !dir.ok ? (
          <div className="unreachable" style={{ marginTop: 18 }}>The directory could not be reached just now. Try again in a minute.</div>
        ) : res && total === 0 ? (
          <p className="muted" style={{ marginTop: 18 }}>
            Nothing matches “{q}”. Try a shorter word, or <Link className="link" href="/">browse every build</Link>.
          </p>
        ) : res ? (
          <div className="search-results">
            {res.builds.length ? (
              <section>
                <h2>Builds<span className="count">{res.builds.length}</span></h2>
                <div className="grid">{res.builds.map((b) => <BuildCard key={b.slug} build={b} topics={dir!.ok ? dir!.topics : []} />)}</div>
              </section>
            ) : null}
            {res.people.length ? (
              <section>
                <h2>Builders<span className="count">{res.people.length}</span></h2>
                <div className="people-grid">{res.people.map((p) => <PersonCard key={p.handle} person={p} />)}</div>
              </section>
            ) : null}
            {res.topics.length ? (
              <section>
                <h2>Topics<span className="count">{res.topics.length}</span></h2>
                <div className="cats">
                  {res.topics.map((t) => <Link key={t.value} href={`/topics/${t.value}?from=search`} prefetch={false}>{t.label}</Link>)}
                </div>
              </section>
            ) : null}
          </div>
        ) : null}
      </main>
      <SiteFooter />
      <TabBar current="/search" />
    </>
  );
}
