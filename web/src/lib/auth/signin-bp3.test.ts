import { beforeEach, describe, expect, it } from "vitest";
import { ensureSchema } from "../server/db";
import { sqliteDb } from "../server/sqlite-d1.test-helper";
import { resolveSignIn } from "./accounts";
import { appleClientSecret, appleNonce, readAppleIdToken } from "./apple";
import { base64url } from "./crypto";
import { LINKS_PER_WINDOW, LINK_TTL_MS, consumeEmailLink, createEmailLink, maskEmail, normalizeEmail, peekEmailLink } from "./email-link";
import { configuredProviders } from "./providers";

let db: ReturnType<typeof sqliteDb>;
const NOW = Date.parse("2026-11-10T12:00:00Z");

beforeEach(async () => {
  db = sqliteDb();
  await ensureSchema(db);
});

describe("email links", () => {
  it("normalise addresses and refuse junk", () => {
    expect(normalizeEmail("  Ada@Example.COM ")).toBe("ada@example.com");
    for (const bad of ["ada", "ada@", "@example.com", "ada@example", "a b@example.com", "ada@exa_mple.com", "<ada@example.com>", `${"a".repeat(250)}@x.io`]) {
      expect(normalizeEmail(bad), bad).toBeNull();
    }
  });

  it("work once", async () => {
    const r = await createEmailLink(db, "ada@example.com", "/community", NOW);
    if (!r.ok) throw new Error("not created");
    expect(await peekEmailLink(db, r.token, NOW + 1000)).toEqual({ email: "ada@example.com" });
    expect(await consumeEmailLink(db, r.token, NOW + 2000)).toEqual({ email: "ada@example.com", next: "/community" });
    expect(await consumeEmailLink(db, r.token, NOW + 3000)).toBeNull();
    expect(await peekEmailLink(db, r.token, NOW + 3000)).toBeNull();
  });

  it("expire after 15 minutes", async () => {
    const r = await createEmailLink(db, "ada@example.com", "/", NOW);
    if (!r.ok) throw new Error("not created");
    expect(await consumeEmailLink(db, r.token, NOW + LINK_TTL_MS + 1)).toBeNull();
  });

  it("store only a hash, and never a next that leaves the site", async () => {
    const r = await createEmailLink(db, "ada@example.com", "//evil.example/x", NOW);
    if (!r.ok) throw new Error("not created");
    const row = await db.prepare(`SELECT * FROM email_links`).first<Record<string, unknown>>();
    expect(JSON.stringify(row)).not.toContain(r.token);
    expect((await consumeEmailLink(db, r.token, NOW))?.next).toBe("/");
  });

  it("limit how many go to one address", async () => {
    for (let i = 0; i < LINKS_PER_WINDOW; i++) expect((await createEmailLink(db, "ada@example.com", "/", NOW + i)).ok).toBe(true);
    expect((await createEmailLink(db, "ada@example.com", "/", NOW + 10)).ok).toBe(false);
    expect((await createEmailLink(db, "bob@example.com", "/", NOW + 10)).ok).toBe(true);
    expect((await createEmailLink(db, "ada@example.com", "/", NOW + LINK_TTL_MS + 10)).ok).toBe(true);
  });

  it("refuse tokens that aren't the right shape", async () => {
    expect(await consumeEmailLink(db, "short", NOW)).toBeNull();
    expect(await consumeEmailLink(db, "x".repeat(43), NOW)).toBeNull();
  });

  it("become an email identity, never merged with another account by address", async () => {
    const google = await resolveSignIn(db, "google", { providerUserId: "g1", login: null, displayName: "Ada", avatarUrl: null, email: "ada@example.com" }, null);
    const email = await resolveSignIn(db, "email", { providerUserId: "ada@example.com", login: null, displayName: null, avatarUrl: null, email: "ada@example.com" }, null);
    expect(google.kind).toBe("signed-in");
    expect(email.kind).toBe("signed-in");
    expect((email as { accountId: string }).accountId).not.toBe((google as { accountId: string }).accountId);
  });

  it("mask the address on the confirm page", () => {
    expect(maskEmail("ada@example.com")).toBe("a**@example.com");
    expect(maskEmail("x@example.com")).toBe("x**@example.com");
  });
});

describe("Sign in with Apple", () => {
  it("is offered only when all four Apple secrets are set", () => {
    const base = { GITHUB_CLIENT_ID: undefined };
    expect(configuredProviders(base, true)).not.toContain("apple");
    expect(configuredProviders({ APPLE_CLIENT_ID: "a", APPLE_TEAM_ID: "t", APPLE_KEY_ID: "k" }, true)).not.toContain("apple");
    expect(configuredProviders({ APPLE_CLIENT_ID: "a", APPLE_TEAM_ID: "t", APPLE_KEY_ID: "k", APPLE_PRIVATE_KEY: "p" }, true)).toContain("apple");
  });

  it("signs a client secret Apple can verify with the key's public half", async () => {
    const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const der = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
    const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...der))}\n-----END PRIVATE KEY-----`;
    const jwt = await appleClientSecret({ teamId: "TEAM123", keyId: "KEY123", clientId: "live.openproduct.web", privateKey: pem }, NOW);
    const [h, p, s] = jwt.split(".");
    const decode = (x: string) => JSON.parse(atob(x.replace(/-/g, "+").replace(/_/g, "/")));
    expect(decode(h!)).toEqual({ alg: "ES256", kid: "KEY123" });
    expect(decode(p!)).toMatchObject({ iss: "TEAM123", sub: "live.openproduct.web", aud: "https://appleid.apple.com", iat: NOW / 1000, exp: NOW / 1000 + 300 });
    const sig = Uint8Array.from(atob(s!.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
    const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pair.publicKey, sig, new TextEncoder().encode(`${h}.${p}`));
    expect(ok).toBe(true);
  });

  it("accepts only an ID token for this client and this flow", async () => {
    const nonce = await appleNonce("verifier-1");
    const token = (claims: Record<string, unknown>) =>
      `x.${base64url(new TextEncoder().encode(JSON.stringify({ iss: "https://appleid.apple.com", aud: "web", exp: NOW / 1000 + 600, nonce, sub: "001234.abc", ...claims })))}.sig`;
    expect(readAppleIdToken(token({}), { clientId: "web", nonce }, NOW)).toEqual({ sub: "001234.abc" });
    expect(() => readAppleIdToken(token({ iss: "https://evil.example" }), { clientId: "web", nonce }, NOW)).toThrow();
    expect(() => readAppleIdToken(token({ aud: "other" }), { clientId: "web", nonce }, NOW)).toThrow();
    expect(() => readAppleIdToken(token({ exp: NOW / 1000 - 1 }), { clientId: "web", nonce }, NOW)).toThrow();
    const other = await appleNonce("another flow");
    expect(() => readAppleIdToken(token({}), { clientId: "web", nonce: other }, NOW)).toThrow();
  });
});

describe("Apple's sign-in address", () => {
  it("asks for no scopes, returns by GET, and binds the flow with a nonce instead of PKCE", async () => {
    const { authorizationUrl } = await import("./providers");
    const env = { APPLE_CLIENT_ID: "live.openproduct.web", APPLE_TEAM_ID: "t", APPLE_KEY_ID: "k", APPLE_PRIVATE_KEY: "p" };
    const url = new URL(await authorizationUrl("apple", { env, db, redirectUri: "https://example.com/auth/apple/callback", state: "s1", verifier: "v1" }));
    expect(url.origin + url.pathname).toBe("https://appleid.apple.com/auth/authorize");
    expect(url.searchParams.get("response_mode")).toBe("query");
    expect(url.searchParams.get("scope")).toBeNull();
    expect(url.searchParams.get("code_challenge")).toBeNull();
    expect(url.searchParams.get("nonce")).toBe(await appleNonce("v1"));
    expect(url.searchParams.get("state")).toBe("s1");
  });
});
