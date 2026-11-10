import { describe, expect, it } from "vitest";
import { filterBuilds, parseFilters, parseShow, PAGE_SIZE, type Build } from "./directory";

const b = (slug: string, over: Partial<Build> = {}): Build => ({
  slug,
  tagline: `${slug} tagline`,
  category: "dev-tools",
  licence: null,
  changes7d: 0,
  upvotes: 0,
  roleCount: 0,
  stack: [],
  publishedAt: null,
  lastCommitAt: null,
  pieces: [],
  cover: null,
  sample: [],
  ...over,
});
const builds = [
  b("flakeless", { tagline: "Quarantine flaky tests", stack: ["typescript", "workers"], roleCount: 2, changes7d: 3, licence: "MIT" }),
  b("rateboard", { tagline: "Sponsor pipeline", category: "media", stack: ["nextjs"] }),
  b("openproduct-web", { tagline: "The open build directory", source: "here", changes7d: 30 }),
];
const topics = [{ value: "media", label: "Media", products: 1 }, { value: "dev-tools", label: "Dev tools", products: 2 }];
const slugs = (list: Build[]) => list.map((x) => x.slug);

describe("Open builds search and filters (OP-37)", () => {
  it("matches every word in the name, tagline, stack or category", () => {
    expect(slugs(filterBuilds(builds, { q: "flaky" }))).toEqual(["flakeless"]);
    expect(slugs(filterBuilds(builds, { q: "WORKERS typescript" }))).toEqual(["flakeless"]);
    expect(slugs(filterBuilds(builds, { q: "media", topics }))).toEqual(["rateboard"]);
    expect(slugs(filterBuilds(builds, { q: "flaky nextjs" }))).toEqual([]);
    expect(filterBuilds(builds, { q: "  " })).toHaveLength(3);
  });

  it("combines the category and every chosen filter", () => {
    expect(slugs(filterBuilds(builds, { filters: ["roles"] }))).toEqual(["flakeless"]);
    expect(slugs(filterBuilds(builds, { filters: ["active"] }))).toEqual(["flakeless", "openproduct-web"]);
    expect(slugs(filterBuilds(builds, { filters: ["active", "here"] }))).toEqual(["openproduct-web"]);
    expect(slugs(filterBuilds(builds, { cat: "dev-tools", filters: ["licensed"] }))).toEqual(["flakeless"]);
  });

  it("reads filters and page sizes safely from the address", () => {
    expect(parseFilters("roles,here,nonsense")).toEqual(["roles", "here"]);
    expect(parseFilters(undefined)).toEqual([]);
    expect(parseShow(undefined)).toBe(PAGE_SIZE);
    expect(parseShow("40")).toBe(40);
    expect(parseShow("33")).toBe(40);
    expect(parseShow("-5")).toBe(PAGE_SIZE);
    expect(parseShow("999999")).toBe(500);
  });
});
