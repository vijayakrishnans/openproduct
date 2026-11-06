import { describe, expect, it } from "vitest";
import { activity, belowFloor, listable, samplePieces, sortBuilds, toBuild } from "./directory";

const product = (slug: string, extra: Record<string, unknown> = {}) => ({
  slug,
  tagline: { value: `${slug} does a thing`, provenance: {} },
  category: { value: "dev-tools" },
  licence: { value: "MIT" },
  openRoles: { value: 2 },
  publishedAt: "2026-10-01T00:00:00.000Z",
  metrics: { "merges.7d": { value: 3 }, "endorsements.total": { value: 4 } },
  ...extra,
});

describe("toBuild", () => {
  it("reads the API's value-wrapped fields", () => {
    const b = toBuild(product("sunsetd"))!;
    expect(b).toMatchObject({ slug: "sunsetd", tagline: "sunsetd does a thing", category: "dev-tools", licence: "MIT", changes7d: 3, upvotes: 4, roleCount: 2 });
    expect(b.sample).toEqual(["pieces"]);
  });

  it("is tolerant: missing fields are blanks, a missing slug is no build", () => {
    expect(toBuild({ slug: "bare" })).toMatchObject({ tagline: "", category: null, changes7d: 0, upvotes: 0, roleCount: 0 });
    expect(toBuild({})).toBeNull();
  });

  it("counts a detail's openings over the list's openRoles", () => {
    expect(toBuild(product("a", { openings: [{}, {}, {}] }))!.roleCount).toBe(3);
  });

  it("leaves unfinished drafts out of the directory", () => {
    expect(listable(toBuild({ slug: "draft" })!)).toBe(false);
    expect(listable(toBuild(product("ok"))!)).toBe(true);
  });
});

describe("ranking", () => {
  const quiet = toBuild(product("quiet", { metrics: {} }))!;
  const busy = toBuild(product("busy"))!;

  it("uses the PDF's formula and floor", () => {
    expect(activity(busy)).toBe((3 + 1) * (4 + 1));
    expect(belowFloor(quiet)).toBe(true);
    expect(belowFloor(busy)).toBe(false);
  });

  it("sorts most active first, ties by name", () => {
    expect(sortBuilds([quiet, busy], "active").map((b) => b.slug)).toEqual(["busy", "quiet"]);
  });
});

describe("sample app map", () => {
  it("is stable for a slug and always has deploy and data, one piece moved last", () => {
    expect(samplePieces("sunsetd")).toEqual(samplePieces("sunsetd"));
    const pieces = samplePieces("ledgerline");
    expect(pieces.find((p) => p.key === "deploy")!.provider).toBe("Cloudflare");
    expect(pieces.find((p) => p.key === "data")!.provider).not.toBeNull();
    expect(pieces.filter((p) => p.movedLast)).toHaveLength(1);
  });
});

describe("pulse", () => {
  it("lists the newest real commits first, with their age", async () => {
    const { pulse, ago } = await import("./directory");
    const now = Date.parse("2026-11-06T05:00:00Z");
    expect(ago("2026-11-06T04:58:00Z", now)).toBe("2m");
    expect(ago("2026-11-04T05:00:00Z", now)).toBe("2d");
    const old = toBuild(product("old", { lastCommitAt: { value: "2026-10-01T00:00:00Z" } }))!;
    const fresh = toBuild(product("fresh", { lastCommitAt: { value: "2026-11-05T00:00:00Z" } }))!;
    const none = toBuild(product("none"))!;
    expect(pulse([old, none, fresh]).map((l) => l.slug)).toEqual(["fresh", "old"]);
  });
});
