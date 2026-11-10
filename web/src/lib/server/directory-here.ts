// The directory as this site shows it: openproduct's listings plus the
// builds listed here (list-your-build D1), with the upvotes made here added
// (OP-25), so cards, sorting and build pages agree.
import { githubDepsFor } from "../auth/github-prs";
import { allStats, refreshStale } from "../auth/listing-stats";
import { openRoleCounts, openRolesFor, rowToRole } from "../auth/listing-roles";
import { publishedListings, listingToBuild } from "../auth/listings";
import { voteCounts, withVotes } from "../auth/reactions";
import { loadDirectory, loadRoles, sortBuilds, type Build, type Directory, type OpenRole } from "../directory";
import { afterResponse, appEnv, database } from "./env";

export async function loadDirectoryHere(): Promise<Directory> {
  const [dir, db, env] = await Promise.all([loadDirectory(), database(), appEnv()]);
  if (!db) return dir;
  const [counts, published, stats, seats] = await Promise.all([
    voteCounts(db).catch(() => new Map<string, number>()),
    publishedListings(db).catch(() => []),
    allStats(db).catch(() => new Map()),
    openRoleCounts(db).catch(() => new Map<string, number>()),
  ]);
  // LB2: numbers come from the repo. Stale ones refresh after this response,
  // so the page never waits on GitHub; a repo gone private or deleted is left out.
  void afterResponse(refreshStale(db, githubDepsFor(env)));
  const listed = published.filter((l) => stats.get(l.slug)?.status !== "missing");
  const asBuild = (l: (typeof listed)[number]) => listingToBuild(l, stats.get(l.slug), seats.get(l.slug) ?? 0);
  if (!dir.ok) {
    // openproduct.live unreachable: builds listed here still show.
    return listed.length ? { ok: true, builds: withVotes(listed.map(asBuild), counts), topics: [], fetchedAt: new Date().toISOString() } : dir;
  }
  // One slug namespace; if openproduct.live ever lists the same slug, its build wins (D1).
  const theirs = new Set(dir.builds.map((b) => b.slug.toLowerCase()));
  const ours: Build[] = listed.filter((l) => !theirs.has(l.slug)).map(asBuild);
  const builds = [...dir.builds, ...ours];
  return { ...dir, builds: counts.size ? withVotes(builds, counts) : builds };
}

/**
 * Open seats across the directory (LB3): openproduct.live's, read from each
 * build's page, and the ones on builds listed here, from this database.
 * Builds are taken most active first, as before.
 */
export async function loadRolesHere(builds: Build[], limit?: number): Promise<OpenRole[]> {
  const db = await database();
  const ranked = sortBuilds(builds.filter((b) => b.roleCount > 0), "active").slice(0, limit ?? builds.length);
  const ours = ranked.filter((b) => b.source === "here");
  const [theirs, rows] = await Promise.all([
    loadRoles(ranked.filter((b) => b.source !== "here")),
    db && ours.length ? openRolesFor(db, ours.map((b) => b.slug)).catch(() => []) : Promise.resolve([]),
  ]);
  const bySlug = new Map(ours.map((b) => [b.slug, b]));
  const here: OpenRole[] = rows.flatMap((r) => {
    const b = bySlug.get(r.slug);
    if (!b) return [];
    return [{ ...rowToRole(r, b.stack.slice(0, 3)), slug: b.slug, tagline: b.tagline, repoUrl: `https://github.com/${r.repo}` }];
  });
  // Keep the build order: most active build's seats first.
  const order = new Map(ranked.map((b, i) => [b.slug, i]));
  return [...theirs, ...here].sort((a, b) => (order.get(a.slug) ?? 0) - (order.get(b.slug) ?? 0));
}
