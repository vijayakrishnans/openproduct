import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { ensureSchema } from "../server/db";
import { sqliteDb } from "../server/sqlite-d1.test-helper";
import { demoAccounts, isDemoAccount } from "./demo";
import { DEMO_MODERATOR, isModerator, moderatorsFor } from "./discussions";

let db: ReturnType<typeof sqliteDb>;
beforeEach(async () => {
  db = sqliteDb();
  await ensureSchema(db);
});

async function seedDemo(id: string, handle: string, login?: string) {
  await db.prepare(`INSERT INTO accounts (id, display_name, created_at) VALUES (?, ?, '2026-11-01')`).bind(id, handle).run();
  await db.prepare(`INSERT INTO builders (handle, account_id, kind, display_name, created_at) VALUES (?, ?, 'new', ?, '2026-11-01')`).bind(handle, id, handle).run();
  if (login) await db.prepare(`INSERT INTO identities (provider, provider_user_id, account_id, login, created_at) VALUES ('github', ?, ?, ?, '2026-11-01')`).bind(login, id, login).run();
}

describe("demo sign-in (OP-34)", () => {
  it("only demo- accounts are demo accounts", () => {
    expect(isDemoAccount("demo-mira")).toBe(true);
    expect(isDemoAccount("acc-real")).toBe(false);
    expect(isDemoAccount(null)).toBe(false);
  });

  it("lists the seeded demo accounts, moderator last, and nobody else", async () => {
    await seedDemo("demo-mod", "demo-moderator", DEMO_MODERATOR);
    await seedDemo("demo-mira", "mira-okafor");
    await seedDemo("acc-real", "someone-real");
    const list = await demoAccounts(db);
    expect(list.map((a) => [a.handle, a.moderator])).toEqual([
      ["mira-okafor", false],
      ["demo-moderator", true],
    ]);
  });

  it("the demo moderator moderates only while demo sign-in is on", async () => {
    await seedDemo("demo-mod", "demo-moderator", DEMO_MODERATOR);
    expect(await isModerator(db, "demo-mod", moderatorsFor({ DEMO_SIGNIN: "on" }))).toBe(true);
    expect(await isModerator(db, "demo-mod", moderatorsFor({ DEMO_SIGNIN: "off" }))).toBe(false);
    expect(await isModerator(db, "demo-mod", moderatorsFor({}))).toBe(false);
    expect(moderatorsFor({ MODERATORS: "alice" })).toEqual(["alice"]);
  });

  it("the deploy keeps wrangler.jsonc's demo setting in every environment, off included", () => {
    const dir = mkdtempSync(join(tmpdir(), "select-env-"));
    mkdirSync(join(dir, "scripts"));
    copyFileSync(join(__dirname, "../../../scripts/select-env.mjs"), join(dir, "scripts/select-env.mjs"));
    const run = (env: string, demo: "on" | "off") => {
      const config = readFileSync(join(__dirname, "../../../wrangler.jsonc"), "utf8").replace(/"DEMO_SIGNIN":\s*"[^"]*"/, `"DEMO_SIGNIN": "${demo}"`);
      writeFileSync(join(dir, "wrangler.jsonc"), config);
      execFileSync("node", [join(dir, "scripts/select-env.mjs")], { env: { ...process.env, ORUN_ENVIRONMENT: env } });
      return readFileSync(join(dir, "wrangler.jsonc"), "utf8");
    };
    expect(run("prod", "on")).toContain('"DEMO_SIGNIN": "on"');
    expect(run("stage", "on")).toContain('"DEMO_SIGNIN": "on"');
    expect(run("prod", "off")).toContain('"DEMO_SIGNIN": "off"');
    expect(run("stage", "off")).toContain('"DEMO_SIGNIN": "off"');
  });
});
