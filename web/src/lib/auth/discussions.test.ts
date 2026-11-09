import { beforeEach, describe, expect, it } from "vitest";
import { ensureSchema } from "../server/db";
import { sqliteDb } from "../server/sqlite-d1.test-helper";
import { deleteAccount, resolveSignIn } from "./accounts";
import { startBuilder } from "./builders";
import {
  REPLIES_PER_HOUR,
  THREADS_PER_HOUR,
  createReply,
  createThread,
  getLocalThread,
  isModerator,
  listLocalThreads,
  openReports,
  parseModerators,
  reportContent,
  setHidden,
  threadsStartedBy,
} from "./discussions";

let db: ReturnType<typeof sqliteDb>;
const account = async (id: string, login = id) =>
  ((await resolveSignIn(db, "github", { providerUserId: id, login, displayName: id, avatarUrl: null, email: null }, null)) as { accountId: string }).accountId;
const builder = async (id: string, handle: string) => {
  const a = await account(id);
  await startBuilder(db, a, { handle, displayName: handle.toUpperCase(), bio: "" }, false);
  return a;
};
const anon = { accountId: null, moderator: false };

beforeEach(async () => {
  db = sqliteDb();
  await ensureSchema(db);
});

describe("discussions", () => {
  it("only a builder can post; a thread opens with its first post", async () => {
    const plain = await account("x");
    expect((await createThread(db, plain, { tag: "question", title: "Hi", body: "Hello" })).ok).toBe(false);
    const ada = await builder("1", "ada");
    const r = await createThread(db, ada, { tag: "question", title: "  Vercel   vs Cloudflare ", body: "Which **one**?" });
    expect(r.ok).toBe(true);
    const t = await getLocalThread(db, (r as { id: string }).id, anon);
    expect(t?.thread).toMatchObject({ title: "Vercel vs Cloudflare", author: "ADA", authorHandle: "ada", replies: 1, lastPostAt: null, local: true });
    expect(t?.posts).toHaveLength(1);
    expect(t?.posts[0]!.body[0]).toMatchObject({ kind: "paragraph" });
  });

  it("validates category, title and body", async () => {
    const ada = await builder("1", "ada");
    expect((await createThread(db, ada, { tag: "rant", title: "t", body: "b" })).ok).toBe(false);
    expect((await createThread(db, ada, { tag: "question", title: " ", body: "b" })).ok).toBe(false);
    expect((await createThread(db, ada, { tag: "question", title: "x".repeat(141), body: "b" })).ok).toBe(false);
    expect((await createThread(db, ada, { tag: "question", title: "t", body: "x".repeat(5001) })).ok).toBe(false);
  });

  it("replies bump the thread; the list orders by activity or replies", async () => {
    const ada = await builder("1", "ada");
    const bea = await builder("2", "bea");
    const now = Date.now();
    const a = (await createThread(db, ada, { tag: "question", title: "A", body: "a" }, now - 3000)) as { id: string };
    const b = (await createThread(db, ada, { tag: "design", title: "B", body: "b" }, now - 2000)) as { id: string };
    await createReply(db, bea, a.id, "reply 1", now - 1000);
    await createReply(db, bea, a.id, "reply 2", now);
    expect((await listLocalThreads(db, "latest", null)).map((t) => t.title)).toEqual(["A", "B"]);
    expect((await listLocalThreads(db, "replied", null)).map((t) => [t.title, t.replies])).toEqual([["A", 3], ["B", 1]]);
    expect((await listLocalThreads(db, "latest", "design")).map((t) => t.title)).toEqual(["B"]);
    expect((await getLocalThread(db, b.id, anon))?.thread.lastPostAt).toBeNull();
  });

  it("rate-limits threads and replies per hour", async () => {
    const ada = await builder("1", "ada");
    const now = Date.now();
    let last: { ok: boolean; id?: string } = { ok: true };
    for (let i = 0; i < THREADS_PER_HOUR; i++) last = await createThread(db, ada, { tag: "question", title: `T${i}`, body: "b" }, now + i);
    expect((await createThread(db, ada, { tag: "question", title: "one more", body: "b" }, now + 10)).ok).toBe(false);
    expect((await createThread(db, ada, { tag: "question", title: "an hour later", body: "b" }, now + 61 * 60 * 1000)).ok).toBe(true);
    const id = (last as { id: string }).id;
    for (let i = 0; i < REPLIES_PER_HOUR; i++) await createReply(db, ada, id, `r${i}`, now + 100 + i);
    // The thread's opening posts count too: 3 openers + 20 replies already this hour.
    expect((await createReply(db, ada, id, "too many", now + 200)).ok).toBe(false);
  });

  it("reports group per post; hiding removes it for everyone but moderators and resolves the report", async () => {
    const ada = await builder("1", "ada");
    const bea = await builder("2", "bea");
    const cy = await builder("3", "cy");
    const t = (await createThread(db, ada, { tag: "question", title: "T", body: "fine" })) as { id: string };
    const r = (await createReply(db, bea, t.id, "spam spam")) as { id: string };
    expect(await reportContent(db, ada, "post", r.id, "spam")).toBe(true);
    expect(await reportContent(db, cy, "post", r.id, "")).toBe(true);
    expect(await reportContent(db, cy, "post", r.id, "again")).toBe(true); // one report per person
    expect(await reportContent(db, cy, "post", "00000000-0000-0000-0000-000000000000", "")).toBe(false);
    const open = await openReports(db);
    expect(open).toHaveLength(1);
    expect(open[0]).toMatchObject({ kind: "post", id: r.id, threadId: t.id, reports: 2, reasons: ["spam"] });

    await setHidden(db, "post", r.id, true);
    expect((await getLocalThread(db, t.id, anon))?.posts.map((p) => p.id)).not.toContain(r.id);
    expect((await getLocalThread(db, t.id, { accountId: ada, moderator: true }))?.posts.find((p) => p.id === r.id)?.hidden).toBe(true);
    expect(await openReports(db)).toEqual([]);

    await setHidden(db, "thread", t.id, true);
    expect(await getLocalThread(db, t.id, anon)).toBeNull();
    expect(await listLocalThreads(db, "latest", null)).toEqual([]);
    expect((await createReply(db, bea, t.id, "still here?")).ok).toBe(false);
  });

  it("a deleted author's words stay, as 'deleted builder'", async () => {
    const ada = await builder("1", "ada");
    const t = (await createThread(db, ada, { tag: "question", title: "T", body: "b" })) as { id: string };
    await deleteAccount(db, ada);
    const got = await getLocalThread(db, t.id, anon);
    expect(got?.thread.author).toBe("deleted builder");
    expect(got?.posts[0]!.authorHandle).toBeNull();
  });

  it("moderators are GitHub logins; the badge counts visible threads", async () => {
    const owner = await account("9", "VijayaKrishnanS");
    const other = await account("8", "someone");
    expect(await isModerator(db, owner, parseModerators(undefined))).toBe(true);
    expect(await isModerator(db, other, parseModerators(undefined))).toBe(false);
    expect(await isModerator(db, other, parseModerators("someone, else"))).toBe(true);
    const ada = await builder("1", "ada");
    const t = (await createThread(db, ada, { tag: "question", title: "T", body: "b" })) as { id: string };
    await createThread(db, ada, { tag: "design", title: "U", body: "b" });
    expect(await threadsStartedBy(db, "ada")).toBe(2);
    await setHidden(db, "thread", t.id, true);
    expect(await threadsStartedBy(db, "ada")).toBe(1);
  });
});
