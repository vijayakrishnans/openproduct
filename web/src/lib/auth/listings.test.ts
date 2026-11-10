import { beforeEach, describe, expect, it } from "vitest";
import { ensureSchema } from "../server/db";
import { sqliteDb } from "../server/sqlite-d1.test-helper";
import { resolveSignIn } from "./accounts";
import { startBuilder } from "./builders";
import {
  LISTINGS_PER_DAY,
  checkSlug,
  createListing,
  getListing,
  listingToBuild,
  listingsOfAccount,
  missingForPublish,
  parseRepo,
  publishedListings,
  setPublished,
  updateListing,
  verifyListing,
  type CreateDeps,
} from "./listings";

let db: ReturnType<typeof sqliteDb>;
const NOW = Date.parse("2026-11-10T12:00:00Z");

/** A fake GitHub: public repos by name, and the .openproduct file per repo. */
function github(repos: Record<string, { owner: string; private?: boolean }>, files: Record<string, string> = {}): CreateDeps {
  return {
    auth: {},
    categories: ["dev-tools", "productivity"],
    takenThere: async (slug) => slug === "flakeless",
    fetch: async (url) => {
      const m = /repos\/([^/]+\/[^/]+)(\/contents\/\.openproduct)?$/.exec(url);
      const repo = m?.[1]?.toLowerCase() ?? "";
      if (m?.[2]) {
        return files[repo] === undefined
          ? new Response("{}", { status: 404 })
          : Response.json({ encoding: "base64", size: files[repo]!.length, content: btoa(files[repo]!) });
      }
      const r = repos[repo];
      if (!r || r.private) return new Response("{}", { status: 404 });
      return Response.json({ private: false, owner: { login: r.owner }, description: "A thing", license: { spdx_id: "MIT" }, language: "TypeScript", topics: ["workers"], archived: false });
    },
  };
}

const signIn = async (id: string, provider: "github" | "orunbase", login: string | null, handle: string) => {
  const a = ((await resolveSignIn(db, provider, { providerUserId: id, login, displayName: handle, avatarUrl: null, email: null }, null)) as { accountId: string }).accountId;
  await startBuilder(db, a, { handle, displayName: handle, bio: "" }, false);
  return a;
};
const input = (over: Partial<{ repo: string; slug: string; tagline: string; category: string; stack: string }> = {}) => ({
  repo: "github.com/ada/rateboard-two",
  slug: "",
  tagline: "",
  category: "",
  stack: "",
  ...over,
});

beforeEach(async () => {
  db = sqliteDb();
  await ensureSchema(db);
});

describe("parsing", () => {
  it("reads repos from every way people paste them", () => {
    for (const raw of ["ada/thing", "github.com/ada/thing", "https://github.com/Ada/Thing", "https://github.com/ada/thing.git", "git@github.com:ada/thing.git", "https://github.com/ada/thing/tree/main"]) {
      expect(parseRepo(raw), raw).toBe("ada/thing");
    }
    for (const bad of ["thing", "https://gitlab.com/ada/thing", "https://github.com/ada", "ada/../etc", "ada/."]) expect(parseRepo(bad), bad).toBeNull();
  });
  it("keeps names short, simple and unreserved", () => {
    expect(checkSlug(" My-Build ")).toEqual({ ok: true, slug: "my-build" });
    for (const bad of ["a", "has space", "double--hyphen", "-start", "list", "new", "x".repeat(41)]) expect(checkSlug(bad).ok, bad).toBe(false);
  });
});

describe("listing a build (LB1)", () => {
  it("verifies at once when your GitHub login owns the repo, and publishes once it has a tagline and category", async () => {
    const ada = await signIn("1", "github", "ada", "ada");
    const r = await createListing(db, ada, input(), github({ "ada/rateboard-two": { owner: "Ada" } }), NOW);
    expect(r).toEqual({ ok: true, slug: "rateboard-two" });
    const l = (await getListing(db, "rateboard-two"))!;
    expect(l).toMatchObject({ state: "draft", verified: true, licence: "MIT", stack: ["typescript", "workers"], description: "A thing" });
    expect(missingForPublish(l)).toEqual(["Write a tagline", "Pick a category"]);
    expect((await setPublished(db, l.slug, ada, true, NOW)).ok).toBe(false);
    expect((await updateListing(db, l.slug, ada, { tagline: "Rates boards", category: "dev-tools", stack: "go" }, ["dev-tools"], NOW)).ok).toBe(true);
    expect((await setPublished(db, l.slug, ada, true, NOW)).ok).toBe(true);
    const pub = await publishedListings(db);
    expect(pub.map((x) => x.slug)).toEqual(["rateboard-two"]);
    expect(listingToBuild(pub[0]!)).toMatchObject({ slug: "rateboard-two", tagline: "Rates boards", category: "dev-tools", licence: "MIT", source: "here" });
  });

  it("someone else's repo stays unverified until the .openproduct file holds the code", async () => {
    const bob = await signIn("2", "orunbase", null, "bob");
    const gh = github({ "acme/tool": { owner: "acme" } });
    await createListing(db, bob, input({ repo: "acme/tool", tagline: "T", category: "dev-tools" }), gh, NOW);
    const l = (await getListing(db, "tool"))!;
    expect(l.verified).toBe(false);
    expect((await verifyListing(db, "tool", bob, gh, NOW)).ok).toBe(false);
    expect((await verifyListing(db, "tool", bob, github({ "acme/tool": { owner: "acme" } }, { "acme/tool": "wrong-code\n" }), NOW)).ok).toBe(false);
    expect((await verifyListing(db, "tool", bob, github({ "acme/tool": { owner: "acme" } }, { "acme/tool": `${l.verifyCode}\n` }), NOW)).ok).toBe(true);
    expect((await getListing(db, "tool"))!.verified).toBe(true);
    expect((await setPublished(db, "tool", bob, true, NOW)).ok).toBe(true);
  });

  it("refuses private repos, a repo listed twice, and names taken here or on openproduct.live", async () => {
    const ada = await signIn("1", "github", "ada", "ada");
    const gh = github({ "ada/secret": { owner: "ada", private: true }, "ada/one": { owner: "ada" }, "ada/flakeless": { owner: "ada" } });
    expect(await createListing(db, ada, input({ repo: "ada/secret" }), gh, NOW)).toMatchObject({ ok: false, message: expect.stringContaining("private") });
    expect((await createListing(db, ada, input({ repo: "ada/one" }), gh, NOW)).ok).toBe(true);
    expect(await createListing(db, ada, input({ repo: "ada/one", slug: "other" }), gh, NOW)).toMatchObject({ ok: false, message: expect.stringContaining("already listed") });
    expect(await createListing(db, ada, input({ repo: "ada/flakeless" }), gh, NOW)).toMatchObject({ ok: false, message: expect.stringContaining("openproduct") });
  });

  it("only maintainers can verify, edit or publish, and only builders can list", async () => {
    const plain = ((await resolveSignIn(db, "github", { providerUserId: "9", login: "zed", displayName: null, avatarUrl: null, email: null }, null)) as { accountId: string }).accountId;
    const gh = github({ "ada/one": { owner: "ada" } });
    expect((await createListing(db, plain, input({ repo: "ada/one" }), gh, NOW)).ok).toBe(false);
    const ada = await signIn("1", "github", "ada", "ada");
    const eve = await signIn("3", "github", "eve", "eve");
    await createListing(db, ada, input({ repo: "ada/one", tagline: "T", category: "dev-tools" }), gh, NOW);
    expect((await setPublished(db, "one", eve, true, NOW)).ok).toBe(false);
    expect((await updateListing(db, "one", eve, { tagline: "Mine", category: "", stack: "" }, [], NOW)).ok).toBe(false);
    expect((await verifyListing(db, "one", eve, gh, NOW)).ok).toBe(false);
    expect((await listingsOfAccount(db, ada)).map((l) => l.slug)).toEqual(["one"]);
    expect(await listingsOfAccount(db, eve)).toEqual([]);
  });

  it("limits listings a day per account", async () => {
    const ada = await signIn("1", "github", "ada", "ada");
    const repos = Object.fromEntries(Array.from({ length: LISTINGS_PER_DAY + 1 }, (_, i) => [`ada/r${i}`, { owner: "ada" }]));
    for (let i = 0; i < LISTINGS_PER_DAY; i++) expect((await createListing(db, ada, input({ repo: `ada/r${i}` }), github(repos), NOW + i)).ok).toBe(true);
    expect((await createListing(db, ada, input({ repo: `ada/r${LISTINGS_PER_DAY}` }), github(repos), NOW + 10)).ok).toBe(false);
  });

  it("refuses a category that isn't one of the directory's", async () => {
    const ada = await signIn("1", "github", "ada", "ada");
    expect((await createListing(db, ada, input({ category: "made-up" }), github({ "ada/rateboard-two": { owner: "ada" } }), NOW)).ok).toBe(false);
  });
});
