// Open seats on builds listed here (list-your-build LB3). Maintainers add,
// edit, close and reopen them; they show on the build page, /roles and the
// home sidebar like openproduct.live's, and builders raise a hand for them
// (OP-25). A closed seat is kept, so links and raised hands still resolve.
import type { Db } from "../server/db";
import type { Role } from "../directory";
import { ROLE_TYPES, roleType, type RoleType } from "../roles";
import { randomToken } from "./crypto";
import { getListing, isMaintainer } from "./listings";

export const MAX_ROLE_TITLE = 80;
export const MAX_ROLE_DESCRIPTION = 600;
export const MAX_ROLE_COMMITMENT = 80;
/** Seats per listing, open or closed: a build hiring forty people isn't a side project. */
export const MAX_ROLES = 12;

export type ListingRole = Role & { slug: string; open: boolean };
export type RoleInput = { title: string; type: string; description: string; commitment: string };
type Write = { ok: true; id: string } | { ok: false; message: string };

function check(input: RoleInput): { ok: true; title: string; type: RoleType; description: string | null; commitment: string | null } | { ok: false; message: string } {
  const title = input.title.trim().replace(/\s+/g, " ");
  if (!title) return { ok: false, message: "Give the seat a title." };
  if (title.length > MAX_ROLE_TITLE) return { ok: false, message: `A seat's title is at most ${MAX_ROLE_TITLE} characters.` };
  const description = input.description.trim();
  if (description.length > MAX_ROLE_DESCRIPTION) return { ok: false, message: `A description is at most ${MAX_ROLE_DESCRIPTION} characters.` };
  const commitment = input.commitment.trim().replace(/\s+/g, " ");
  if (commitment.length > MAX_ROLE_COMMITMENT) return { ok: false, message: `Time is at most ${MAX_ROLE_COMMITMENT} characters.` };
  // A type the maintainer picked, or one read from the title like openproduct.live's seats.
  const type = (ROLE_TYPES as readonly string[]).includes(input.type) ? (input.type as RoleType) : roleType(title);
  return { ok: true, title, type, description: description || null, commitment: commitment || null };
}

async function mayEdit(db: Db, slug: string, accountId: string): Promise<boolean> {
  const l = await getListing(db, slug);
  return !!l && isMaintainer(l, accountId) && l.state !== "hidden";
}

export async function addRole(db: Db, slug: string, accountId: string, input: RoleInput, now = Date.now()): Promise<Write> {
  if (!(await mayEdit(db, slug, accountId))) return { ok: false, message: "That listing isn't yours." };
  const c = check(input);
  if (!c.ok) return c;
  const n = await db.prepare(`SELECT count(*) AS n FROM listing_roles WHERE slug = ?`).bind(slug).first<{ n: number }>();
  if ((n?.n ?? 0) >= MAX_ROLES) return { ok: false, message: `A build can have ${MAX_ROLES} seats. Remove a closed one first.` };
  const id = `lr_${randomToken(12).replace(/[^A-Za-z0-9]/g, "x")}`;
  const at = new Date(now).toISOString();
  await db
    .prepare(`INSERT INTO listing_roles (id, slug, title, type, description, commitment, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, slug, c.title, c.type, c.description, c.commitment, at, at)
    .run();
  return { ok: true, id };
}

async function roleSlug(db: Db, id: string): Promise<string | null> {
  if (!/^lr_[A-Za-z0-9]{1,32}$/.test(id)) return null;
  return (await db.prepare(`SELECT slug FROM listing_roles WHERE id = ?`).bind(id).first<{ slug: string }>())?.slug ?? null;
}

export async function updateRole(db: Db, id: string, accountId: string, input: RoleInput, now = Date.now()): Promise<Write> {
  const slug = await roleSlug(db, id);
  if (!slug || !(await mayEdit(db, slug, accountId))) return { ok: false, message: "That seat isn't yours to edit." };
  const c = check(input);
  if (!c.ok) return c;
  await db
    .prepare(`UPDATE listing_roles SET title = ?, type = ?, description = ?, commitment = ?, updated_at = ? WHERE id = ?`)
    .bind(c.title, c.type, c.description, c.commitment, new Date(now).toISOString(), id)
    .run();
  return { ok: true, id };
}

export async function setRoleOpen(db: Db, id: string, accountId: string, open: boolean, now = Date.now()): Promise<Write> {
  const slug = await roleSlug(db, id);
  if (!slug || !(await mayEdit(db, slug, accountId))) return { ok: false, message: "That seat isn't yours to change." };
  await db.prepare(`UPDATE listing_roles SET open = ?, updated_at = ? WHERE id = ?`).bind(open ? 1 : 0, new Date(now).toISOString(), id).run();
  return { ok: true, id };
}

type Row = { id: string; slug: string; title: string; type: string; description: string | null; commitment: string | null; open: number };

function toRole(r: Row, skills: string[]): ListingRole {
  const type = (ROLE_TYPES as readonly string[]).includes(r.type) ? (r.type as RoleType) : roleType(r.title);
  return { id: r.id, slug: r.slug, title: r.title, type, description: r.description, commitment: r.commitment, skills, open: r.open === 1 };
}

/** A listing's seats, open first then closed (closed only when asked for, for its settings). */
export async function rolesOf(db: Db, slug: string, opts: { withClosed?: boolean; skills?: string[] } = {}): Promise<ListingRole[]> {
  const rows = await db
    .prepare(`SELECT * FROM listing_roles WHERE slug = ? ${opts.withClosed ? "" : "AND open = 1"} ORDER BY open DESC, created_at`)
    .bind(slug.toLowerCase())
    .all<Row>();
  return rows.results.map((r) => toRole(r, (opts.skills ?? []).slice(0, 3)));
}

/** Open seats per listing, for cards and the "Roles" sort. */
export async function openRoleCounts(db: Db): Promise<Map<string, number>> {
  const rows = await db.prepare(`SELECT slug, count(*) AS n FROM listing_roles WHERE open = 1 GROUP BY slug`).all<{ slug: string; n: number }>();
  return new Map(rows.results.map((r) => [r.slug, r.n]));
}

/** Every open seat on these listings (published ones, from the caller), oldest first, with each listing's repo. */
export async function openRolesFor(db: Db, slugs: string[]): Promise<(Row & { repo: string })[]> {
  if (!slugs.length) return [];
  const rows = await db
    .prepare(
      `SELECT r.*, l.repo FROM listing_roles r JOIN listings l ON l.slug = r.slug
        WHERE r.open = 1 AND r.slug IN (${slugs.map(() => "?").join(", ")}) ORDER BY r.created_at`,
    )
    .bind(...slugs)
    .all<Row & { repo: string }>();
  return rows.results;
}

export { toRole as rowToRole };
export type { Row as ListingRoleRow };
