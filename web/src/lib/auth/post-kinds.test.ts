import { beforeEach, describe, expect, it } from "vitest";
import { ensureSchema } from "../server/db";
import { sqliteDb } from "../server/sqlite-d1.test-helper";
import { resolveSignIn } from "./accounts";
import { checkArticle, createArticle, getArticle, listArticles, updateArticle } from "./articles";
import { startBuilder } from "./builders";
import { setTopics } from "./topics";

let db: ReturnType<typeof sqliteDb>;
const NOW = Date.parse("2026-11-10T12:00:00Z");
const base = { title: "T", body: "Body", video: "", build: "" };
let ada: string;

beforeEach(async () => {
  db = sqliteDb();
  await ensureSchema(db);
  ada = ((await resolveSignIn(db, "github", { providerUserId: "1", login: "ada", displayName: "Ada", avatarUrl: null, email: null }, null)) as { accountId: string }).accountId;
  await startBuilder(db, ada, { handle: "ada", displayName: "Ada", bio: "" }, false);
});

describe("kinds of writing (TC2)", () => {
  it("defaults to a blog, and refuses unknown kinds by falling back to blog", () => {
    const r = checkArticle({ ...base });
    expect(r.ok && r.value.kind).toBe("blog");
    const odd = checkArticle({ ...base, kind: "manifesto" });
    expect(odd.ok && odd.value.kind).toBe("blog");
  });

  it("a baseline needs a GitHub repo", () => {
    expect(checkArticle({ ...base, kind: "baseline" })).toMatchObject({ ok: false, message: expect.stringContaining("repo") });
    expect(checkArticle({ ...base, kind: "baseline", repo: "https://gitlab.com/a/b" }).ok).toBe(false);
    const ok = checkArticle({ ...base, kind: "baseline", repo: "github.com/ada/starter" });
    expect(ok.ok && ok.value.repoUrl).toBe("https://github.com/ada/starter");
  });

  it("a launch names a build the author maintains", () => {
    expect(checkArticle({ ...base, kind: "launch" }).ok).toBe(false);
    expect(checkArticle({ ...base, kind: "launch", build: "rateboard" }, ["tool"]).ok).toBe(false);
    expect(checkArticle({ ...base, kind: "launch", build: "Tool" }, ["tool"]).ok).toBe(true);
  });

  it("a tutorial keeps its minutes, within reason; other kinds don't", () => {
    const t = checkArticle({ ...base, kind: "tutorial", minutes: "10" });
    expect(t.ok && t.value.minutes).toBe(10);
    expect(checkArticle({ ...base, kind: "tutorial", minutes: "0" }).ok).toBe(false);
    expect(checkArticle({ ...base, kind: "tutorial", minutes: "ten" }).ok).toBe(false);
    const b = checkArticle({ ...base, kind: "blog", minutes: "10" });
    expect(b.ok && b.value.minutes).toBeNull();
  });

  it("stores the kind and what it adds; a doc's review date is its last save", async () => {
    const r = await createArticle(db, ada, { ...base, kind: "doc" }, NOW);
    const id = (r as { id: string }).id;
    expect(await getArticle(db, id, { accountId: null, moderator: false })).toMatchObject({ kind: "doc", reviewedAt: new Date(NOW).toISOString() });
    await updateArticle(db, ada, id, { ...base, kind: "doc" }, NOW + 1000);
    expect((await getArticle(db, id, { accountId: null, moderator: false }))?.reviewedAt).toBe(new Date(NOW + 1000).toISOString());
  });

  it("lists by kind, and by kind within a topic", async () => {
    const tut = (await createArticle(db, ada, { ...base, title: "How to", kind: "tutorial", minutes: "5" }, NOW)) as { id: string };
    const blog = (await createArticle(db, ada, { ...base, title: "Log" }, NOW + 1)) as { id: string };
    await setTopics(db, "article", tut.id, ["auth"], NOW);
    await setTopics(db, "article", blog.id, ["auth"], NOW);
    expect((await listArticles(db, { kind: "tutorial" })).map((a) => a.title)).toEqual(["How to"]);
    expect((await listArticles(db, { topic: "auth", kind: "blog" })).map((a) => a.title)).toEqual(["Log"]);
    expect((await listArticles(db, { topic: "auth" })).map((a) => [a.title, a.kind, a.minutes])).toEqual([
      ["Log", "blog", null],
      ["How to", "tutorial", 5],
    ]);
  });
});
