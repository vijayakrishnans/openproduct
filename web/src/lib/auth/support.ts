// Support links stored on this site (builder-profiles BP4): who may set
// them, and reading them back. A builder sets their own; a maintainer of a
// build (per their claimed openproduct profile) sets the build's.
import type { Db } from "../server/db";
import { parseSupportLinks, storedSupportLinks, type SupportLink } from "../support-links";
import { builderByHandle, builderOfAccount } from "./builders";
import { listingsMaintainedBy } from "./listing-team";

export type SupportOwner = { kind: "builder" | "build"; key: string };

export async function supportLinksOf(db: Db, owner: SupportOwner): Promise<{ links: SupportLink[]; accountId: string | null }> {
  const rows = await db
    .prepare(`SELECT provider, url, account_id FROM support_links WHERE owner_kind = ? AND owner_key = ? ORDER BY position`)
    .bind(owner.kind, owner.key)
    .all<{ provider: string; url: string; account_id: string }>();
  return { links: storedSupportLinks(rows.results), accountId: rows.results[0]?.account_id ?? null };
}

/** Replace the whole list (an empty list clears it). Validates against the allowlist first. */
export async function saveSupportLinks(
  db: Db,
  owner: SupportOwner,
  accountId: string,
  submitted: unknown,
  now = new Date(),
): Promise<{ ok: true; links: SupportLink[] } | { ok: false; message: string }> {
  const checked = parseSupportLinks(submitted);
  if (!checked.ok) {
    return { ok: false, message: checked.index === undefined ? checked.message : `${checked.message} (link ${checked.index + 1})` };
  }
  const at = now.toISOString();
  await db.batch([
    db.prepare(`DELETE FROM support_links WHERE owner_kind = ? AND owner_key = ?`).bind(owner.kind, owner.key),
    ...checked.links.map((link, position) =>
      db
        .prepare(`INSERT INTO support_links (owner_kind, owner_key, position, provider, url, account_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .bind(owner.kind, owner.key, position, link.provider, link.url, accountId, at),
    ),
  ]);
  return { ok: true, links: checked.links };
}

/**
 * The builds an account may set support links for: those its CLAIMED
 * profile maintains on openproduct.live, and the published listings here it
 * maintains (list-your-build LB4). Both are read live, so a maintainer who
 * leaves a build loses the right with it.
 */
export async function maintainedBuilds(
  db: Db,
  accountId: string,
  maintainsOf: (handle: string) => Promise<string[] | null>,
): Promise<string[]> {
  const own = await builderOfAccount(db, accountId);
  if (!own) return [];
  const [there, here] = await Promise.all([
    own.kind === "claimed" ? maintainsOf(own.handle).then((x) => x ?? []) : Promise.resolve([] as string[]),
    listingsMaintainedBy(db, accountId).then((ls) => ls.map((l) => l.slug)),
  ]);
  return [...new Set([...there, ...here])];
}

/** May this account set links for `owner`? */
export async function maySetSupport(
  db: Db,
  accountId: string,
  owner: SupportOwner,
  maintainsOf: (handle: string) => Promise<string[] | null>,
): Promise<boolean> {
  if (owner.kind === "builder") {
    const own = await builderOfAccount(db, accountId);
    return !!own && own.handle.toLowerCase() === owner.key.toLowerCase();
  }
  const builds = await maintainedBuilds(db, accountId, maintainsOf);
  return builds.some((s) => s.toLowerCase() === owner.key.toLowerCase());
}

/**
 * A build's links, shown only while whoever set them still maintains it.
 * Without this, someone removed from a build would keep a "pay me" button
 * on it.
 */
export async function buildSupportLinks(
  db: Db,
  slug: string,
  maintainsOf: (handle: string) => Promise<string[] | null>,
): Promise<SupportLink[]> {
  const { links, accountId } = await supportLinksOf(db, { kind: "build", key: slug });
  if (!links.length || !accountId) return [];
  const builds = await maintainedBuilds(db, accountId, maintainsOf);
  return builds.some((s) => s.toLowerCase() === slug.toLowerCase()) ? links : [];
}

/** A builder's links, shown only while the profile is still theirs. */
export async function builderSupportLinks(db: Db, handle: string): Promise<SupportLink[]> {
  const [{ links, accountId }, owner] = await Promise.all([supportLinksOf(db, { kind: "builder", key: handle }), builderByHandle(db, handle)]);
  return owner && owner.accountId === accountId ? links : [];
}
