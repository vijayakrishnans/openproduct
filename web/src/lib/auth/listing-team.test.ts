import { beforeEach, describe, expect, it } from "vitest";
import { ensureSchema } from "../server/db";
import { sqliteDb } from "../server/sqlite-d1.test-helper";
import { resolveSignIn } from "./accounts";
import { startBuilder } from "./builders";
import { fetchRepoStats, refreshStats } from "./listing-stats";
import {
  answerInvite,
  buildersByGithubLogins,
  invitesFor,
  inviteMaintainer,
  listingsContributedBy,
  listingsMaintainedBy,
  makeOwner,
  removeMaintainer,
  teamOf,
} from "./listing-team";
import { createListing, getListing, isMaintainer, setPublished, type CreateDeps } from "./listings";
import { maintainedBuilds, maySetSupport } from "./support";

let db: ReturnType<typeof sqliteDb>;
const NOW = Date.parse("2026-11-10T12:00:00Z");

async function builder(id: string, login: string) {
  const a = ((await resolveSignIn(db, "github", { providerUserId: id, login, displayName: login, avatarUrl: null, email: null }, null)) as { accountId: string }).accountId;
  await startBuilder(db, a, { handle: login, displayName: login.toUpperCase(), bio: "" }, false);
  return a;
}

/** GitHub with one repo whose contributors are given (plus a bot). */
function github(contributors: string[]) {
  return {
    auth: {},
    fetch: async (url: string) => {
      if (url.includes("/contributors")) return Response.json([...contributors.map((login) => ({ login, type: "User" })), { login: "dependabot[bot]", type: "Bot" }]);
      if (url.includes("/commits")) return Response.json([]);
      if (url.includes("/languages")) return Response.json({});
      return Response.json({ private: false, owner: { login: "ada" }, topics: [], language: null });
    },
  };
}

let ada: string, bob: string, cy: string;
beforeEach(async () => {
  db = sqliteDb();
  await ensureSchema(db);
  ada = await builder("1", "ada");
  bob = await builder("2", "bob");
  cy = await builder("3", "cy");
  const deps: CreateDeps = { ...github([]), categories: [], takenThere: async () => false };
  await createListing(db, ada, { repo: "ada/tool", slug: "", tagline: "Tool", category: "dev-tools", stack: "" }, deps, NOW);
  await setPublished(db, "tool", ada, true, NOW);
});

describe("the team (LB4)", () => {
  it("an invited builder accepts, and then maintains the build: profile, badge count and support links", async () => {
    expect((await inviteMaintainer(db, "tool", ada, "@bob", NOW)).ok).toBe(true);
    expect((await invitesFor(db, bob)).map((i) => i.slug)).toEqual(["tool"]);
    // Pending isn't maintaining yet.
    expect(isMaintainer((await getListing(db, "tool"))!, bob)).toBe(false);
    expect(await listingsMaintainedBy(db, bob)).toEqual([]);
    expect((await answerInvite(db, "tool", bob, true, NOW)).ok).toBe(true);
    expect(await listingsMaintainedBy(db, bob)).toEqual([{ slug: "tool", tagline: "Tool" }]);
    expect(await maintainedBuilds(db, bob, async () => null)).toEqual(["tool"]);
    expect(await maySetSupport(db, bob, { kind: "build", key: "tool" }, async () => null)).toBe(true);
    expect(await invitesFor(db, bob)).toEqual([]);
  });

  it("declining removes the invite; nobody else can answer it", async () => {
    await inviteMaintainer(db, "tool", ada, "bob", NOW);
    expect((await answerInvite(db, "tool", cy, true, NOW)).ok).toBe(false);
    expect((await answerInvite(db, "tool", bob, false, NOW)).ok).toBe(true);
    expect((await teamOf(db, "tool")).map((m) => m.handle)).toEqual(["ada"]);
  });

  it("refuses unknown handles, duplicates, and invites from outsiders", async () => {
    expect((await inviteMaintainer(db, "tool", ada, "nobody-here", NOW)).ok).toBe(false);
    expect((await inviteMaintainer(db, "tool", cy, "bob", NOW)).ok).toBe(false);
    await inviteMaintainer(db, "tool", ada, "bob", NOW);
    expect((await inviteMaintainer(db, "tool", ada, "bob", NOW)).ok).toBe(false);
    expect((await inviteMaintainer(db, "tool", ada, "ada", NOW)).ok).toBe(false);
  });

  it("owners remove, anyone leaves, and a build always keeps an owner", async () => {
    await inviteMaintainer(db, "tool", ada, "bob", NOW);
    await answerInvite(db, "tool", bob, true, NOW);
    expect((await removeMaintainer(db, "tool", bob, ada)).ok).toBe(false);
    expect((await removeMaintainer(db, "tool", ada, ada)).ok).toBe(false);
    expect((await makeOwner(db, "tool", bob, bob)).ok).toBe(false);
    expect((await makeOwner(db, "tool", ada, bob)).ok).toBe(true);
    expect((await removeMaintainer(db, "tool", ada, ada)).ok).toBe(true);
    expect((await teamOf(db, "tool")).map((m) => [m.handle, m.role])).toEqual([["bob", "owner"]]);
  });
});

describe("contributors from the repo (LB4)", () => {
  it("reads people, not bots, and matches them to builders by GitHub login", async () => {
    const s = await fetchRepoStats("ada/tool", github(["Cy", "stranger"]), NOW);
    expect(s !== "limited" && s?.contributors).toEqual(["cy", "stranger"]);
    await refreshStats(db, "tool", "ada/tool", github(["Cy", "stranger"]), NOW);
    expect(await listingsContributedBy(db, "cy")).toEqual([{ slug: "tool", tagline: "Tool" }]);
    expect(await listingsContributedBy(db, "bob")).toEqual([]);
    expect(await buildersByGithubLogins(db, ["cy", "stranger"])).toEqual([{ handle: "cy", name: "CY", login: "cy" }]);
  });

  it("an unpublished listing counts for nobody", async () => {
    await refreshStats(db, "tool", "ada/tool", github(["cy"]), NOW);
    await setPublished(db, "tool", ada, false, NOW);
    expect(await listingsContributedBy(db, "cy")).toEqual([]);
    expect(await listingsMaintainedBy(db, ada)).toEqual([]);
  });
});
