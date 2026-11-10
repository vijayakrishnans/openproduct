import { beforeEach, describe, expect, it } from "vitest";
import { ensureSchema } from "../server/db";
import { sqliteDb } from "../server/sqlite-d1.test-helper";
import { buildTopics, buildsInTopic } from "../server/topics-here";
import { parseTopics } from "../topics";
import type { Build } from "../directory";
import { resolveSignIn } from "./accounts";
import { createArticle, deleteArticle, listArticles } from "./articles";
import { startBuilder } from "./builders";
import { createThread, listLocalThreads, setHidden } from "./discussions";
import { setTopics, topicActivity, topicsFor } from "./topics";

let db: ReturnType<typeof sqliteDb>;
const NOW = Date.parse("2026-11-10T12:00:00Z");
const DAY = 86_400_000;
let ada: string;

beforeEach(async () => {
  db = sqliteDb();
  await ensureSchema(db);
  ada = ((await resolveSignIn(db, "github", { providerUserId: "1", login: "ada", displayName: "Ada", avatarUrl: null, email: null }, null)) as { accountId: string }).accountId;
  await startBuilder(db, ada, { handle: "ada", displayName: "Ada", bio: "" }, false);
});

const post = async (title: string, topics: string, at = NOW) => {
  const r = await createArticle(db, ada, { title, body: "Body", video: "", build: "" }, at);
  if (!r.ok) throw new Error(r.message);
  await setTopics(db, "article", r.id, parseTopics(topics), at);
  return r.id;
};

describe("topics on writing (TC1)", () => {
  it("a post tagged cloudflare-workers shows on that topic, and carries its topics", async () => {
    const id = await post("Deploy Next.js to Workers", "#Cloudflare Workers, nextjs");
    const onTopic = await listArticles(db, { topic: "cloudflare-workers" });
    expect(onTopic.map((a) => [a.id, a.topics])).toEqual([[id, ["cloudflare-workers", "nextjs"]]]);
    expect(await listArticles(db, { topic: "auth" })).toEqual([]);
  });

  it("discussions carry topics too, and editing replaces them", async () => {
    const t = await createThread(db, ada, { tag: "question", title: "Which auth?", body: "Hmm" }, NOW);
    const id = (t as { id: string }).id;
    await setTopics(db, "thread", id, ["auth", "pricing"], NOW);
    expect((await listLocalThreads(db, "latest", null, 50, "auth")).map((x) => x.id)).toEqual([id]);
    await setTopics(db, "thread", id, ["pricing"], NOW);
    expect(await listLocalThreads(db, "latest", null, 50, "auth")).toEqual([]);
    expect((await topicsFor(db, "thread", [id])).get(id)).toEqual(["pricing"]);
  });

  it("counts visible writing per topic, and how much is from this week", async () => {
    await post("Old one", "auth", NOW - 10 * DAY);
    await post("New one", "auth, ai", NOW - DAY);
    const t = await createThread(db, ada, { tag: "question", title: "Q", body: "B" }, NOW);
    await setTopics(db, "thread", (t as { id: string }).id, ["ai"], NOW);
    const act = await topicActivity(db, NOW);
    expect(act.find((a) => a.slug === "auth")).toMatchObject({ writing: 2, thisWeek: 1, label: "Auth" });
    expect(act.find((a) => a.slug === "ai")).toMatchObject({ writing: 2, thisWeek: 2, label: "AI" });
  });

  it("hidden and deleted writing leaves its topics", async () => {
    const id = await post("Gone", "auth");
    const t = await createThread(db, ada, { tag: "question", title: "Q", body: "B" }, NOW);
    await setTopics(db, "thread", (t as { id: string }).id, ["auth"], NOW);
    await setHidden(db, "thread", (t as { id: string }).id, true);
    await deleteArticle(db, ada, id);
    expect(await topicActivity(db, NOW)).toEqual([]);
  });
});

describe("builds in a topic", () => {
  const b = (slug: string, category: string | null, stack: string[], changes7d = 0) =>
    ({ slug, category, stack, changes7d, upvotes: 0, tagline: "t", licence: null, roleCount: 0, publishedAt: null, lastCommitAt: null, pieces: [], cover: null, sample: [] }) as Build;
  it("a build's category and stack are its topics", () => {
    expect(buildTopics(b("x", "dev-tools", ["TypeScript", "Workers", "Next.js"]))).toEqual(["dev-tools", "typescript", "cloudflare-workers", "nextjs"]);
    const builds = [b("a", "dev-tools", ["workers"], 1), b("b", "media", ["Workers"], 5), b("c", "media", [])];
    expect(buildsInTopic(builds, "cloudflare-workers").map((x) => x.slug)).toEqual(["b", "a"]);
  });
});
