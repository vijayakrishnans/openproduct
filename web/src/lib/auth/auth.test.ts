import { beforeEach, describe, expect, it } from "vitest";
import { ensureSchema, MIGRATIONS } from "../server/db";
import { sqliteDb } from "../server/sqlite-d1.test-helper";
import { deleteAccount, githubLoginOf, identitiesOf, resolveSignIn } from "./accounts";
import {
  builderByHandle,
  builderOfAccount,
  canClaim,
  checkHandle,
  claimBuilder,
  githubLoginFromUrl,
  startBuilder,
  updateNewBuilder,
} from "./builders";
import { pkceChallenge, safeEqual, sha256Hex } from "./crypto";
import { decodeFlow, encodeFlow } from "./flow-cookie";
import { safeNext, sameOrigin } from "./guards";
import { authorizationUrl, completeSignIn, configuredProviders, orunbaseClientId, type ProviderProfile } from "./providers";
import { createSession, invalidateSession, validateSession } from "./session";

const DAY = 24 * 60 * 60 * 1000;
let db: ReturnType<typeof sqliteDb>;
beforeEach(async () => {
  db = sqliteDb();
  await ensureSchema(db);
});

const profile = (id: string, extra: Partial<ProviderProfile> = {}): ProviderProfile => ({
  providerUserId: id,
  login: null,
  displayName: "Ada",
  avatarUrl: null,
  email: null,
  ...extra,
});

describe("schema", () => {
  it("applies every migration once, and again is a no-op", async () => {
    await ensureSchema(db); // same object: skipped
    const fresh = sqliteDb();
    await ensureSchema(fresh);
    await ensureSchema({ ...fresh, prepare: fresh.prepare, batch: fresh.batch }); // a new handle on the same database
    const rows = fresh.raw.prepare("SELECT version FROM schema_migrations").all();
    expect(rows.map((r) => (r as { version: number }).version)).toEqual(MIGRATIONS.map((m) => m.version));
  });
});

describe("sessions", () => {
  it("stores only the token's hash, and the token finds the account", async () => {
    const { accountId } = (await resolveSignIn(db, "github", profile("1"), null)) as { accountId: string };
    const { token } = await createSession(db, accountId);
    const stored = db.raw.prepare("SELECT id_hash FROM sessions").all() as { id_hash: string }[];
    expect(stored).toHaveLength(1);
    expect(stored[0]!.id_hash).not.toContain(token);
    expect(stored[0]!.id_hash).toBe(await sha256Hex(token));
    expect((await validateSession(db, token))?.account.id).toBe(accountId);
  });

  it("a stored hash used as a cookie signs nobody in", async () => {
    const { accountId } = (await resolveSignIn(db, "github", profile("1"), null)) as { accountId: string };
    await createSession(db, accountId);
    const hash = (db.raw.prepare("SELECT id_hash FROM sessions").get() as { id_hash: string }).id_hash;
    expect(await validateSession(db, hash)).toBeNull();
  });

  it("expires after 30 days and is deleted on sight", async () => {
    const { accountId } = (await resolveSignIn(db, "github", profile("1"), null)) as { accountId: string };
    const now = Date.now();
    const { token } = await createSession(db, accountId, now);
    expect(await validateSession(db, token, now + 31 * DAY)).toBeNull();
    expect(db.raw.prepare("SELECT count(*) AS n FROM sessions").get()).toEqual({ n: 0 });
  });

  it("extends on use once less than half remains", async () => {
    const { accountId } = (await resolveSignIn(db, "github", profile("1"), null)) as { accountId: string };
    const now = Date.now();
    const { token } = await createSession(db, accountId, now);
    expect((await validateSession(db, token, now + 5 * DAY))?.refreshed).toBe(false);
    const later = now + 20 * DAY;
    const s = await validateSession(db, token, later);
    expect(s?.refreshed).toBe(true);
    expect(s?.expiresAt).toBe(later + 30 * DAY);
  });

  it("sign-out ends it, and junk cookies are ignored", async () => {
    const { accountId } = (await resolveSignIn(db, "github", profile("1"), null)) as { accountId: string };
    const { token } = await createSession(db, accountId);
    await invalidateSession(db, token);
    expect(await validateSession(db, token)).toBeNull();
    expect(await validateSession(db, "")).toBeNull();
    expect(await validateSession(db, "x".repeat(500))).toBeNull();
  });
});

describe("accounts: one account, many ways in", () => {
  it("a new identity while signed out makes an account; the same one signs back in", async () => {
    const first = await resolveSignIn(db, "github", profile("42", { login: "ada" }), null);
    expect(first).toMatchObject({ kind: "signed-in", created: true });
    const again = await resolveSignIn(db, "github", profile("42", { login: "ada-renamed" }), null);
    expect(again).toMatchObject({ kind: "signed-in", created: false, accountId: (first as { accountId: string }).accountId });
    expect(await githubLoginOf(db, (first as { accountId: string }).accountId)).toBe("ada-renamed");
  });

  it("signed in, a second provider joins the same account", async () => {
    const { accountId } = (await resolveSignIn(db, "github", profile("42"), null)) as { accountId: string };
    expect(await resolveSignIn(db, "google", profile("g-1"), accountId)).toEqual({ kind: "linked", accountId });
    expect((await identitiesOf(db, accountId)).map((i) => i.provider)).toEqual(["github", "google"]);
    // Either way in now opens the same account.
    expect(await resolveSignIn(db, "google", profile("g-1"), null)).toMatchObject({ accountId });
  });

  it("never moves an identity that belongs to another account", async () => {
    const a = (await resolveSignIn(db, "github", profile("1"), null)) as { accountId: string };
    const b = (await resolveSignIn(db, "google", profile("2"), null)) as { accountId: string };
    expect(await resolveSignIn(db, "github", profile("1"), b.accountId)).toEqual({ kind: "taken" });
    expect((await identitiesOf(db, a.accountId)).map((i) => i.provider)).toEqual(["github"]);
  });

  it("never merges accounts because their emails match", async () => {
    const a = (await resolveSignIn(db, "google", profile("g", { email: "ada@example.com" }), null)) as { accountId: string };
    const b = (await resolveSignIn(db, "orunbase", profile("o", { email: "ada@example.com" }), null)) as { accountId: string };
    expect(a.accountId).not.toBe(b.accountId);
  });

  it("deleting an account takes its identities, sessions and builder profile with it", async () => {
    const { accountId } = (await resolveSignIn(db, "github", profile("1", { login: "ada" }), null)) as { accountId: string };
    const { token } = await createSession(db, accountId);
    await startBuilder(db, accountId, { handle: "ada-builds", displayName: "Ada", bio: "" }, false);
    await deleteAccount(db, accountId);
    expect(await validateSession(db, token)).toBeNull();
    expect(await builderByHandle(db, "ada-builds")).toBeNull();
    expect(db.raw.prepare("SELECT count(*) AS n FROM identities").get()).toEqual({ n: 0 });
  });
});

describe("builder profiles", () => {
  it("handle rules", () => {
    expect(checkHandle("@Ada-Builds")).toEqual({ ok: true, handle: "ada-builds" });
    for (const bad of ["a", "x".repeat(31), "-ada", "ada-", "a--da", "ada_b", "ada b", "new", "account"]) {
      expect(checkHandle(bad).ok).toBe(false);
    }
  });

  it("reads a GitHub login only from a profile address", () => {
    expect(githubLoginFromUrl("https://github.com/Ada")).toBe("Ada");
    expect(githubLoginFromUrl("https://www.github.com/ada/")).toBe("ada");
    expect(githubLoginFromUrl("https://github.com/ada/repo")).toBeNull();
    expect(githubLoginFromUrl("http://github.com/ada")).toBeNull();
    expect(githubLoginFromUrl("https://github.com.evil.example/ada")).toBeNull();
    expect(githubLoginFromUrl("https://gist.github.com/ada")).toBeNull();
    expect(githubLoginFromUrl(null)).toBeNull();
  });

  it("a claim is proved only by a matching GitHub login", () => {
    expect(canClaim("https://github.com/Ada", "ada")).toBe(true);
    expect(canClaim("https://github.com/ada", "ada2")).toBe(false);
    expect(canClaim("https://github.com/ada", null)).toBe(false);
    expect(canClaim(null, "ada")).toBe(false);
  });

  it("one profile per account, one account per profile", async () => {
    const a = (await resolveSignIn(db, "github", profile("1"), null)) as { accountId: string };
    const b = (await resolveSignIn(db, "github", profile("2"), null)) as { accountId: string };
    expect(await claimBuilder(db, a.accountId, "rahulvarghese")).toEqual({ ok: true, handle: "rahulvarghese" });
    expect((await claimBuilder(db, b.accountId, "RahulVarghese")).ok).toBe(false);
    expect((await claimBuilder(db, a.accountId, "arca")).ok).toBe(false);
    expect((await builderOfAccount(db, a.accountId))?.kind).toBe("claimed");
  });

  it("a new profile can't take a handle openproduct.live or this site already uses", async () => {
    const a = (await resolveSignIn(db, "github", profile("1"), null)) as { accountId: string };
    const b = (await resolveSignIn(db, "github", profile("2"), null)) as { accountId: string };
    expect((await startBuilder(db, a.accountId, { handle: "arca", displayName: "A", bio: "" }, true)).ok).toBe(false);
    expect(await startBuilder(db, a.accountId, { handle: "ada", displayName: "Ada", bio: "Builds" }, false)).toEqual({ ok: true, handle: "ada" });
    expect((await startBuilder(db, b.accountId, { handle: "ADA", displayName: "B", bio: "" }, false)).ok).toBe(false);
    expect((await startBuilder(db, b.accountId, { handle: "bea", displayName: "  ", bio: "" }, false)).ok).toBe(false);
  });

  it("only a profile started here can be renamed here", async () => {
    const a = (await resolveSignIn(db, "github", profile("1"), null)) as { accountId: string };
    await claimBuilder(db, a.accountId, "rahulvarghese");
    expect((await updateNewBuilder(db, a.accountId, { displayName: "X", bio: "" })).ok).toBe(false);
    const b = (await resolveSignIn(db, "github", profile("2"), null)) as { accountId: string };
    await startBuilder(db, b.accountId, { handle: "bea", displayName: "Bea", bio: "" }, false);
    expect((await updateNewBuilder(db, b.accountId, { displayName: "Bea S", bio: "Hi" })).ok).toBe(true);
    expect(await builderOfAccount(db, b.accountId)).toMatchObject({ displayName: "Bea S", bio: "Hi" });
  });
});

describe("request guards", () => {
  it("only lands on paths of this site", () => {
    expect(safeNext("/builders/ada?x=1")).toBe("/builders/ada?x=1");
    for (const bad of [null, "", "https://evil.example", "//evil.example", "/\\evil.example", "builders", "/a\nb"]) {
      expect(safeNext(bad)).toBe("/");
    }
  });

  it("writes must come from this origin", () => {
    const req = (origin: string | null) =>
      new Request("https://op.example/signout", { method: "POST", headers: origin ? { origin } : {} });
    expect(sameOrigin(req("https://op.example"))).toBe(true);
    expect(sameOrigin(req("https://evil.example"))).toBe(false);
    expect(sameOrigin(req(null))).toBe(false);
  });

  it("the flow cookie round-trips and refuses anything else", () => {
    const flow = { provider: "github" as const, state: "s", verifier: "v", next: "/x" };
    expect(decodeFlow(encodeFlow(flow))).toEqual(flow);
    expect(decodeFlow("garbage")).toBeNull();
    expect(decodeFlow(encodeFlow({ ...flow, provider: "evil" as never }))).toBeNull();
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
  });
});

describe("providers", () => {
  const env = { GITHUB_CLIENT_ID: "gh-id", GITHUB_CLIENT_SECRET: "gh-secret" };

  it("offers only providers whose secrets are set; Orunbase needs none", () => {
    expect(configuredProviders({}, true)).toEqual(["orunbase"]);
    expect(configuredProviders(env, true)).toEqual(["github", "orunbase"]);
    expect(configuredProviders(env, false)).toEqual([]);
  });

  it("sends state and an S256 PKCE challenge", async () => {
    const url = new URL(await authorizationUrl("github", { env, db, redirectUri: "https://op.example/auth/github/callback", state: "st", verifier: "ver" }));
    expect(url.origin + url.pathname).toBe("https://github.com/login/oauth/authorize");
    expect(url.searchParams.get("state")).toBe("st");
    expect(url.searchParams.get("code_challenge")).toBe(await pkceChallenge("ver"));
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("client_id")).toBe("gh-id");
  });

  it("reads a GitHub user and keeps no email", async () => {
    const calls: string[] = [];
    const fake = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("access_token")) {
        expect(String(init?.body)).toContain("code_verifier=ver");
        return Response.json({ access_token: "t" });
      }
      return Response.json({ id: 7, login: "ada", name: "Ada L", avatar_url: "https://a/x.png", email: "ada@example.com" });
    }) as typeof fetch;
    const p = await completeSignIn("github", { env, db, redirectUri: "r", code: "c", verifier: "ver", fetch: fake });
    expect(p).toEqual({ providerUserId: "7", login: "ada", displayName: "Ada L", avatarUrl: "https://a/x.png", email: null });
  });

  it("keeps a Google email only when Google verified it", async () => {
    const genv = { GOOGLE_CLIENT_ID: "g", GOOGLE_CLIENT_SECRET: "s" };
    const fake = (verified: boolean) =>
      (async (input: RequestInfo | URL) =>
        String(input).includes("token")
          ? Response.json({ access_token: "t" })
          : Response.json({ sub: "g1", name: "Ada", email: "ada@example.com", email_verified: verified })) as typeof fetch;
    expect((await completeSignIn("google", { env: genv, db, redirectUri: "r", code: "c", verifier: "v", fetch: fake(true) })).email).toBe("ada@example.com");
    expect((await completeSignIn("google", { env: genv, db, redirectUri: "r", code: "c", verifier: "v", fetch: fake(false) })).email).toBeNull();
  });

  it("registers an Orunbase client once, reuses it, and re-registers before Orunbase forgets it", async () => {
    let registrations = 0;
    const fake = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/oauth-authorization-server")) {
        return Response.json({
          authorization_endpoint: "https://app.orun.example/oauth/authorize",
          token_endpoint: "https://api.orun.example/v1/auth/oauth2/token",
          registration_endpoint: "https://api.orun.example/v1/auth/oauth2/register",
        });
      }
      registrations++;
      return Response.json({ client_id: `dcr_${registrations}` });
    }) as typeof fetch;
    const now = Date.now();
    expect(await orunbaseClientId(db, "https://op.example/cb", fake, now)).toBe("dcr_1");
    expect(await orunbaseClientId(db, "https://op.example/cb", fake, now + DAY)).toBe("dcr_1");
    expect(await orunbaseClientId(db, "https://op.example/cb", fake, now + 26 * DAY)).toBe("dcr_2");
    expect(registrations).toBe(2);
  });

  it("asks Orunbase for the identity scope only, and reads the enveloped answer", async () => {
    const fake = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/oauth-authorization-server")) {
        return Response.json({
          authorization_endpoint: "https://app.orun.example/oauth/authorize",
          token_endpoint: "https://api.orun.example/v1/auth/oauth2/token",
          registration_endpoint: "https://api.orun.example/v1/auth/oauth2/register",
        });
      }
      if (url.endsWith("/register")) return Response.json({ client_id: "dcr_x" });
      if (url.endsWith("/token")) return Response.json({ access_token: "t" });
      expect(url).toBe("https://api.orun.example/v1/identity/me");
      return Response.json({ data: { subjectId: "usr_1", displayName: "Ada" } });
    }) as typeof fetch;
    const url = new URL(await authorizationUrl("orunbase", { env: {}, db, redirectUri: "https://op.example/auth/orunbase/callback", state: "s", verifier: "v", fetch: fake }));
    expect(url.searchParams.get("scope")).toBe("identity");
    expect(url.searchParams.get("client_id")).toBe("dcr_x");
    const p = await completeSignIn("orunbase", { env: {}, db, redirectUri: "https://op.example/auth/orunbase/callback", code: "c", verifier: "v", fetch: fake });
    expect(p).toMatchObject({ providerUserId: "usr_1", displayName: "Ada", email: null });
  });
});
