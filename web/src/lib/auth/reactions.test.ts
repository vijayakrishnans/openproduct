import { beforeEach, describe, expect, it } from "vitest";
import { MIGRATIONS, ensureSchema, type Db } from "../server/db";
import { sqliteDb } from "../server/sqlite-d1.test-helper";
import { deleteAccount, resolveSignIn } from "./accounts";
import { startBuilder } from "./builders";
import { createRemoteReply, createThread, listLocalThreads, openReports, remoteReplies, reportContent, getLocalThread } from "./discussions";
import { followState, followingOf, handsFor, toggleFollow, toggleHand, toggleVote, voteCounts, voteState, withVotes } from "./reactions";

let db: ReturnType<typeof sqliteDb>;
const account = async (id: string) =>
  ((await resolveSignIn(db, "github", { providerUserId: id, login: id, displayName: id, avatarUrl: null, email: null }, null)) as { accountId: string }).accountId;
const builder = async (id: string, handle: string) => {
  const a = await account(id);
  await startBuilder(db, a, { handle, displayName: handle.toUpperCase(), bio: "" }, false);
  return a;
};
const viewer = (accountId: string | null) => ({ accountId, moderator: false });

beforeEach(async () => {
  db = sqliteDb();
  await ensureSchema(db);
});

describe("upvotes here", () => {
  it("toggles one vote per account and adds to openproduct's count", async () => {
    const a = await account("a");
    const b = await account("b");
    expect(await toggleVote(db, a, "rateboard")).toBe(true);
    expect(await toggleVote(db, b, "rateboard")).toBe(true);
    expect(await voteState(db, "rateboard", a)).toEqual({ count: 2, mine: true });
    expect(await toggleVote(db, a, "rateboard")).toBe(false);
    expect(await voteState(db, "rateboard", a)).toEqual({ count: 1, mine: false });
    const counts = await voteCounts(db);
    expect(withVotes([{ slug: "rateboard", upvotes: 4 }, { slug: "aitally", upvotes: 1 }], counts)).toEqual([
      { slug: "rateboard", upvotes: 5 },
      { slug: "aitally", upvotes: 1 },
    ]);
    expect(await toggleVote(db, a, "../etc")).toBeNull();
  });
});

describe("follows", () => {
  it("follows builds and builders, lists them on the account, and goes with the account", async () => {
    const a = await account("a");
    expect(await toggleFollow(db, a, "build", "rateboard")).toBe(true);
    expect(await toggleFollow(db, a, "builder", "mira-okafor")).toBe(true);
    expect(await followState(db, "builder", "Mira-Okafor", a)).toEqual({ count: 1, mine: true });
    expect((await followingOf(db, a)).map((f) => `${f.kind}:${f.key}`).sort()).toEqual(["build:rateboard", "builder:mira-okafor"]);
    expect(await toggleFollow(db, a, "build", "rateboard")).toBe(false);
    expect(await toggleFollow(db, a, "builder", "not a handle")).toBeNull();
    await deleteAccount(db, a);
    expect(await followState(db, "builder", "mira-okafor", null)).toEqual({ count: 0, mine: false });
  });
});

describe("raised hands", () => {
  it("only a builder raises a hand, and the build page sees who", async () => {
    const plain = await account("x");
    expect((await toggleHand(db, plain, "rateboard", "opr_1")).ok).toBe(false);
    const ada = await builder("1", "ada");
    const bob = await builder("2", "bob");
    expect(await toggleHand(db, ada, "rateboard", "opr_1")).toEqual({ ok: true, raised: true });
    expect(await toggleHand(db, bob, "rateboard", "opr_1")).toEqual({ ok: true, raised: true });
    const hands = await handsFor(db, "rateboard", ada);
    expect(hands.get("opr_1")).toEqual([
      { handle: "ada", name: "ADA", mine: true },
      { handle: "bob", name: "BOB", mine: false },
    ]);
    expect(await toggleHand(db, ada, "rateboard", "opr_1")).toEqual({ ok: true, raised: false });
    expect((await toggleHand(db, ada, "rateboard", "bad id!")).ok).toBe(false);
  });
});

describe("replies to openproduct.live threads", () => {
  const remote = { id: "thr_abc123", title: "A thread from there", tag: "question" };

  it("are written here, shown under the thread, and never listed as a thread of their own", async () => {
    const ada = await builder("1", "ada");
    const r = await createRemoteReply(db, ada, remote, "Answering **here**.");
    expect(r.ok).toBe(true);
    await createRemoteReply(db, ada, remote, "And again.");
    const replies = await remoteReplies(db, remote.id, viewer(null));
    expect(replies.map((p) => p.authorHandle)).toEqual(["ada", "ada"]);
    expect(await listLocalThreads(db, "latest", null)).toEqual([]);
    expect(await getLocalThread(db, remote.id, viewer(null))).toBeNull();
  });

  it("can be reported like any reply, and need a builder profile", async () => {
    expect((await createRemoteReply(db, await account("x"), remote, "Hi")).ok).toBe(false);
    const ada = await builder("1", "ada");
    const bob = await builder("2", "bob");
    const r = await createRemoteReply(db, ada, remote, "Hi");
    await reportContent(db, bob, "post", (r as { id: string }).id, "spam");
    expect((await openReports(db))[0]).toMatchObject({ kind: "post", threadId: remote.id, href: `/community/t/${remote.id}#p-${(r as { id: string }).id}` });
  });

  it("never attach to a thread written here", async () => {
    const ada = await builder("1", "ada");
    const t = await createThread(db, ada, { tag: "question", title: "Mine", body: "Body" });
    const id = (t as { id: string }).id;
    expect((await createRemoteReply(db, ada, { ...remote, id }, "Hijack")).ok).toBe(false);
  });
});

describe("migration 6", () => {
  it("survives another isolate applying it between our read and our write", async () => {
    const real = sqliteDb();
    await ensureSchema(real);
    // A second isolate read the versions before the first recorded 6, so it
    // tries again: the ALTER TABLE fails, and it must carry on, not throw.
    const stale: Db = {
      batch: (s) => real.batch(s),
      prepare: (sql) =>
        sql.startsWith("SELECT version FROM schema_migrations")
          ? real.prepare("SELECT version FROM schema_migrations WHERE version < 6")
          : real.prepare(sql),
    };
    await expect(ensureSchema(stale)).resolves.toBeUndefined();
    expect(MIGRATIONS.some((m) => m.version === 6)).toBe(true);
  });
});
