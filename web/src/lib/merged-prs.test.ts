import { describe, expect, it } from "vitest";
import { countMerged, isGithubLogin, repoOf, repoOfItem, searchLink, searchQueries } from "./merged-prs";

describe("repoOf", () => {
  it("reads owner/name from github.com URLs only", () => {
    expect(repoOf("https://github.com/pullely/RateBoard")).toBe("pullely/rateboard");
    expect(repoOf("https://github.com/pullely/rateboard.git")).toBe("pullely/rateboard");
    expect(repoOf("https://www.github.com/pullely/rateboard/tree/main")).toBe("pullely/rateboard");
    expect(repoOf("https://gitlab.com/pullely/rateboard")).toBeNull();
    expect(repoOf("https://github.com.evil.example/pullely/rateboard")).toBeNull();
    expect(repoOf("http://github.com/pullely/rateboard")).toBeNull();
    expect(repoOf("https://github.com/pullely")).toBeNull();
    expect(repoOf(null)).toBeNull();
  });
});

describe("searchQueries", () => {
  it("ORs repos into as few queries as fit GitHub's 256-character limit", () => {
    const repos = Array.from({ length: 30 }, (_, i) => `pullely/build-number-${i}`);
    const qs = searchQueries("ada", repos);
    expect(qs.length).toBeGreaterThan(1);
    for (const q of qs) {
      expect(q.length).toBeLessThanOrEqual(240);
      expect(q.startsWith("is:pr is:merged author:ada repo:")).toBe(true);
    }
    expect(qs.join(" ").match(/repo:/g)).toHaveLength(30);
  });
  it("asks nothing when there are no repos", () => {
    expect(searchQueries("ada", [])).toEqual([]);
  });
  it("links a search anyone can open", () => {
    expect(searchLink("ada", ["b/two", "a/one"])).toBe(
      `https://github.com/pulls?q=${encodeURIComponent("is:pr is:merged author:ada repo:a/one repo:b/two")}`,
    );
  });
});

describe("countMerged", () => {
  const repoToSlug = { "pullely/rateboard": "rateboard", "pullely/aitally": "aitally", "ada/own-thing": "own-thing" };
  it("counts PRs to build repos only", () => {
    const m = countMerged("ada", { "pullely/rateboard": 2, "someone/else": 9 }, repoToSlug, [], "t");
    expect(m).toEqual({ login: "ada", total: 2, byBuild: { rateboard: 2 }, repos: ["pullely/rateboard"], fetchedAt: "t" });
  });
  it("leaves out repos the login owns and builds it maintains", () => {
    const m = countMerged("Ada", { "pullely/rateboard": 2, "pullely/aitally": 3, "ada/own-thing": 5 }, repoToSlug, ["aitally"], "t");
    expect(m.total).toBe(2);
    expect(m.byBuild).toEqual({ rateboard: 2 });
  });
});

describe("GitHub shapes", () => {
  it("reads a search item's repo", () => {
    expect(repoOfItem({ repository_url: "https://api.github.com/repos/Pullely/Rateboard" })).toBe("pullely/rateboard");
    expect(repoOfItem({ repository_url: "https://evil.example/repos/a/b" })).toBeNull();
    expect(repoOfItem(null)).toBeNull();
  });
  it("accepts real logins only", () => {
    expect(isGithubLogin("vijayakrishnans")).toBe(true);
    expect(isGithubLogin("a-b")).toBe(true);
    expect(isGithubLogin("a--b")).toBe(false);
    expect(isGithubLogin("-ab")).toBe(false);
    expect(isGithubLogin("x repo:evil/repo")).toBe(false);
  });
});
