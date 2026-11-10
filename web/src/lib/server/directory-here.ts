// The directory as this site shows it: openproduct's listings plus the
// builds listed here (list-your-build D1), with the upvotes made here added
// (OP-25), so cards, sorting and build pages agree.
import { githubDepsFor } from "../auth/github-prs";
import { allStats, refreshStale } from "../auth/listing-stats";
import { publishedListings, listingToBuild } from "../auth/listings";
import { voteCounts, withVotes } from "../auth/reactions";
import { loadDirectory, type Build, type Directory } from "../directory";
import { afterResponse, appEnv, database } from "./env";

export async function loadDirectoryHere(): Promise<Directory> {
  const [dir, db, env] = await Promise.all([loadDirectory(), database(), appEnv()]);
  if (!db) return dir;
  const [counts, published, stats] = await Promise.all([
    voteCounts(db).catch(() => new Map<string, number>()),
    publishedListings(db).catch(() => []),
    allStats(db).catch(() => new Map()),
  ]);
  // LB2: numbers come from the repo. Stale ones refresh after this response,
  // so the page never waits on GitHub; a repo gone private or deleted is left out.
  void afterResponse(refreshStale(db, githubDepsFor(env)));
  const listed = published.filter((l) => stats.get(l.slug)?.status !== "missing");
  const asBuild = (l: (typeof listed)[number]) => listingToBuild(l, stats.get(l.slug));
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
