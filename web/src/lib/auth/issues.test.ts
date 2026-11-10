import { beforeEach, describe, expect, it } from "vitest";
import { ensureSchema } from "../server/db";
import { sqliteDb } from "../server/sqlite-d1.test-helper";
import { resolveSignIn } from "./accounts";
import { startBuilder } from "./builders";
import { createReply, createThread, getLocalThread, listLocalThreads, markSolution, setHidden } from "./discussions";

let db: ReturnType<typeof sqliteDb>;
const NOW = Date.parse("2026-11-10T12:00:00Z");
const builder = async (id: string, handle: string) => {
  const a = ((await resolveSignIn(db, "github", { providerUserId: id, login: handle, displayName: handle, avatarUrl: null, email: null }, null)) as { accountId: string }).accountId;
  await startBuilder(db, a, { handle, displayName: handle, bio: "" }, false);
  return a;
};
let sam: string, tomas: string, priya: string;

beforeEach(async () => {
  db = sqliteDb();
  await ensureSchema(db);
  sam = await builder("1", "sam");
  tomas = await builder("2", "tomas");
  priya = await builder("3", "priya");
});

async function issue() {
  const t = (await createThread(db, sam, { tag: "question", title: "wrangler can't find D1", body: "Help", kind: "issue" }, NOW)) as { id: string };
  const fix = (await createReply(db, tomas, t.id, "Add the binding to wrangler.jsonc", NOW + 1000)) as { id: string };
  const other = (await createReply(db, priya, t.id, "Restart dev?", NOW + 2000)) as { id: string };
  return { id: t.id, fix: fix.id, other: other.id };
}

describe("issues and solutions (TC3)", () => {
  it("the issue's author marks a reply as the solution; it moves to Solved with that reply first", async () => {
    const { id, fix } = await issue();
    expect((await listLocalThreads(db, "latest", null, 50, undefined, { kind: "issue", solved: false })).map((t) => t.id)).toEqual([id]);
    expect((await markSolution(db, id, sam, fix)).ok).toBe(true);
    expect(await listLocalThreads(db, "latest", null, 50, undefined, { kind: "issue", solved: false })).toEqual([]);
    const solved = await listLocalThreads(db, "latest", null, 50, undefined, { kind: "issue", solved: true });
    expect(solved.map((t) => [t.id, t.solved, t.state])).toEqual([[id, true, "answered"]]);
    const page = (await getLocalThread(db, id, { accountId: sam, moderator: false }))!;
    expect(page.posts.map((p) => [p.authorHandle, !!p.solution])).toEqual([["sam", false], ["tomas", true], ["priya", false]]);
    expect(page.thread.mine).toBe(true);
  });

  it("only the issue's author can mark, never the question itself, and unmarking reopens it", async () => {
    const { id, fix } = await issue();
    expect((await markSolution(db, id, tomas, fix)).ok).toBe(false);
    const first = (await getLocalThread(db, id, { accountId: null, moderator: false }))!.posts[0]!.id;
    expect((await markSolution(db, id, sam, first)).ok).toBe(false);
    await markSolution(db, id, sam, fix);
    expect((await markSolution(db, id, sam, null)).ok).toBe(true);
    expect((await listLocalThreads(db, "latest", null, 50, undefined, { kind: "issue", solved: false })).length).toBe(1);
  });

  it("a hidden reply can't be the solution, and discussions have none", async () => {
    const { id, other } = await issue();
    await setHidden(db, "post", other, true);
    expect((await markSolution(db, id, sam, other)).ok).toBe(false);
    const d = (await createThread(db, sam, { tag: "question", title: "Chat", body: "Hi" }, NOW)) as { id: string };
    const r = (await createReply(db, tomas, d.id, "Hello", NOW + 1)) as { id: string };
    expect((await markSolution(db, d.id, sam, r.id)).ok).toBe(false);
  });

  it("issues and discussions list apart", async () => {
    const { id } = await issue();
    const d = (await createThread(db, sam, { tag: "question", title: "Chat", body: "Hi" }, NOW)) as { id: string };
    expect((await listLocalThreads(db, "latest", null, 50, undefined, { kind: "discussion" })).map((t) => t.id)).toEqual([d.id]);
    expect((await listLocalThreads(db, "latest", null, 50, undefined, { kind: "issue" })).map((t) => t.id)).toEqual([id]);
  });
});
