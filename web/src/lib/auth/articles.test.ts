import { beforeEach, describe, expect, it } from "vitest";
import { MIGRATIONS, ensureSchema } from "../server/db";
import { sqliteDb } from "../server/sqlite-d1.test-helper";
import { deleteAccount, resolveSignIn } from "./accounts";
import {
  ARTICLES_PER_DAY,
  articlesBy,
  createArticle,
  deleteArticle,
  excerptOf,
  getArticle,
  listArticles,
  updateArticle,
} from "./articles";
import { startBuilder } from "./builders";
import { openReports, reportContent, setHidden } from "./discussions";
import { parseBody } from "../body";

let db: ReturnType<typeof sqliteDb>;
const account = async (id: string) =>
  ((await resolveSignIn(db, "github", { providerUserId: id, login: id, displayName: id, avatarUrl: null, email: null }, null)) as { accountId: string }).accountId;
const builder = async (id: string, handle: string) => {
  const a = await account(id);
  await startBuilder(db, a, { handle, displayName: handle.toUpperCase(), bio: "" }, false);
  return a;
};
const anon = { accountId: null, moderator: false };
const YT = "https://youtu.be/Sklc_fQBmcs";
const post = (over: Partial<{ title: string; body: string; video: string; build: string }> = {}) => ({
  title: "Moving to Workers",
  body: "We **moved**. Here's how.",
  video: "",
  build: "",
  ...over,
});
const idOf = (r: { ok: true; id: string } | { ok: false; message: string }) => (r.ok ? r.id : "");

beforeEach(async () => {
  db = sqliteDb();
  await ensureSchema(db);
});

describe("builder posts", () => {
  it("only a builder publishes; the video is stored as provider and id, never a URL or HTML", async () => {
    expect((await createArticle(db, await account("x"), post())).ok).toBe(false);
    const ada = await builder("1", "ada");
    const r = await createArticle(db, ada, post({ video: YT, build: "Makan" }));
    expect(r.ok).toBe(true);
    const row = await db.prepare(`SELECT * FROM articles`).first<Record<string, unknown>>();
    expect(row).toMatchObject({ video_provider: "youtube", video_id: "Sklc_fQBmcs", build_slug: "makan" });
    expect(JSON.stringify(row)).not.toMatch(/https?:|<iframe|<script/);
    const a = await getArticle(db, idOf(r), anon);
    expect(a).toMatchObject({ title: "Moving to Workers", authorHandle: "ada", author: "ADA", buildSlug: "makan", video: { provider: "youtube", id: "Sklc_fQBmcs" }, mine: false, source: null });
    expect(a?.body[0]).toMatchObject({ kind: "paragraph" });
  });

  it("refuses any other video link, a bad build name, and empty or oversized fields", async () => {
    const ada = await builder("1", "ada");
    for (const video of ["https://evil.example/v.mp4", "<iframe src=x>", "https://www.dailymotion.com/video/x7tgad0"]) {
      const r = await createArticle(db, ada, post({ video }));
      expect(r.ok, video).toBe(false);
    }
    expect((await createArticle(db, ada, post({ build: "../admin" }))).ok).toBe(false);
    expect((await createArticle(db, ada, post({ title: " " }))).ok).toBe(false);
    expect((await createArticle(db, ada, post({ body: "x".repeat(20001) }))).ok).toBe(false);
    expect(await articlesBy(db, "ada")).toBe(0);
  });

  it("limits posts per day", async () => {
    const ada = await builder("1", "ada");
    const now = Date.parse("2026-11-10T10:00:00Z");
    for (let i = 0; i < ARTICLES_PER_DAY; i++) expect((await createArticle(db, ada, post(), now + i)).ok).toBe(true);
    expect((await createArticle(db, ada, post(), now + 10)).ok).toBe(false);
    expect((await createArticle(db, ada, post(), now + 25 * 3600_000)).ok).toBe(true);
  });

  it("only the author edits or deletes", async () => {
    const ada = await builder("1", "ada");
    const bob = await builder("2", "bob");
    const id = idOf(await createArticle(db, ada, post()));
    expect((await updateArticle(db, bob, id, post({ title: "Mine now" }))).ok).toBe(false);
    expect((await updateArticle(db, ada, id, post({ title: "Edited", video: "https://vimeo.com/76979871" }))).ok).toBe(true);
    const mine = await getArticle(db, id, { accountId: ada, moderator: false });
    expect(mine).toMatchObject({ title: "Edited", video: { provider: "vimeo", id: "76979871" }, mine: true, source: "We **moved**. Here's how." });
    expect(await deleteArticle(db, bob, id)).toBe(false);
    expect(await deleteArticle(db, ada, id)).toBe(true);
    expect(await getArticle(db, id, anon)).toBeNull();
  });

  it("lists newest first, per builder and per build, and counts for the badge", async () => {
    const ada = await builder("1", "ada");
    const bob = await builder("2", "bob");
    await createArticle(db, ada, post({ title: "First", build: "makan" }), Date.parse("2026-11-01T00:00:00Z"));
    await createArticle(db, bob, post({ title: "Second" }), Date.parse("2026-11-02T00:00:00Z"));
    await createArticle(db, ada, post({ title: "Third" }), Date.parse("2026-11-03T00:00:00Z"));
    expect((await listArticles(db)).map((a) => a.title)).toEqual(["Third", "Second", "First"]);
    expect((await listArticles(db, { handle: "ada" })).map((a) => a.title)).toEqual(["Third", "First"]);
    expect((await listArticles(db, { build: "makan" })).map((a) => a.title)).toEqual(["First"]);
    expect(await articlesBy(db, "ada")).toBe(2);
  });

  it("a hidden post leaves lists and the badge, and is seen only by its author and moderators", async () => {
    const ada = await builder("1", "ada");
    const bob = await builder("2", "bob");
    const id = idOf(await createArticle(db, ada, post()));
    expect(await reportContent(db, bob, "article", id, "spam")).toBe(true);
    const reports = await openReports(db);
    expect(reports).toMatchObject([{ kind: "article", id, threadId: null, href: `/posts/${id}`, title: "Moving to Workers", reports: 1, reasons: ["spam"] }]);
    await setHidden(db, "article", id, true);
    expect(await openReports(db)).toEqual([]);
    expect(await listArticles(db)).toEqual([]);
    expect(await articlesBy(db, "ada")).toBe(0);
    expect(await getArticle(db, id, anon)).toBeNull();
    expect(await getArticle(db, id, { accountId: bob, moderator: false })).toBeNull();
    expect((await getArticle(db, id, { accountId: ada, moderator: false }))?.hidden).toBe(true);
    expect((await getArticle(db, id, { accountId: bob, moderator: true }))?.hidden).toBe(true);
  });

  it("deleting the account deletes its posts", async () => {
    const ada = await builder("1", "ada");
    await createArticle(db, ada, post());
    await deleteAccount(db, ada);
    expect((await db.prepare(`SELECT count(*) AS n FROM articles`).first<{ n: number }>())?.n).toBe(0);
  });

  it("posts get headings; discussions don't", () => {
    expect(parseBody("## Why\ntext", { headings: true })).toEqual([
      { kind: "heading", level: 2, children: [{ kind: "text", value: "Why" }] },
      { kind: "paragraph", children: [{ kind: "text", value: "text" }] },
    ]);
    expect(parseBody("### Small", { headings: true })[0]).toMatchObject({ kind: "heading", level: 3 });
    expect(parseBody("# Too big", { headings: true })[0]).toMatchObject({ kind: "paragraph" });
    expect(parseBody("## Why")[0]).toMatchObject({ kind: "paragraph" });
  });

  it("excerpts are plain text, cut at a word", () => {
    expect(excerptOf(parseBody("Hello **bold** and `code`."))).toBe("Hello bold and code .");
    const long = excerptOf(parseBody("word ".repeat(100)), 40);
    expect(long.endsWith("…")).toBe(true);
    expect(long.length).toBeLessThanOrEqual(41);
  });
});

describe("migration 4", () => {
  it("keeps reports made before it", async () => {
    const fresh = sqliteDb();
    await fresh.prepare(`CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)`).run();
    for (const m of MIGRATIONS.filter((m) => m.version < 4)) {
      await fresh.batch([...m.statements.map((s) => fresh.prepare(s)), fresh.prepare(`INSERT INTO schema_migrations VALUES (?, ?, ?)`).bind(m.version, m.name, "x")]);
    }
    await fresh.prepare(`INSERT INTO accounts (id, created_at) VALUES ('a1', 'x')`).run();
    await fresh.prepare(`INSERT INTO reports (target_kind, target_id, reporter_account_id, created_at) VALUES ('thread', 't1', 'a1', 'x')`).run();
    await ensureSchema(fresh);
    expect((await fresh.prepare(`SELECT count(*) AS n FROM reports`).first<{ n: number }>())?.n).toBe(1);
    await fresh.prepare(`INSERT INTO reports (target_kind, target_id, reporter_account_id, created_at) VALUES ('article', 'p1', 'a1', 'x')`).run();
  });
});
