import { beforeEach, describe, expect, it } from "vitest";
import { ensureSchema } from "../server/db";
import { sqliteDb } from "../server/sqlite-d1.test-helper";
import { resolveSignIn } from "./accounts";
import { buildRepos, mergedPrsOfAccount, type Fetch } from "./github-prs";

let db: ReturnType<typeof sqliteDb>;
const NOW = Date.parse("2026-11-10T12:00:00Z");
const HOUR = 3600_000;
const REPOS = { "pullely/rateboard": "rateboard", "pullely/aitally": "aitally" };

/** A fake GitHub search: answers from `prs`, counts calls, or fails with `status`. */
function github(prs: { repo: string }[], status = 200) {
  const calls: string[] = [];
  const fetch: Fetch = async (url, init) => {
    calls.push(url);
    expect((init?.headers as Record<string, string>)["user-agent"]).toBe("openproduct-web");
    if (status !== 200) return new Response("{}", { status });
    const items = prs.map((p) => ({ repository_url: `https://api.github.com/repos/${p.repo}` }));
    return Response.json({ total_count: items.length, items });
  };
  return { fetch, calls };
}

const signIn = async (provider: "github" | "orunbase", id: string, login: string | null) =>
  ((await resolveSignIn(db, provider, { providerUserId: id, login, displayName: id, avatarUrl: null, email: null }, null)) as { accountId: string })
    .accountId;
const deps = (g: ReturnType<typeof github>, now = NOW) => ({ fetch: g.fetch, auth: {}, loadRepos: async () => REPOS, now });

beforeEach(async () => {
  db = sqliteDb();
  await ensureSchema(db);
});

describe("merged PRs from GitHub", () => {
  it("counts a GitHub builder's merged PRs to builds, without anyone setting it", async () => {
    const ada = await signIn("github", "1", "ada");
    const g = github([{ repo: "pullely/rateboard" }, { repo: "pullely/rateboard" }, { repo: "pullely/aitally" }]);
    const m = await mergedPrsOfAccount(db, ada, [], deps(g));
    expect(m).toMatchObject({ login: "ada", total: 3, byBuild: { rateboard: 2, aitally: 1 } });
    expect(decodeURIComponent(g.calls[0]!)).toContain("is:pr is:merged author:ada repo:pullely/aitally repo:pullely/rateboard");
  });

  it("gives no answer at all to an account without GitHub", async () => {
    const orun = await signIn("orunbase", "o1", null);
    const g = github([{ repo: "pullely/rateboard" }]);
    expect(await mergedPrsOfAccount(db, orun, [], deps(g))).toBeNull();
    expect(g.calls).toHaveLength(0);
  });

  it("leaves out builds the builder maintains", async () => {
    const ada = await signIn("github", "1", "ada");
    const m = await mergedPrsOfAccount(db, ada, ["rateboard"], deps(github([{ repo: "pullely/rateboard" }])));
    expect(m?.total).toBe(0);
  });

  it("asks GitHub at most once a day per login", async () => {
    const ada = await signIn("github", "1", "ada");
    const g = github([{ repo: "pullely/rateboard" }]);
    await mergedPrsOfAccount(db, ada, [], deps(g));
    await mergedPrsOfAccount(db, ada, [], deps(g, NOW + 5 * HOUR));
    expect(g.calls).toHaveLength(1);
    await mergedPrsOfAccount(db, ada, [], deps(g, NOW + 25 * HOUR));
    expect(g.calls).toHaveLength(2);
  });

  it("keeps the last good count when GitHub fails, and backs off when rate limited", async () => {
    const ada = await signIn("github", "1", "ada");
    await mergedPrsOfAccount(db, ada, [], deps(github([{ repo: "pullely/rateboard" }])));
    const limited = github([], 403);
    expect((await mergedPrsOfAccount(db, ada, [], deps(limited, NOW + 25 * HOUR)))?.total).toBe(1);
    expect(limited.calls).toHaveLength(1);
    await mergedPrsOfAccount(db, ada, [], deps(limited, NOW + 25 * HOUR + 60_000));
    expect(limited.calls).toHaveLength(1);
    const bob = await signIn("github", "2", "bob");
    expect(await mergedPrsOfAccount(db, bob, [], deps(github([], 500), NOW))).toBeNull();
  });

  it("refreshes the build repos daily and keeps yesterday's if the refresh fails", async () => {
    let loads = 0;
    const load = async () => (++loads === 1 ? REPOS : null);
    expect(await buildRepos(db, load, NOW)).toEqual(REPOS);
    expect(await buildRepos(db, load, NOW + HOUR)).toEqual(REPOS);
    expect(loads).toBe(1);
    expect(await buildRepos(db, load, NOW + 25 * HOUR)).toEqual(REPOS);
    expect(loads).toBe(2);
  });
});
