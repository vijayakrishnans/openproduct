// Who runs a build listed here (list-your-build LB4, design D6/D7).
// Maintainers invite other builders by handle; an invite waits until the
// invitee accepts. Owners can remove maintainers, anyone can leave, and a
// listing always keeps an owner. Contributors aren't invited: they're the
// repo's own contributors on GitHub, matched to builders by GitHub login.
import type { Db } from "../server/db";
import { builderByHandle } from "./builders";
import { getListing, isMaintainer } from "./listings";

export const MAX_MAINTAINERS = 10;

type Write = { ok: true } | { ok: false; message: string };

export type TeamMember = { accountId: string; handle: string | null; name: string | null; role: "owner" | "maintainer"; pending: boolean };

/** Everyone on a listing's team, invites included, owners first. */
export async function teamOf(db: Db, slug: string): Promise<TeamMember[]> {
  const rows = await db
    .prepare(
      `SELECT m.account_id, m.role, m.accepted_at, b.handle, b.display_name FROM listing_maintainers m
         LEFT JOIN builders b ON b.account_id = m.account_id
        WHERE m.slug = ? ORDER BY m.accepted_at IS NULL, m.role = 'owner' DESC, coalesce(m.accepted_at, m.invited_at)`,
    )
    .bind(slug.toLowerCase())
    .all<{ account_id: string; role: "owner" | "maintainer"; accepted_at: string | null; handle: string | null; display_name: string | null }>();
  return rows.results.map((r) => ({ accountId: r.account_id, handle: r.handle, name: r.display_name ?? r.handle, role: r.role, pending: !r.accepted_at }));
}

export async function inviteMaintainer(db: Db, slug: string, inviter: string, handle: string, now = Date.now()): Promise<Write> {
  const l = await getListing(db, slug);
  if (!l || !isMaintainer(l, inviter)) return { ok: false, message: "That listing isn't yours." };
  const who = await builderByHandle(db, handle.trim().replace(/^@/, "")).catch(() => null);
  if (!who) return { ok: false, message: "There's no builder with that handle here." };
  const team = await teamOf(db, l.slug);
  if (team.some((m) => m.accountId === who.accountId)) return { ok: false, message: `@${who.handle} is already on the team${team.find((m) => m.accountId === who.accountId)?.pending ? " (invited)" : ""}.` };
  if (team.length >= MAX_MAINTAINERS) return { ok: false, message: `A build can have ${MAX_MAINTAINERS} maintainers.` };
  await db
    .prepare(`INSERT INTO listing_maintainers (slug, account_id, role, accepted_at, invited_at) VALUES (?, ?, 'maintainer', NULL, ?)`)
    .bind(l.slug, who.accountId, new Date(now).toISOString())
    .run();
  return { ok: true };
}

/** Accept or decline an invite. Only the invitee can. */
export async function answerInvite(db: Db, slug: string, accountId: string, accept: boolean, now = Date.now()): Promise<Write> {
  const row = await db
    .prepare(`SELECT accepted_at FROM listing_maintainers WHERE slug = ? AND account_id = ?`)
    .bind(slug.toLowerCase(), accountId)
    .first<{ accepted_at: string | null }>();
  if (!row || row.accepted_at) return { ok: false, message: "There's no invite waiting for you there." };
  if (accept) {
    await db.prepare(`UPDATE listing_maintainers SET accepted_at = ? WHERE slug = ? AND account_id = ?`).bind(new Date(now).toISOString(), slug.toLowerCase(), accountId).run();
  } else {
    await db.prepare(`DELETE FROM listing_maintainers WHERE slug = ? AND account_id = ?`).bind(slug.toLowerCase(), accountId).run();
  }
  return { ok: true };
}

/** Remove someone (an owner may remove anyone, anyone may leave), never the last owner. */
export async function removeMaintainer(db: Db, slug: string, actor: string, target: string): Promise<Write> {
  const team = await teamOf(db, slug);
  const me = team.find((m) => m.accountId === actor && !m.pending);
  const them = team.find((m) => m.accountId === target);
  if (!me || !them) return { ok: false, message: "That isn't someone on your team." };
  if (actor !== target && me.role !== "owner") return { ok: false, message: "Only an owner can remove someone else." };
  const owners = team.filter((m) => m.role === "owner" && !m.pending);
  if (them.role === "owner" && owners.length <= 1) return { ok: false, message: "A build needs an owner. Make someone else an owner first, or delete the listing." };
  await db.prepare(`DELETE FROM listing_maintainers WHERE slug = ? AND account_id = ?`).bind(slug.toLowerCase(), target).run();
  return { ok: true };
}

/** Make a maintainer an owner (owners only), so a team can hand a build over. */
export async function makeOwner(db: Db, slug: string, actor: string, target: string): Promise<Write> {
  const team = await teamOf(db, slug);
  const me = team.find((m) => m.accountId === actor && !m.pending);
  const them = team.find((m) => m.accountId === target && !m.pending);
  if (!me || me.role !== "owner" || !them) return { ok: false, message: "Only an owner can do that." };
  await db.prepare(`UPDATE listing_maintainers SET role = 'owner' WHERE slug = ? AND account_id = ?`).bind(slug.toLowerCase(), target).run();
  return { ok: true };
}

export type Invite = { slug: string; repo: string; tagline: string | null; invitedAt: string | null };

/** Invites waiting for an account, newest first. */
export async function invitesFor(db: Db, accountId: string): Promise<Invite[]> {
  const rows = await db
    .prepare(
      `SELECT l.slug, l.repo, l.tagline, m.invited_at FROM listing_maintainers m JOIN listings l ON l.slug = m.slug
        WHERE m.account_id = ? AND m.accepted_at IS NULL AND l.state != 'hidden' ORDER BY m.invited_at DESC`,
    )
    .bind(accountId)
    .all<{ slug: string; repo: string; tagline: string | null; invited_at: string | null }>();
  return rows.results.map((r) => ({ slug: r.slug, repo: r.repo, tagline: r.tagline, invitedAt: r.invited_at }));
}

/** Published listings an account maintains (accepted), for badges, projects and support links. */
export async function listingsMaintainedBy(db: Db, accountId: string): Promise<{ slug: string; tagline: string }[]> {
  const rows = await db
    .prepare(
      `SELECT l.slug, coalesce(l.tagline, '') AS tagline FROM listing_maintainers m JOIN listings l ON l.slug = m.slug
        WHERE m.account_id = ? AND m.accepted_at IS NOT NULL AND l.state = 'published' ORDER BY l.published_at`,
    )
    .bind(accountId)
    .all<{ slug: string; tagline: string }>();
  return rows.results;
}

/** Published listings whose repo lists this GitHub login among its contributors. */
export async function listingsContributedBy(db: Db, login: string): Promise<{ slug: string; tagline: string }[]> {
  const rows = await db
    .prepare(
      `SELECT l.slug, coalesce(l.tagline, '') AS tagline FROM listings l JOIN listing_stats s ON s.slug = l.slug, json_each(s.contributors) c
        WHERE l.state = 'published' AND s.status = 'ok' AND lower(c.value) = lower(?) ORDER BY l.published_at`,
    )
    .bind(login)
    .all<{ slug: string; tagline: string }>();
  return rows.results;
}

/** Builders here whose GitHub login is among these, for a build's contributor list. */
export async function buildersByGithubLogins(db: Db, logins: string[]): Promise<{ handle: string; name: string; login: string }[]> {
  if (!logins.length) return [];
  const rows = await db
    .prepare(
      `SELECT b.handle, b.display_name, lower(i.login) AS login FROM identities i JOIN builders b ON b.account_id = i.account_id
        WHERE i.provider = 'github' AND lower(i.login) IN (${logins.map(() => "?").join(", ")}) ORDER BY b.handle`,
    )
    .bind(...logins.map((l) => l.toLowerCase()))
    .all<{ handle: string; display_name: string | null; login: string }>();
  return rows.results.map((r) => ({ handle: r.handle, name: r.display_name ?? r.handle, login: r.login }));
}
