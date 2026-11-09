import { beforeEach, describe, expect, it } from "vitest";
import { ensureSchema } from "../server/db";
import { sqliteDb } from "../server/sqlite-d1.test-helper";
import { deleteAccount, resolveSignIn } from "./accounts";
import { claimBuilder, startBuilder } from "./builders";
import { builderSupportLinks, buildSupportLinks, maySetSupport, saveSupportLinks, supportLinksOf } from "./support";

let db: ReturnType<typeof sqliteDb>;
const account = async (id: string) =>
  ((await resolveSignIn(db, "github", { providerUserId: id, login: id, displayName: id, avatarUrl: null, email: null }, null)) as { accountId: string }).accountId;
// What openproduct.live says each builder maintains.
let live: Record<string, string[]>;
const maintainsOf = async (handle: string) => live[handle] ?? null;

beforeEach(async () => {
  db = sqliteDb();
  await ensureSchema(db);
  live = { rahulvarghese: ["one-project", "a-new-one"], arca: ["my-product"] };
});

describe("support links on this site", () => {
  it("saves in order with providers derived, and replaces the whole list", async () => {
    const a = await account("1");
    await claimBuilder(db, a, "rahulvarghese");
    const saved = await saveSupportLinks(db, { kind: "builder", key: "rahulvarghese" }, a, ["https://ko-fi.com/r", "", "https://github.com/sponsors/r"]);
    expect(saved).toEqual({
      ok: true,
      links: [
        { provider: "ko-fi", url: "https://ko-fi.com/r" },
        { provider: "github-sponsors", url: "https://github.com/sponsors/r" },
      ],
    });
    await saveSupportLinks(db, { kind: "builder", key: "rahulvarghese" }, a, ["https://patreon.com/r"]);
    expect((await supportLinksOf(db, { kind: "builder", key: "RahulVarghese" })).links).toEqual([{ provider: "patreon", url: "https://patreon.com/r" }]);
    await saveSupportLinks(db, { kind: "builder", key: "rahulvarghese" }, a, []);
    expect((await supportLinksOf(db, { kind: "builder", key: "rahulvarghese" })).links).toEqual([]);
  });

  it("refuses a site off the list, naming the link, and writes nothing", async () => {
    const a = await account("1");
    const r = await saveSupportLinks(db, { kind: "builder", key: "x" }, a, ["https://ko-fi.com/r", "https://pay-me.example/r"]);
    expect(r).toMatchObject({ ok: false });
    expect((r as { message: string }).message).toContain("(link 2)");
    expect((await supportLinksOf(db, { kind: "builder", key: "x" })).links).toEqual([]);
  });

  it("a builder sets only their own profile's links", async () => {
    const a = await account("1");
    const b = await account("2");
    await claimBuilder(db, a, "rahulvarghese");
    await startBuilder(db, b, { handle: "bea", displayName: "Bea", bio: "" }, false);
    expect(await maySetSupport(db, a, { kind: "builder", key: "rahulvarghese" }, maintainsOf)).toBe(true);
    expect(await maySetSupport(db, a, { kind: "builder", key: "bea" }, maintainsOf)).toBe(false);
    expect(await maySetSupport(db, b, { kind: "builder", key: "rahulvarghese" }, maintainsOf)).toBe(false);
  });

  it("a build's links are set by a claimed maintainer only", async () => {
    const a = await account("1");
    const b = await account("2");
    const c = await account("3");
    await claimBuilder(db, a, "rahulvarghese");
    await claimBuilder(db, b, "arca");
    await startBuilder(db, c, { handle: "one-project", displayName: "Squatter", bio: "" }, false);
    expect(await maySetSupport(db, a, { kind: "build", key: "one-project" }, maintainsOf)).toBe(true);
    expect(await maySetSupport(db, b, { kind: "build", key: "one-project" }, maintainsOf)).toBe(false);
    // A profile started here maintains nothing on openproduct.live.
    expect(await maySetSupport(db, c, { kind: "build", key: "one-project" }, maintainsOf)).toBe(false);
  });

  it("a build's links stop showing when whoever set them stops maintaining it", async () => {
    const a = await account("1");
    await claimBuilder(db, a, "rahulvarghese");
    await saveSupportLinks(db, { kind: "build", key: "one-project" }, a, ["https://opencollective.com/one-project"]);
    expect(await buildSupportLinks(db, "one-project", maintainsOf)).toHaveLength(1);
    live.rahulvarghese = ["a-new-one"];
    expect(await buildSupportLinks(db, "one-project", maintainsOf)).toEqual([]);
  });

  it("deleting the account deletes the links it set", async () => {
    const a = await account("1");
    await claimBuilder(db, a, "rahulvarghese");
    await saveSupportLinks(db, { kind: "builder", key: "rahulvarghese" }, a, ["https://ko-fi.com/r"]);
    await deleteAccount(db, a);
    expect(await builderSupportLinks(db, "rahulvarghese")).toEqual([]);
    expect(db.raw.prepare("SELECT count(*) AS n FROM support_links").get()).toEqual({ n: 0 });
  });

  it("the schema refuses a fifth slot", async () => {
    const a = await account("1");
    expect(() =>
      db.raw
        .prepare("INSERT INTO support_links VALUES ('builder','x',4,'patreon','https://patreon.com/x',?, 'now')")
        .run(a),
    ).toThrow(/CHECK/);
  });
});
