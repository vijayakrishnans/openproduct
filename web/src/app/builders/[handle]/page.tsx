import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeList } from "@/components/badge-list";
import { CardCover } from "@/components/card-cover";
import { Avatar } from "@/components/person-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TabBar } from "@/components/tab-bar";
import { githubLoginOf } from "@/lib/auth/accounts";
import { builderByHandle, builderOfAccount, canClaim, githubLoginFromUrl, type OwnedBuilder } from "@/lib/auth/builders";
import { currentSession } from "@/lib/auth/request";
import { builderSupportLinks } from "@/lib/auth/support";
import { threadsStartedBy } from "@/lib/auth/discussions";
import { articlesBy, listArticles, type Article } from "@/lib/auth/articles";
import { mergedPrsOfAccount } from "@/lib/auth/github-prs";
import { searchLink, type MergedPrs } from "@/lib/merged-prs";
import { ArticleCard } from "@/components/article-card";
import { SupportLinks } from "@/components/support-links";
import type { Session } from "@/lib/auth/session";
import { builderBadges } from "@/lib/badges";
import { initials, loadBuildRepos, loadPerson, type Build, type PersonDetail } from "@/lib/directory";
import { loadDirectoryHere } from "@/lib/server/directory-here";
import { listingsContributedBy, listingsMaintainedBy } from "@/lib/auth/listing-team";
import type { Db } from "@/lib/server/db";
import { followState } from "@/lib/auth/reactions";
import { appEnv, database } from "@/lib/server/env";

export const dynamic = "force-dynamic";

type Params = Promise<{ handle: string }>;
type Search = Promise<{ claim?: string; message?: string; started?: string; deleted?: string }>;

const CLAIM_MESSAGES: Record<string, string> = {
  done: "Claimed. This profile is yours on openproduct now.",
  unproved: "That didn't prove it's you: sign in with the GitHub account this profile links to.",
  unreachable: "We couldn't reach openproduct.live to check. Try again in a minute.",
  missing: "That profile isn't on openproduct.live.",
  invalid: "That isn't a builder handle.",
};

/** A profile started here, shaped like one read from openproduct.live (no builds yet). */
function localPerson(b: OwnedBuilder): PersonDetail {
  return {
    handle: b.handle,
    displayName: b.displayName ?? b.handle,
    bio: b.bio,
    openToProject: false,
    maintains: [],
    contributesTo: 0,
    launched: null,
    githubUrl: null,
    siteUrl: null,
    followers: 0,
    publishedAt: b.createdAt,
    maintainsBuilds: [],
    contributesToBuilds: [],
  };
}

/** What the signed-in person can do with this profile: edit it, claim it, or nothing. */
async function OwnerBar({ person, owner, session, fromHere }: { person: PersonDetail; owner: (OwnedBuilder & { accountId: string }) | null; session: Session | null; fromHere: boolean }) {
  if (owner && session && owner.accountId === session.account.id) {
    return (
      <div className="owner-bar mine">
        <span>This is your profile.</span>
        <Link className="btn btn-dark" href="/account#profile">Edit profile</Link>
      </div>
    );
  }
  if (owner) return fromHere ? null : <div className="owner-bar"><span className="pill">✓ Claimed on openproduct</span></div>;
  if (fromHere) return null;
  const linked = githubLoginFromUrl(person.githubUrl);
  if (!session) {
    return (
      <div className="owner-bar">
        <span>Is this you?</span>
        <Link className="link" href={`/signin?next=${encodeURIComponent(`/builders/${person.handle}`)}`}>Sign in to claim this profile</Link>
      </div>
    );
  }
  const db = await database();
  if (!db) return null;
  const [mine, login] = await Promise.all([builderOfAccount(db, session.account.id), githubLoginOf(db, session.account.id)]);
  if (mine) return null;
  if (canClaim(person.githubUrl, login)) {
    return (
      <form className="owner-bar" method="post" action="/account/claim">
        <input type="hidden" name="handle" value={person.handle} />
        <span>Your GitHub account matches this profile.</span>
        <button className="btn btn-dark" type="submit">Claim this profile</button>
      </form>
    );
  }
  return (
    <div className="owner-bar">
      <span>
        {linked
          ? <>Is this you? <Link className="link" href={`/auth/github?next=${encodeURIComponent(`/builders/${person.handle}`)}`}>Sign in with GitHub as @{linked}</Link> to claim it.</>
          : <>Is this you? Add your GitHub link to your openproduct profile, then sign in with GitHub here to claim it.</>}
      </span>
    </div>
  );
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { handle } = await params;
  return { title: `@${handle}` };
}

/** A profile plus the published listings here its owner maintains or contributes to (list-your-build LB4). */
async function withListingsHere(db: Db, person: PersonDetail, accountId: string): Promise<PersonDetail> {
  const login = await githubLoginOf(db, accountId);
  const [maint, contrib] = await Promise.all([listingsMaintainedBy(db, accountId), login ? listingsContributedBy(db, login) : Promise.resolve([])]);
  const has = (list: { slug: string }[], slug: string) => list.some((b) => b.slug.toLowerCase() === slug.toLowerCase());
  const maintainsBuilds = [...person.maintainsBuilds, ...maint.filter((l) => !has(person.maintainsBuilds, l.slug))];
  const contributesToBuilds = [
    ...person.contributesToBuilds,
    ...contrib.filter((l) => !has(maintainsBuilds, l.slug) && !has(person.contributesToBuilds, l.slug)),
  ];
  return { ...person, maintainsBuilds, contributesToBuilds, maintains: maintainsBuilds.map((b) => b.slug) };
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

function ProjectBody({ p, draft }: { p: Project; draft?: boolean }) {
  return (
    <div className="project-body">
      <div className="project-top">
        <strong>{p.slug}</strong>
        <span className={`badge${p.role === "Maintainer" ? " role" : ""}`}>{p.role}</span>
        {draft ? <span className="badge">Draft</span> : null}
      </div>
      {p.tagline ? <span className="project-tagline">{p.tagline}</span> : null}
    </div>
  );
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
              {/* A draft has no public page yet (the directory leaves drafts out), so its card isn't a link. */}
              {p.build ? (
                <Link href={`/builds/${p.slug}`} className="project-card">
                  <CardCover build={p.build} />
                  <ProjectBody p={p} />
                </Link>
              ) : (
                <div className="project-card is-draft">
                  <div className="card-cover blank"><span className="cover-tile mono" aria-hidden>{initials(p.slug)}</span></div>
                  <ProjectBody p={p} draft />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Their posts (BP6), newest first; videos play in place. */
function Posts({ posts, total, name, isOwner }: { posts: Article[]; total: number; name: string; isOwner: boolean }) {
  if (!posts.length && !isOwner) return null;
  return (
    <section className="person-section" id="posts">
      <div className="section-head">
        <h2>Posts <span className="count">{total}</span></h2>
        {isOwner ? <Link className="btn btn-dark" href="/posts/new">+ Write a post</Link> : null}
      </div>
      {posts.length ? (
        <div className="article-grid">{posts.map((a) => <ArticleCard key={a.id} article={a} withAuthor={false} />)}</div>
      ) : (
        <p className="sample-note">{isOwner ? "Nothing yet. A build log or a demo video is a good first post." : `${name} hasn't posted yet.`}</p>
      )}
    </section>
  );
}

export default async function PersonPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { handle } = await params;
  const q = await searchParams;
  const [remote, directory, session, db] = await Promise.all([loadPerson(handle), loadDirectoryHere(), currentSession(), database()]);
  const found = db ? await builderByHandle(db, handle).catch(() => null) : null;
  // A profile started here can't share a handle with an openproduct.live one;
  // if one ever does, the openproduct.live profile wins and the row is ignored.
  const owner = found && !(found.kind === "new" && remote !== null) ? found : null;
  // A profile started here has no openproduct.live page; render it from the database.
  const fromHere = remote === null && owner?.kind === "new";
  const base = fromHere ? localPerson(owner!) : remote;
  if (base === null) notFound();
  // LB4: builds listed here count too, those they maintain, and those whose
  // repo lists their GitHub login among its contributors.
  const person = base !== "unreachable" && owner && db ? await withListingsHere(db, base, owner.accountId).catch(() => base) : base;
  const env = await appEnv();
  const [support, discussions, posts, postCount, merged] =
    db && person !== "unreachable"
      ? await Promise.all([
          builderSupportLinks(db, person.handle).catch(() => []),
          threadsStartedBy(db, person.handle).catch(() => 0),
          listArticles(db, { handle: person.handle, limit: 12, accountId: session?.account.id ?? null }).catch((): Article[] => []),
          articlesBy(db, person.handle).catch(() => 0),
          // BP7: only a profile owned by an account signed in with GitHub is counted.
          owner
            ? mergedPrsOfAccount(db, owner.accountId, person.maintainsBuilds.map((b) => b.slug), {
                fetch: (url, init) => fetch(url, init),
                auth: { token: env.GITHUB_TOKEN, clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET },
                loadRepos: loadBuildRepos,
              }).catch((): MergedPrs | null => null)
            : Promise.resolve(null),
        ])
      : [[], 0, [] as Article[], 0, null];
  const isOwner = !!owner && !!session && owner.accountId === session.account.id;
  const follow =
    db && person !== "unreachable"
      ? await followState(db, "builder", person.handle, session?.account.id ?? null).catch(() => ({ count: 0, mine: false }))
      : { count: 0, mine: false };
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
          supportLinks: support.length,
          discussions,
          posts: postCount,
          mergedPrs: merged && merged.total > 0
            ? { login: merged.login, total: merged.total, builds: Object.keys(merged.byBuild), link: searchLink(merged.login, merged.repos) }
            : null,
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
                  {fromHere ? <span className="badge">Started on this site</span> : null}
                  {person.followers + follow.count > 0 ? (
                    <span className="badge">{person.followers + follow.count} {person.followers + follow.count === 1 ? "follower" : "followers"}</span>
                  ) : null}
                  {person.githubUrl ? <a className="badge" href={person.githubUrl} rel="noopener noreferrer">GitHub</a> : null}
                  {person.siteUrl ? <a className="badge" href={person.siteUrl} rel="noopener noreferrer">Website</a> : null}
                </div>
              </div>
            </div>
            {!isOwner ? (
              <form method="post" action="/act" className="act-form person-follow">
                <input type="hidden" name="action" value="follow" />
                <input type="hidden" name="kind" value="builder" />
                <input type="hidden" name="key" value={person.handle} />
                <input type="hidden" name="next" value={`/builders/${person.handle}`} />
                <button type="submit" className={`btn btn-ghost${follow.mine ? " is-on" : ""}`}>{follow.mine ? "✓ Following" : `Follow ${person.displayName}`}</button>
              </form>
            ) : null}
            {q.claim && CLAIM_MESSAGES[q.claim] ? (
              <p className={q.claim === "done" ? "auth-ok" : "auth-error"} role="status">{CLAIM_MESSAGES[q.claim]}</p>
            ) : q.claim === "refused" && q.message ? (
              <p className="auth-error" role="status">{q.message.slice(0, 200)}</p>
            ) : null}
            {q.started ? <p className="auth-ok" role="status">Your builder profile is live.</p> : null}
            {q.deleted ? <p className="auth-ok" role="status">Post deleted.</p> : null}
            <OwnerBar person={person} owner={owner} session={session} fromHere={fromHere} />
            <SupportLinks links={support} title={`Support ${person.displayName}`} />
            <section className="person-section">
              <h2>Badges</h2>
              {badges.length > 0 ? (
                <>
                  <BadgeList badges={badges} />
                  <p className="badge-note">Every badge is worked out from public activity on openproduct and GitHub. Nobody hands them out. Each one says where it came from.</p>
                </>
              ) : (
                <p className="sample-note">No badges yet. They come from building and contributing in the open.</p>
              )}
            </section>
            <Projects projects={projectsOf(person, directory.ok ? directory.builds : [])} />
            <Posts posts={posts} total={postCount} name={person.displayName} isOwner={isOwner} />
          </>
        )}
      </main>
      <SiteFooter />
      <TabBar current="/builders" />
    </>
  );
}
