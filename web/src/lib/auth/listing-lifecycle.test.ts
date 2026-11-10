import { beforeEach, describe, expect, it } from "vitest";
import { MIGRATIONS, ensureSchema, type Db } from "../server/db";
import { sqliteDb } from "../server/sqlite-d1.test-helper";
import { resolveSignIn } from "./accounts";
import { startBuilder } from "./builders";
import { openReports } from "./discussions";
import { DRAFT_TTL_MS, REDIRECT_TTL_MS, deleteListing, expireStale, redirectFor, renameListing, reportListing, setListingHidden } from "./listing-lifecycle";
import { addRole, rolesOf } from "./listing-roles";
import { answerInvite, inviteMaintainer } from "./listing-team";
import { createListing, getListing, publishedListings, setPublished, type CreateDeps } from "./listings";
import { followState, handsFor, toggleFollow, toggleHand, toggleVote, voteState } from "./reactions";

let db: ReturnType<typeof sqliteDb>;
const NOW = Date.parse("2026-11-10T12:00:00Z");
const DAY = 86_400_000;
const free = async () => false;

async function builder(id: string, handle: string) {
  const a = ((await resolveSignIn(db, "github", { providerUserId: id, login: handle, displayName: handle, avatarUrl: null, email: null }, null)) as { accountId: string }).accountId;
  await startBuilder(db, a, { handle, displayName: handle, bio: "" }, false);
  return a;
}
const deps = (owner: string): CreateDeps => ({ auth: {}, categories: [], takenThere: free, fetch: async () => Response.json({ private: false, owner: { login: owner }, topics: [] }) });

let ada: string, bob: string;
beforeEach(async () => {
  db = sqliteDb();
  await ensureSchema(db);
  ada = await builder("1", "ada");
  bob = await builder("2", "bob");
  await createListing(db, ada, { repo: "ada/tool", slug: "", tagline: "Tool", category: "dev-tools", stack: "" }, deps("ada"), NOW);
  await setPublished(db, "tool", ada, true, NOW);
});

describe("moderation (LB6)", () => {
  it("a reported listing hidden by a moderator leaves Open builds; restoring brings it back", async () => {
    expect(await reportListing(db, bob, "tool", "spam", NOW)).toBe(true);
    expect((await openReports(db)).map((r) => [r.kind, r.id, r.href, r.title])).toEqual([["listing", "tool", "/builds/tool", "Build: tool"]]);
    await setListingHidden(db, "tool", true, NOW);
    expect((await getListing(db, "tool"))!.state).toBe("hidden");
    expect(await publishedListings(db)).toEqual([]);
    expect(await openReports(db)).toEqual([]);
    await setListingHidden(db, "tool", false, NOW);
    expect((await publishedListings(db)).map((l) => l.slug)).toEqual(["tool"]);
  });

  it("drafts can't be reported", async () => {
    await setPublished(db, "tool", ada, false, NOW);
    expect(await reportListing(db, bob, "tool", "x", NOW)).toBe(false);
  });

  it("keeps reports made before migration 13", async () => {
    const fresh = sqliteDb();
    await fresh.prepare(`CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)`).run();
    for (const m of MIGRATIONS.filter((m) => m.version < 13)) {
      await fresh.batch([...m.statements.map((s) => fresh.prepare(s)), fresh.prepare(`INSERT INTO schema_migrations VALUES (?, ?, ?)`).bind(m.version, m.name, "x")]);
    }
    await fresh.prepare(`INSERT INTO accounts (id, created_at) VALUES ('a1', 'x')`).run();
    await fresh.prepare(`INSERT INTO reports (target_kind, target_id, reporter_account_id, created_at) VALUES ('article', 'p1', 'a1', 'x')`).run();
    await ensureSchema(fresh as Db);
    expect((await fresh.prepare(`SELECT count(*) AS n FROM reports`).first<{ n: number }>())?.n).toBe(1);
    await fresh.prepare(`INSERT INTO reports (target_kind, target_id, reporter_account_id, created_at) VALUES ('listing', 'tool', 'a1', 'x')`).run();
  });
});

describe("rename (LB6)", () => {
  it("keeps upvotes, follows, raised hands, seats and team, and the old address redirects for 30 days", async () => {
    const seat = ((await addRole(db, "tool", ada, { title: "Engineer", type: "", description: "", commitment: "" }, NOW)) as { id: string }).id;
    await inviteMaintainer(db, "tool", ada, "bob", NOW);
    await answerInvite(db, "tool", bob, true, NOW);
    await toggleVote(db, bob, "tool");
    await toggleFollow(db, bob, "build", "tool");
    await toggleHand(db, bob, "tool", seat);
    const r = await renameListing(db, "tool", ada, "Better-Tool", free, NOW);
    expect(r).toEqual({ ok: true, slug: "better-tool" });
    expect(await getListing(db, "tool")).toBeNull();
    const l = (await getListing(db, "better-tool"))!;
    expect(l.maintainers.map((m) => m.handle)).toEqual(["ada", "bob"]);
    expect((await rolesOf(db, "better-tool")).map((x) => x.id)).toEqual([seat]);
    expect((await voteState(db, "better-tool", bob)).mine).toBe(true);
    expect((await followState(db, "build", "better-tool", bob)).mine).toBe(true);
    expect((await handsFor(db, "better-tool", bob)).get(seat)?.[0]?.handle).toBe("bob");
    expect(await redirectFor(db, "tool", NOW + DAY)).toBe("better-tool");
    expect(await redirectFor(db, "tool", NOW + REDIRECT_TTL_MS + 1)).toBeNull();
  });

  it("renaming twice redirects both old names to the newest", async () => {
    await renameListing(db, "tool", ada, "tool-two", free, NOW);
    await renameListing(db, "tool-two", ada, "tool-three", free, NOW + 1);
    expect(await redirectFor(db, "tool", NOW + 2)).toBe("tool-three");
    expect(await redirectFor(db, "tool-two", NOW + 2)).toBe("tool-three");
  });

  it("only owners rename, and never onto a taken or recently used name", async () => {
    await inviteMaintainer(db, "tool", ada, "bob", NOW);
    await answerInvite(db, "tool", bob, true, NOW);
    expect((await renameListing(db, "tool", bob, "mine", free, NOW)).ok).toBe(false);
    expect((await renameListing(db, "tool", ada, "flakeless", async (s) => s === "flakeless", NOW)).ok).toBe(false);
    await createListing(db, bob, { repo: "bob/other", slug: "other", tagline: "", category: "", stack: "" }, deps("bob"), NOW);
    expect((await renameListing(db, "tool", ada, "other", free, NOW)).ok).toBe(false);
    await renameListing(db, "other", bob, "other-two", free, NOW);
    expect((await renameListing(db, "tool", ada, "other", free, NOW + DAY)).ok).toBe(false);
    expect((await renameListing(db, "tool", ada, "list", free, NOW)).ok).toBe(false);
  });
});

describe("delete and expiry (LB6)", () => {
  it("an owner deletes a listing and everything keyed by its slug", async () => {
    const seat = ((await addRole(db, "tool", ada, { title: "Engineer", type: "", description: "", commitment: "" }, NOW)) as { id: string }).id;
    await toggleVote(db, bob, "tool");
    await toggleHand(db, bob, "tool", seat);
    expect((await deleteListing(db, undefined, "tool", bob)).ok).toBe(false);
    expect((await deleteListing(db, undefined, "tool", ada)).ok).toBe(true);
    expect(await getListing(db, "tool")).toBeNull();
    expect((await voteState(db, "tool", bob)).count).toBe(0);
    expect((await handsFor(db, "tool", null)).size).toBe(0);
    expect(await rolesOf(db, "tool", { withClosed: true })).toEqual([]);
  });

  it("unverified drafts go after 14 days; verified ones stay", async () => {
    await createListing(db, bob, { repo: "acme/thing", slug: "", tagline: "", category: "", stack: "" }, deps("acme"), NOW);
    expect((await getListing(db, "thing"))!.verified).toBe(false);
    expect(await expireStale(db, NOW + DRAFT_TTL_MS - 1)).toBe(0);
    expect(await expireStale(db, NOW + DRAFT_TTL_MS + 1)).toBe(1);
    expect(await getListing(db, "thing")).toBeNull();
    expect(await getListing(db, "tool")).not.toBeNull();
  });
});
