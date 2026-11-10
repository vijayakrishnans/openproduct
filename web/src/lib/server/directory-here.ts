// The directory as this site shows it (OP-25): openproduct's listings, with
// the upvotes made here added, so cards, sorting and build pages agree.
import { voteCounts, withVotes } from "../auth/reactions";
import { loadDirectory, type Directory } from "../directory";
import { database } from "./env";

export async function loadDirectoryHere(): Promise<Directory> {
  const [dir, db] = await Promise.all([loadDirectory(), database()]);
  if (!dir.ok || !db) return dir;
  const counts = await voteCounts(db).catch(() => new Map<string, number>());
  return counts.size ? { ...dir, builds: withVotes(dir.builds, counts) } : dir;
}
