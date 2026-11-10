import { beforeEach, describe, expect, it } from "vitest";
import { ensureSchema } from "../server/db";
import { sqliteDb } from "../server/sqlite-d1.test-helper";
import { resolveSignIn } from "./accounts";
import { startBuilder } from "./builders";
import { addComment, commentCount, deleteComment, listComments } from "./build-comments";
import { openReports, reportContent, setHidden } from "./discussions";

let db: ReturnType<typeof sqliteDb>;
let ada: string;
let bo: string;
const NOW = Date.parse("2026-11-10T12:00:00Z");

beforeEach(async () => {
  db = sqliteDb();
  await ensureSchema(db);
  ada = ((await resolveSignIn(db, "github", { providerUserId: "1", login: "ada", displayName: "Ada", avatarUrl: null, email: null }, null)) as { accountId: string }).accountId;
  bo = ((await resolveSignIn(db, "github", { providerUserId: "2", login: "bo", displayName: "Bo", avatarUrl: null, email: null }, null)) as { accountId: string }).accountId;
  await startBuilder(db, ada, { handle: "ada", displayName: "Ada", bio: "" }, false);
});

describe("comments under a build (OP-46)", () => {
  it("a builder comments; oldest first; someone without a profile can't", async () => {
    const one = await addComment(db, ada, "pipebill", "How do you **bill** retries?", NOW);
    const two = await addComment(db, ada, "pipebill", "Answering myself: they're free.", NOW + 1000);
    expect(one.ok && two.ok).toBe(true);
    expect((await addComment(db, bo, "pipebill", "Hi", NOW)).ok).toBe(false);
    expect((await addComment(db, ada, "pipebill", "   ", NOW)).ok).toBe(false);
    const list = await listComments(db, "pipebill", { accountId: ada, moderator: false });
    expect(list.map((c) => [c.author, c.mine])).toEqual([["Ada", true], ["Ada", true]]);
    expect(await listComments(db, "other", { accountId: null, moderator: false })).toEqual([]);
  });

  it("a reported comment reaches moderation; hidden, only moderators see it", async () => {
    const r = (await addComment(db, ada, "pipebill", "Buy my course", NOW)) as { id: string };
    expect(await reportContent(db, bo, "comment", r.id, "spam")).toBe(true);
    const reports = await openReports(db);
    expect(reports.map((x) => [x.kind, x.href, x.title])).toEqual([["comment", `/builds/pipebill#c-${r.id}`, "Comment on pipebill"]]);
    await setHidden(db, "comment", r.id, true);
    expect(await openReports(db)).toEqual([]);
    expect(await listComments(db, "pipebill", { accountId: null, moderator: false })).toEqual([]);
    expect((await listComments(db, "pipebill", { accountId: null, moderator: true }))[0]!.hidden).toBe(true);
    expect(await commentCount(db, "pipebill")).toBe(0);
  });

  it("only the author deletes a comment", async () => {
    const r = (await addComment(db, ada, "pipebill", "Typo", NOW)) as { id: string };
    expect(await deleteComment(db, bo, r.id)).toBe(false);
    expect(await deleteComment(db, ada, r.id)).toBe(true);
    expect(await commentCount(db, "pipebill")).toBe(0);
  });
});
