// The directory as this site shows it: openproduct's listings plus the
// builds listed here (list-your-build D1), with the upvotes made here added
// (OP-25), so cards, sorting and build pages agree.
import { publishedListings, listingToBuild } from "../auth/listings";
import { voteCounts, withVotes } from "../auth/reactions";
import { loadDirectory, type Build, type Directory } from "../directory";
import { database } from "./env";

export async function loadDirectoryHere(): Promise<Directory> {
  const [dir, db] = await Promise.all([loadDirectory(), database()]);
  if (!db) return dir;
  const [counts, listed] = await Promise.all([
    voteCounts(db).catch(() => new Map<string, number>()),
    publishedListings(db).catch(() => []),
  ]);
  if (!dir.ok) {
    // openproduct.live unreachable: builds listed here still show.
    return listed.length ? { ok: true, builds: withVotes(listed.map(listingToBuild), counts), topics: [], fetchedAt: new Date().toISOString() } : dir;
  }
  // One slug namespace; if openproduct.live ever lists the same slug, its build wins (D1).
  const theirs = new Set(dir.builds.map((b) => b.slug.toLowerCase()));
  const ours: Build[] = listed.filter((l) => !theirs.has(l.slug)).map(listingToBuild);
  const builds = [...dir.builds, ...ours];
  return { ...dir, builds: counts.size ? withVotes(builds, counts) : builds };
}
