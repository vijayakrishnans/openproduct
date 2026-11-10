import { beforeEach, describe, expect, it } from "vitest";
import { ensureSchema } from "../server/db";
import { sqliteDb } from "../server/sqlite-d1.test-helper";
import { resolveSignIn } from "./accounts";
import { createArticle } from "./articles";
import { startBuilder } from "./builders";
import { createReply, createThread, markSolution } from "./discussions";
import { setTopics } from "./topics";
import { contributorScore, earnedLine, helpfulState, knownFor, mostHelpful, toggleHelpful, topContributors } from "./rankings";

let db: ReturnType<typeof sqliteDb>;
const NOW = Date.parse("2026-11-10T12:00:00Z");
const DAY = 86_400_000;
const ids: Record<string, string> = {};

beforeEach(async () => {
  db = sqliteDb();
  await ensureSchema(db);
  for (const [i, h] of ["ada", "bo", "cy", "di"].entries()) {
    ids[h] = ((await resolveSignIn(db, "github", { providerUserId: String(i + 1), login: h, displayName: h, avatarUrl: null, email: null }, null)) as { accountId: string }).accountId;
    await startBuilder(db, ids[h]!, { handle: h, displayName: h.toUpperCase(), bio: "" }, false);
  }
});

const post = async (who: string, kind: string, topic: string, at = NOW - DAY) => {
  const r = await createArticle(db, ids[who]!, { title: `${kind} by ${who}`, body: "Body", video: "", build: "", kind } as never, at);
  if (!r.ok) throw new Error(r.message);
  await setTopics(db, "article", r.id, [topic], at);
  return r.id;
};

describe("helpful (TC5)", () => {
  it("one per account, toggles, and never on your own writing", async () => {
    const a = await post("ada", "tutorial", "auth");
    expect(await toggleHelpful(db, ids.ada!, "article", a)).toBeNull();
    expect(await toggleHelpful(db, ids.bo!, "article", a)).toBe(true);
    expect(await toggleHelpful(db, ids.cy!, "article", a)).toBe(true);
    expect((await helpfulState(db, "article", [a], ids.bo!)).get(a)).toEqual({ count: 2, mine: true });
    expect(await toggleHelpful(db, ids.bo!, "article", a)).toBe(false);
    expect((await helpfulState(db, "article", [a], ids.bo!)).get(a)).toEqual({ count: 1, mine: false });
    expect(await toggleHelpful(db, ids.bo!, "thread", a)).toBeNull();
  });
});

describe("top contributors (TC5)", () => {
  it("names the top three with what earned the place, by the printed formula", async () => {
    // ada: 2 tutorials (6) + 2 helpful = 8
    const t1 = await post("ada", "tutorial", "auth");
    await post("ada", "tutorial", "auth");
    await toggleHelpful(db, ids.bo!, "article", t1);
    await toggleHelpful(db, ids.cy!, "article", t1);
    // bo: one accepted solution (5) + 1 helpful on it = 6
    const issue = (await createThread(db, ids.di!, { tag: "question", title: "Login loops", body: "Help", kind: "issue" }, NOW - DAY)) as { id: string };
    await setTopics(db, "thread", issue.id, ["auth"], NOW - DAY);
    const fix = (await createReply(db, ids.bo!, issue.id, "Clear the cookie path", NOW - DAY + 1000)) as { id: string };
    await markSolution(db, issue.id, ids.di!, fix.id);
    await toggleHelpful(db, ids.ada!, "post", fix.id);
    // di: raised the issue (3)
    // cy: a blog from 100 days ago doesn't count
    await post("cy", "blog", "auth", NOW - 100 * DAY);

    const top = await topContributors(db, "auth", { now: NOW });
    expect(top.map((c) => [c.handle, c.score])).toEqual([["ada", 8], ["bo", 6], ["di", 3]]);
    expect(earnedLine(top[0]!)).toBe("2 tutorials, 2 helpful votes");
    expect(earnedLine(top[1]!)).toBe("1 solution, 1 helpful vote");
    expect(earnedLine(top[2]!)).toBe("1 issue raised");

    const helpful = await mostHelpful(db, "auth");
    expect(helpful.map((h) => [h.kind, h.score])).toEqual([["post", 6], ["article", 2]]);
  });

  it("ties go to whoever contributed first", async () => {
    await post("bo", "blog", "ai", NOW - 2 * DAY);
    await post("ada", "blog", "ai", NOW - 3 * DAY);
    expect((await topContributors(db, "ai", { now: NOW })).map((c) => c.handle)).toEqual(["ada", "bo"]);
  });

  it("merged PRs count in the topics of the build they went to", async () => {
    await db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES ('build_repos', ?, 0)`).bind(JSON.stringify({ "acme/pipebill": "pipebill", "ada/own": "own" })).run();
    await db.prepare(`INSERT INTO merged_prs (login, by_repo, fetched_at) VALUES ('ada', ?, ?)`).bind(JSON.stringify({ "acme/pipebill": 2, "ada/own": 9 }), new Date(NOW).toISOString()).run();
    const buildTopics = new Map([["pipebill", ["billing", "cloudflare-workers"]], ["own", ["billing"]]]);
    const top = await topContributors(db, "billing", { now: NOW, buildTopics });
    expect(top.map((c) => [c.handle, c.prs, c.score])).toEqual([["ada", 2, 10]]);
    expect((await knownFor(db, ids.ada!, { now: NOW, buildTopics })).map((k) => k.topic).sort()).toEqual(["billing", "cloudflare-workers"]);
  });

  it("the score is 3 × writing + helpful + 5 × solutions + 5 × PRs", () => {
    expect(contributorScore({ writing: { tutorial: 2, discussion: 1 }, helpful: 4, solutions: 1, prs: 2 })).toBe(9 + 4 + 5 + 10);
  });
});
