import { beforeEach, describe, expect, it } from "vitest";
import { ensureSchema } from "../server/db";
import { sqliteDb } from "../server/sqlite-d1.test-helper";
import { resolveSignIn } from "./accounts";
import { startBuilder } from "./builders";
import { allStats, fetchRepoStats, isStale, refreshStale, refreshStats, STATS_TTL_MS } from "./listing-stats";
import { createListing, getListing, listingToBuild, setPublished, type CreateDeps } from "./listings";

let db: ReturnType<typeof sqliteDb>;
const NOW = Date.parse("2026-11-10T12:00:00Z");
const HOUR = 3600_000;

type Repo = { private?: boolean; gone?: boolean; archived?: boolean; commits?: number; limited?: boolean };
/** A fake GitHub for one repo's metadata, commits since a week ago, and languages. */
function github(repos: Record<string, Repo>) {
  const calls: string[] = [];
  return {
    calls,
    auth: {},
    fetch: async (url: string) => {
      calls.push(url);
      const m = /repos\/([^/]+\/[^/?]+)(\/commits|\/languages)?/.exec(url)!;
      const r = repos[m[1]!.toLowerCase()];
      if (r?.limited) return new Response("{}", { status: 403 });
      if (!r || r.gone || r.private) return new Response("{}", { status: 404 });
      if (m[2] === "/commits") {
        const page = Number(new URL(url).searchParams.get("page") ?? 1);
        const left = Math.max(0, (r.commits ?? 0) - (page - 1) * 100);
        return Response.json(Array.from({ length: Math.min(100, left) }, (_, i) => ({ commit: { committer: { date: new Date(NOW - (i + 1) * HOUR).toISOString() } } })));
      }
      if (m[2] === "/languages") return Response.json({ TypeScript: 9000, CSS: 300, HTML: 100, Shell: 10 });
      return Response.json({ private: false, archived: !!r.archived, license: { spdx_id: "Apache-2.0" }, pushed_at: new Date(NOW - HOUR).toISOString(), owner: { login: "ada" } });
    },
  };
}

async function publishedListing(repo = "ada/tool") {
  const a = ((await resolveSignIn(db, "github", { providerUserId: "1", login: "ada", displayName: "Ada", avatarUrl: null, email: null }, null)) as { accountId: string }).accountId;
  await startBuilder(db, a, { handle: "ada", displayName: "Ada", bio: "" }, false);
  const deps: CreateDeps = { ...github({ [repo]: {} }), categories: [], takenThere: async () => false };
  await createListing(db, a, { repo, slug: "", tagline: "T", category: "dev-tools", stack: "" }, deps, NOW);
  await setPublished(db, repo.split("/")[1]!, a, true, NOW);
}

beforeEach(async () => {
  db = sqliteDb();
  await ensureSchema(db);
});

describe("live from the repo (LB2)", () => {
  it("counts commits to the default branch in 7 days, with licence, last commit and top languages", async () => {
    const s = await fetchRepoStats("ada/tool", github({ "ada/tool": { commits: 230 } }), NOW);
    expect(s).toMatchObject({ status: "ok", changes7d: 230, licence: "Apache-2.0", languages: ["typescript", "css", "html"], archived: false });
    expect(s !== "limited" && s?.lastCommitAt).toBe(new Date(NOW - HOUR).toISOString());
  });

  it("a merged commit shows as a change once the hour is up", async () => {
    await publishedListing();
    const g = github({ "ada/tool": { commits: 2 } });
    await refreshStats(db, "tool", "ada/tool", g, NOW);
    const l = (await getListing(db, "tool"))!;
    expect(listingToBuild(l, (await allStats(db)).get("tool")).changes7d).toBe(2);
    // A new commit lands; within the hour the cached number stands, after it the new one shows.
    const g2 = github({ "ada/tool": { commits: 3 } });
    expect(await refreshStale(db, g2, { now: NOW + HOUR / 2 })).toBe(0);
    expect(await refreshStale(db, g2, { now: NOW + HOUR + 1 })).toBe(1);
    expect(listingToBuild(l, (await allStats(db)).get("tool")).changes7d).toBe(3);
  });

  it("a repo gone private reads as missing, and coming back public restores it", async () => {
    await publishedListing();
    await refreshStats(db, "tool", "ada/tool", github({ "ada/tool": { private: true } }), NOW);
    expect((await allStats(db)).get("tool")?.status).toBe("missing");
    await refreshStats(db, "tool", "ada/tool", github({ "ada/tool": { commits: 1 } }), NOW + 2 * HOUR);
    expect((await allStats(db)).get("tool")?.status).toBe("ok");
  });

  it("marks archived repos", async () => {
    const s = await fetchRepoStats("ada/tool", github({ "ada/tool": { archived: true } }), NOW);
    expect(s !== "limited" && s?.archived).toBe(true);
  });

  it("keeps the last good numbers and backs off when GitHub rate-limits", async () => {
    await publishedListing();
    await refreshStats(db, "tool", "ada/tool", github({ "ada/tool": { commits: 4 } }), NOW);
    const limited = github({ "ada/tool": { limited: true } });
    expect((await refreshStats(db, "tool", "ada/tool", limited, NOW + 2 * HOUR))?.changes7d).toBe(4);
    const calls = limited.calls.length;
    await refreshStats(db, "tool", "ada/tool", limited, NOW + 2 * HOUR + 60_000);
    expect(limited.calls.length).toBe(calls);
  });

  it("only published listings are refreshed, stalest first, a few at a time", async () => {
    await publishedListing();
    const g = github({ "ada/tool": { commits: 1 } });
    expect(await refreshStale(db, g, { now: NOW, limit: 3 })).toBe(1);
    expect(isStale((await allStats(db)).get("tool"), NOW + STATS_TTL_MS - 1)).toBe(false);
    expect(isStale((await allStats(db)).get("tool"), NOW + STATS_TTL_MS)).toBe(true);
  });
});

describe("the repo's licence wins once read", () => {
  it("shows no licence when GitHub has none, even if one was stored before", async () => {
    await publishedListing();
    await db.prepare(`UPDATE listings SET licence = 'MIT' WHERE slug = 'tool'`).run();
    const l = (await getListing(db, "tool"))!;
    expect(listingToBuild(l, null).licence).toBe("MIT");
    const read = { status: "ok" as const, changes7d: 1, licence: null, lastCommitAt: null, languages: [], archived: false, contributors: [], fetchedAt: new Date(NOW).toISOString() };
    expect(listingToBuild(l, read).licence).toBeNull();
  });
});
