import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/person-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TabBar } from "@/components/tab-bar";
import { loadPerson } from "@/lib/directory";

export const dynamic = "force-dynamic";

type Params = Promise<{ handle: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { handle } = await params;
  return { title: `@${handle}` };
}

function BuildList({ title, builds }: { title: string; builds: { slug: string; tagline: string }[] }) {
  if (builds.length === 0) return null;
  return (
    <section className="person-section">
      <h2>{title}</h2>
      <ul className="person-builds">
        {builds.map((b) => (
          <li key={b.slug}>
            <Link href={`/builds/${b.slug}`}>
              <strong>{b.slug}</strong>
              {b.tagline ? <span>{b.tagline}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function PersonPage({ params }: { params: Params }) {
  const { handle } = await params;
  const person = await loadPerson(handle);
  if (person === null) notFound();
  return (
    <>
      <SiteHeader current="/builders" />
      <main className="wrap section">
        <Link className="link" href="/builders">← Builders</Link>
        {person === "unreachable" ? (
          <div className="unreachable" style={{ marginTop: 16 }}>This profile could not be reached just now. Try again in a minute.</div>
        ) : (
          <>
            <div className="person-hero">
              <Avatar handle={person.handle} size={64} />
              <div>
                <h1>{person.displayName}</h1>
                <span className="mono handle">@{person.handle}</span>
                {person.bio ? <p>{person.bio}</p> : null}
                <div className="card-badges">
                  {person.openToProject ? <span className="badge role">Open to a project</span> : null}
                  <span className="badge">{person.followers} {person.followers === 1 ? "follower" : "followers"}</span>
                  {person.githubUrl ? <a className="badge" href={person.githubUrl} rel="noopener noreferrer">GitHub</a> : null}
                  {person.siteUrl ? <a className="badge" href={person.siteUrl} rel="noopener noreferrer">Website</a> : null}
                </div>
              </div>
            </div>
            <BuildList title="Maintains" builds={person.maintainsBuilds} />
            <BuildList title="Contributes to" builds={person.contributesToBuilds} />
            {person.maintainsBuilds.length + person.contributesToBuilds.length === 0 ? (
              <p className="sample-note">No public builds yet.</p>
            ) : null}
          </>
        )}
      </main>
      <SiteFooter />
      <TabBar current="/builders" />
    </>
  );
}
