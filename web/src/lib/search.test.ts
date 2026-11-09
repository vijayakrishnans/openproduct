import { describe, expect, it } from "vitest";
import type { Build, Person, Topic } from "./directory";
import { search } from "./search";

const build = (slug: string, tagline: string, stack: string[] = [], category = "productivity"): Build => ({
  slug, tagline, category, licence: "MIT", changes7d: 0, upvotes: 0, roleCount: 0, stack, publishedAt: null, lastCommitAt: null, pieces: [], cover: null, sample: [],
});
const person = (handle: string, displayName: string, bio: string | null = null): Person => ({ handle, displayName, bio, openToProject: false, maintains: [], contributesTo: 0 });
const topics: Topic[] = [{ value: "dev-tools", label: "Dev tools", products: 1 }, { value: "productivity", label: "Productivity", products: 2 }];
const builds = [build("leakbook", "A phone-first refrigerant log"), build("flakeless", "Quarantine flaky tests", ["React"], "dev-tools"), build("bookly", "Bookings for salons")];

describe("search", () => {
  it("matches name, tagline, stack and topic label, case-insensitively", () => {
    expect(search("LEAK", builds, [], topics).builds.map((b) => b.slug)).toEqual(["leakbook"]);
    expect(search("refrigerant", builds, [], topics).builds.map((b) => b.slug)).toEqual(["leakbook"]);
    expect(search("react", builds, [], topics).builds.map((b) => b.slug)).toEqual(["flakeless"]);
    expect(search("dev tools", builds, [], topics).builds.map((b) => b.slug)).toEqual(["flakeless"]);
  });

  it("needs every word, and ranks name matches first", () => {
    expect(search("phone log", builds, [], topics).builds).toHaveLength(1);
    expect(search("phone salons", builds, [], topics).builds).toHaveLength(0);
    expect(search("book", builds, [], topics).builds.map((b) => b.slug)).toEqual(["bookly", "leakbook"]);
  });

  it("finds people and topics, and nothing for a blank query", () => {
    const people = [person("arca", "Arca Lee", "Builds dev tools")];
    expect(search("arca", builds, people, topics).people).toHaveLength(1);
    expect(search("productivity", builds, people, topics).topics.map((t) => t.value)).toEqual(["productivity"]);
    expect(search("   ", builds, people, topics)).toEqual({ builds: [], people: [], topics: [] });
  });
});
