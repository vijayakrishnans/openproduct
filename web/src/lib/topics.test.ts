import { describe, expect, it } from "vitest";
import { normalizeTopic, parseTopics, topicLabel } from "./topics";

describe("topics as tags (TC1)", () => {
  it("normalises what people type into one topic", () => {
    for (const raw of ["cloudflare-workers", "#Cloudflare Workers", "cloudflare_workers", "  CF-Workers ", "workers"]) {
      expect(normalizeTopic(raw), raw).toBe("cloudflare-workers");
    }
    expect(normalizeTopic("Next.js")).toBe("nextjs");
    expect(normalizeTopic("C++")).toBe("cplusplus");
    expect(normalizeTopic("a")).toBeNull();
    expect(normalizeTopic("x".repeat(33))).toBeNull();
    expect(normalizeTopic("<script>")).toBe("script");
    expect(normalizeTopic("../../etc")).toBe("etc");
  });

  it("keeps up to five distinct topics", () => {
    expect(parseTopics("auth, Auth, #auth, nextjs")).toEqual(["auth", "nextjs"]);
    expect(parseTopics("#ai #pricing #auth")).toEqual(["ai", "pricing", "auth"]);
    expect(parseTopics("a, b, c, d, e, f, gg, hh, ii, jj, kk, ll")).toEqual(["gg", "hh", "ii", "jj", "kk"]);
    expect(parseTopics("")).toEqual([]);
  });

  it("labels a topic from its slug", () => {
    expect(topicLabel("cloudflare-workers")).toBe("Cloudflare Workers");
    expect(topicLabel("ai")).toBe("AI");
    expect(topicLabel("edge-caching")).toBe("Edge caching");
  });
});
