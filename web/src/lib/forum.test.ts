import { describe, expect, it } from "vitest";
import { parseOrder, parseTag, safeHref, toNodes, toThread } from "./forum";

describe("toThread", () => {
  const raw = { id: "t1", tag: "question", title: "How do I deploy?", authorHandle: "arca", authorName: "Arca", state: "open", createdAt: "2026-11-01T00:00:00Z", lastPostAt: null, postCount: 3, slug: "aitally" };

  it("keeps what the row shows", () => {
    expect(toThread(raw)).toEqual({ id: "t1", slug: "aitally", tag: "question", title: "How do I deploy?", author: "Arca", authorHandle: "arca", state: "open", createdAt: "2026-11-01T00:00:00Z", lastPostAt: null, replies: 3 });
  });

  it("drops removed threads and ones missing an id, title or date", () => {
    expect(toThread({ ...raw, state: "removed" })).toBeNull();
    expect(toThread({ ...raw, title: " " })).toBeNull();
    expect(toThread({ ...raw, id: undefined })).toBeNull();
    expect(toThread(null)).toBeNull();
  });
});

describe("toNodes", () => {
  it("keeps known nodes and drops unknown ones, however deep", () => {
    const nodes = toNodes([
      { kind: "paragraph", children: [{ kind: "text", value: "hi " }, { kind: "html", value: "<script>" }, { kind: "strong", children: [{ kind: "text", value: "there" }] }] },
      { kind: "image", src: "x" },
    ]);
    expect(nodes).toEqual([{ kind: "paragraph", children: [{ kind: "text", value: "hi " }, { kind: "strong", children: [{ kind: "text", value: "there" }] }] }]);
  });
});

describe("safeHref", () => {
  it("allows http(s) only", () => {
    expect(safeHref("https://example.com/a")).toBe("https://example.com/a");
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref(" JaVaScRiPt:alert(1)")).toBeNull();
    expect(safeHref("data:text/html,x")).toBeNull();
    expect(safeHref("/relative")).toBeNull();
  });
});

describe("order and tag", () => {
  it("falls back to latest and no tag for anything unknown", () => {
    expect(parseOrder("replied")).toBe("replied");
    expect(parseOrder("hot")).toBe("latest");
    expect(parseTag("design")).toBe("design");
    expect(parseTag("launch")).toBeNull();
    expect(parseTag(undefined)).toBeNull();
  });
});
