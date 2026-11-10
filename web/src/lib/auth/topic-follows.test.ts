import { beforeEach, describe, expect, it } from "vitest";
import { ensureSchema } from "../server/db";
import { sqliteDb } from "../server/sqlite-d1.test-helper";
import { parseTopics } from "../topics";
import { resolveSignIn } from "./accounts";
import { createArticle, listArticles } from "./articles";
import { startBuilder } from "./builders";
import { createThread, listLocalThreads } from "./discussions";
import { setTopics } from "./topics";
import { followedTopics, recordTopicSearch, toggleTopicFollow, topicFollowState, topicSignals, trendingScore } from "./topic-follows";

let db: ReturnType<typeof sqliteDb>;
const NOW = Date.parse("2026-11-10T12:00:00Z");
const DAY = 86_400_000;
let ada: string;
let bo: string;

const account = async (id: string, login: string) =>
  ((await resolveSignIn(db, "github", { providerUserId: id, login, displayName: login, avatarUrl: null, email: null }, null)) as { accountId: string }).accountId;

beforeEach(async () => {
  db = sqliteDb();
  await ensureSchema(db);
  ada = await account("1", "ada");
  bo = await account("2", "bo");
  await startBuilder(db, ada, { handle: "ada", displayName: "Ada", bio: "" }, false);
});

const post = async (title: string, topics: string, at: number) => {
  const r = await createArticle(db, ada, { title, body: "Body", video: "", build: "" }, at);
  if (!r.ok) throw new Error(r.message);
  await setTopics(db, "article", r.id, parseTopics(topics), at);
  return r.id;
};

describe("personal topics (TC4)", () => {
  it("follow toggles, normalises the topic, and counts followers", async () => {
    expect(await toggleTopicFollow(db, ada, "#Next.js", NOW)).toBe(true);
    expect(await toggleTopicFollow(db, bo, "nextjs", NOW)).toBe(true);
    expect(await topicFollowState(db, "nextjs", ada)).toEqual({ count: 2, mine: true });
    expect(await toggleTopicFollow(db, ada, "nextjs", NOW)).toBe(false);
    expect(await topicFollowState(db, "nextjs", ada)).toEqual({ count: 1, mine: false });
    expect(await topicFollowState(db, "nextjs", null)).toEqual({ count: 1, mine: false });
    expect(await toggleTopicFollow(db, ada, "  ", NOW)).toBeNull();
  });

  it("after following two topics, For you holds only their writing, newest first", async () => {
    const a = await post("Auth one", "auth", NOW - 3 * DAY);
    const b = await post("AI one", "ai", NOW - DAY);
    await post("Pricing one", "pricing", NOW);
    const t = await createThread(db, ada, { tag: "question", title: "Which model?", body: "B" }, NOW - 2 * DAY);
    const tid = (t as { id: string }).id;
    await setTopics(db, "thread", tid, ["ai"], NOW - 2 * DAY);
    await toggleTopicFollow(db, bo, "auth", NOW);
    await toggleTopicFollow(db, bo, "ai", NOW + 1);
    const topics = await followedTopics(db, bo);
    expect(topics).toEqual(["ai", "auth"]);
    expect((await listArticles(db, { topics })).map((x) => x.id)).toEqual([b, a]);
    expect((await listLocalThreads(db, "latest", null, 20, undefined, { topics })).map((x) => x.id)).toEqual([tid]);
    expect(await listArticles(db, { topics: [] })).toEqual([]);
  });

  it("stores searches only as a count per topic per day, and drops last week's", async () => {
    await recordTopicSearch(db, "auth", NOW);
    await recordTopicSearch(db, "Auth", NOW);
    await recordTopicSearch(db, "auth", NOW - 10 * DAY);
    const rows = (await db.prepare(`SELECT * FROM topic_searches ORDER BY day`).all()).results;
    expect(rows).toEqual([
      { topic: "auth", day: "2026-10-31", count: 1 },
      { topic: "auth", day: "2026-11-10", count: 2 },
    ]);
    const s = await topicSignals(db, NOW);
    expect(s.searches.get("auth")).toBe(2);
  });

  it("a topic searched for often climbs Trending", async () => {
    await post("A", "auth", NOW);
    await post("B", "ai", NOW);
    await toggleTopicFollow(db, bo, "auth", NOW);
    for (let i = 0; i < 9; i++) await recordTopicSearch(db, "ai", NOW);
    const s = await topicSignals(db, NOW);
    const score = (slug: string) => trendingScore({ searches: s.searches.get(slug) ?? 0, thisWeek: 1, newFollows: s.follows.get(slug) ?? 0 });
    expect(score("auth")).toBe(8);
    expect(score("ai")).toBe(12);
  });
});
