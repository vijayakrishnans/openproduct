import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeList } from "@/components/badge-list";
import { CardCover } from "@/components/card-cover";
import { Avatar } from "@/components/person-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TabBar } from "@/components/tab-bar";
import { builderBadges } from "@/lib/badges";
import { initials, loadDirectory, loadPerson, type Build, type PersonDetail } from "@/lib/directory";

export const dynamic = "force-dynamic";

type Params = Promise<{ handle: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { handle } = await params;
  return { title: `@${handle}` };
}

type Project = { slug: string; tagline: string; role: "Maintainer" | "Contributor"; build: Build | null };

/** Public builds only: the API's maintains and contributesToListings never carry a private one. */
function projectsOf(person: PersonDetail, builds: Build[]): Project[] {
  const bySlug = new Map(builds.map((b) => [b.slug, b]));
  const seen = new Set<string>();
  const out: Project[] = [];
  const add = (l: { slug: string; tagline: string }, role: Project["role"]) => {
    if (seen.has(l.slug)) return;
    seen.add(l.slug);
    const build = bySlug.get(l.slug) ?? null;
    out.push({ slug: l.slug, tagline: l.tagline || build?.tagline || "", role, build });
  };
  person.maintainsBuilds.forEach((l) => add(l, "Maintainer"));
  person.contributesToBuilds.forEach((l) => add(l, "Contributor"));
  return out;
}

function Projects({ projects }: { projects: Project[] }) {
  return (
    <section className="person-section">
      <h2>Projects <span className="count">{projects.length}</span></h2>
      {projects.length === 0 ? (
        <p className="sample-note">No public builds yet.</p>
      ) : (
        <ul className="project-grid">
          {projects.map((p) => (
            <li key={p.slug}>
              <Link href={`/builds/${p.slug}`} className="project-card">
                {p.build ? <CardCover build={p.build} /> : <div className="card-cover blank"><span className="cover-tile mono" aria-hidden>{initials(p.slug)}</span></div>}
                <div className="project-body">
                  <div className="project-top">
                    <strong>{p.slug}</strong>
                    <span className={`badge${p.role === "Maintainer" ? " role" : ""}`}>{p.role}</span>
                  </div>
                  {p.tagline ? <span className="project-tagline">{p.tagline}</span> : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function PersonPage({ params }: { params: Params }) {
  const { handle } = await params;
  const [person, directory] = await Promise.all([loadPerson(handle), loadDirectory()]);
  if (person === null) notFound();
  const badges =
    person === "unreachable"
      ? []
      : builderBadges({
          publishedAt: person.publishedAt,
          openToProject: person.openToProject,
          launched: person.launched,
          maintains: person.maintainsBuilds.length,
          contributes: person.contributesToBuilds.length,
          contributesTo: person.contributesToBuilds.map((b) => b.slug),
        });
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
                  <span className="badge">{person.followers} {person.followers === 1 ? "follower" : "followers"}</span>
                  {person.githubUrl ? <a className="badge" href={person.githubUrl} rel="noopener noreferrer">GitHub</a> : null}
                  {person.siteUrl ? <a className="badge" href={person.siteUrl} rel="noopener noreferrer">Website</a> : null}
                </div>
              </div>
            </div>
            <section className="person-section">
              <h2>Badges</h2>
              {badges.length > 0 ? (
                <>
                  <BadgeList badges={badges} />
                  <p className="badge-note">Every badge is worked out from public activity on openproduct. Nobody hands them out. Each one says where it came from.</p>
                </>
              ) : (
                <p className="sample-note">No badges yet. They come from building and contributing in the open.</p>
              )}
            </section>
            <Projects projects={projectsOf(person, directory.ok ? directory.builds : [])} />
          </>
        )}
      </main>
      <SiteFooter />
      <TabBar current="/builders" />
    </>
  );
}
