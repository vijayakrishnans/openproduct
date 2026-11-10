import { beforeEach, describe, expect, it } from "vitest";
import { ensureSchema } from "../server/db";
import { sqliteDb } from "../server/sqlite-d1.test-helper";
import { resolveSignIn } from "./accounts";
import { startBuilder } from "./builders";
import { MAX_ROLES, addRole, openRoleCounts, openRolesFor, rolesOf, setRoleOpen, updateRole } from "./listing-roles";
import { createListing, getListing, listingToBuild, listingToDetail, type CreateDeps } from "./listings";
import { handsFor, toggleHand } from "./reactions";

let db: ReturnType<typeof sqliteDb>;
const NOW = Date.parse("2026-11-10T12:00:00Z");
const seat = (over: Partial<{ title: string; type: string; description: string; commitment: string }> = {}) => ({
  title: "Frontend engineer",
  type: "",
  description: "",
  commitment: "",
  ...over,
});

async function builder(id: string, handle: string) {
  const a = ((await resolveSignIn(db, "github", { providerUserId: id, login: handle, displayName: handle, avatarUrl: null, email: null }, null)) as { accountId: string }).accountId;
  await startBuilder(db, a, { handle, displayName: handle, bio: "" }, false);
  return a;
}

let ada: string;
beforeEach(async () => {
  db = sqliteDb();
  await ensureSchema(db);
  ada = await builder("1", "ada");
  const deps: CreateDeps = {
    auth: {},
    categories: [],
    takenThere: async () => false,
    fetch: async () => Response.json({ private: false, owner: { login: "ada" }, topics: [], language: "TypeScript" }),
  };
  await createListing(db, ada, { repo: "ada/tool", slug: "", tagline: "T", category: "dev-tools", stack: "typescript, workers" }, deps, NOW);
});

describe("open seats on listings (LB3)", () => {
  it("a maintainer adds a seat; its kind is read from the title unless picked", async () => {
    const r = await addRole(db, "tool", ada, seat({ commitment: "A few hours a week" }), NOW);
    expect(r.ok).toBe(true);
    await addRole(db, "tool", ada, seat({ title: "Someone to try it", type: "design-partner" }), NOW + 1);
    const roles = await rolesOf(db, "tool", { skills: ["typescript", "workers"] });
    expect(roles.map((x) => [x.title, x.type, x.open])).toEqual([
      ["Frontend engineer", "engineering", true],
      ["Someone to try it", "design-partner", true],
    ]);
    expect(roles[0]).toMatchObject({ commitment: "A few hours a week", skills: ["typescript", "workers"], slug: "tool" });
  });

  it("closed seats leave counts and listings but stay in the settings", async () => {
    const r = await addRole(db, "tool", ada, seat(), NOW);
    const id = (r as { id: string }).id;
    expect((await openRoleCounts(db)).get("tool")).toBe(1);
    await setRoleOpen(db, id, ada, false, NOW);
    expect((await openRoleCounts(db)).get("tool")).toBeUndefined();
    expect(await rolesOf(db, "tool")).toEqual([]);
    expect((await rolesOf(db, "tool", { withClosed: true }))[0]?.open).toBe(false);
    await setRoleOpen(db, id, ada, true, NOW);
    expect((await openRolesFor(db, ["tool"])).map((x) => [x.id, x.repo])).toEqual([[id, "ada/tool"]]);
  });

  it("only maintainers add, edit or close seats", async () => {
    const eve = await builder("2", "eve");
    expect((await addRole(db, "tool", eve, seat(), NOW)).ok).toBe(false);
    const id = ((await addRole(db, "tool", ada, seat(), NOW)) as { id: string }).id;
    expect((await updateRole(db, id, eve, seat({ title: "Mine" }), NOW)).ok).toBe(false);
    expect((await setRoleOpen(db, id, eve, false, NOW)).ok).toBe(false);
    expect((await updateRole(db, id, ada, seat({ title: "Backend engineer" }), NOW)).ok).toBe(true);
    expect((await rolesOf(db, "tool"))[0]?.title).toBe("Backend engineer");
  });

  it("refuses empty or oversized seats, and caps seats per build", async () => {
    expect((await addRole(db, "tool", ada, seat({ title: " " }), NOW)).ok).toBe(false);
    expect((await addRole(db, "tool", ada, seat({ title: "x".repeat(81) }), NOW)).ok).toBe(false);
    expect((await addRole(db, "tool", ada, seat({ description: "x".repeat(601) }), NOW)).ok).toBe(false);
    for (let i = 0; i < MAX_ROLES; i++) expect((await addRole(db, "tool", ada, seat({ title: `Seat ${i}` }), NOW + i)).ok).toBe(true);
    expect((await addRole(db, "tool", ada, seat({ title: "One more" }), NOW)).ok).toBe(false);
  });

  it("seats count on the card, show on the page, and take raised hands", async () => {
    const id = ((await addRole(db, "tool", ada, seat(), NOW)) as { id: string }).id;
    const l = (await getListing(db, "tool"))!;
    const roles = await rolesOf(db, "tool");
    expect(listingToBuild(l, null, 1).roleCount).toBe(1);
    expect(listingToDetail(l, null, roles).roles.map((r) => r.id)).toEqual([id]);
    const sam = await builder("3", "sam");
    expect(await toggleHand(db, sam, "tool", id)).toEqual({ ok: true, raised: true });
    expect((await handsFor(db, "tool", null)).get(id)?.map((h) => h.handle)).toEqual(["sam"]);
  });
});
