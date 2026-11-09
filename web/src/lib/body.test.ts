import { describe, expect, it } from "vitest";
import { parseBody } from "./body";
import { mergeThreads, type Thread } from "./forum";

describe("parseBody", () => {
  it("paragraphs, lists, quotes and code", () => {
    const nodes = parseBody("Hello **you** and *them*.\n\n- one\n- `two`\n\n1. first\n2. second\n\n> quoted\n\n```\nlet x = 1;\n```");
    expect(nodes.map((n) => n.kind)).toEqual(["paragraph", "list", "list", "quote", "codeblock"]);
    expect(nodes[0]).toEqual({
      kind: "paragraph",
      children: [
        { kind: "text", value: "Hello " },
        { kind: "strong", children: [{ kind: "text", value: "you" }] },
        { kind: "text", value: " and " },
        { kind: "emphasis", children: [{ kind: "text", value: "them" }] },
        { kind: "text", value: "." },
      ],
    });
    expect(nodes[2]).toMatchObject({ kind: "list", ordered: true });
    expect(nodes[4]).toEqual({ kind: "codeblock", value: "let x = 1;" });
  });

  it("links: http(s) only, bare URLs linked without trailing punctuation", () => {
    const [p] = parseBody("See [the docs](https://developers.cloudflare.com/workers/) or https://vercel.com/docs. Not [this](javascript:alert(1)).");
    const kids = (p as { children: { kind: string; href?: string; value?: string }[] }).children;
    expect(kids.filter((k) => k.kind === "link").map((k) => k.href)).toEqual(["https://developers.cloudflare.com/workers/", "https://vercel.com/docs"]);
    expect(kids.some((k) => k.kind === "text" && k.value?.includes("javascript:"))).toBe(true);
  });

  it("never produces HTML: tags stay text", () => {
    const [p] = parseBody("<script>alert(1)</script> <img src=x onerror=alert(1)>");
    expect(p).toEqual({ kind: "paragraph", children: [{ kind: "text", value: "<script>alert(1)</script> <img src=x onerror=alert(1)>" }] });
  });
});

describe("mergeThreads", () => {
  const t = (id: string, at: string, replies: number, local = false): Thread => ({
    id, slug: null, tag: "question", title: id, author: null, authorHandle: null, state: "open", createdAt: at, lastPostAt: null, replies, local,
  });
  it("orders latest by last activity and most replied by count, across both sources", () => {
    const here = [t("a", "2026-11-09T10:00:00Z", 1, true), t("b", "2026-11-01T00:00:00Z", 9, true)];
    const there = [t("c", "2026-11-05T00:00:00Z", 3)];
    expect(mergeThreads(here, there, "latest").map((x) => x.id)).toEqual(["a", "c", "b"]);
    expect(mergeThreads(here, there, "replied").map((x) => x.id)).toEqual(["b", "c", "a"]);
  });
});
