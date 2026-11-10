// The sign-in providers (design D9): authorization code with PKCE and a
// state value on every flow, against each provider's documented endpoints.
// Written here rather than taken from a library: it's three providers and a
// few `fetch` calls, and it keeps the sign-in path free of dependencies.
import type { Db } from "../server/db";
import type { AppEnv } from "../server/env";
import { appleClientSecret, appleNonce, readAppleIdToken } from "./apple";
import { pkceChallenge } from "./crypto";

export const PROVIDERS = ["github", "google", "apple", "orunbase"] as const;
export type ProviderId = (typeof PROVIDERS)[number];
/** Every kind of identity an account can hold: the OAuth providers, and an email link (BP3). */
export type IdentityProvider = ProviderId | "email";

export const PROVIDER_LABEL: Record<IdentityProvider, string> = {
  github: "GitHub",
  google: "Google",
  apple: "Apple",
  orunbase: "Orunbase",
  email: "Email",
};

export function isProvider(value: string): value is ProviderId {
  return (PROVIDERS as readonly string[]).includes(value);
}

/** Who signed in, as the provider says. `email` only when the provider verified it. */
export type ProviderProfile = {
  providerUserId: string;
  login: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  email: string | null;
};

/** Which providers can be offered: those whose secrets are set. Orunbase needs none. */
export function configuredProviders(env: AppEnv, hasDb: boolean): ProviderId[] {
  if (!hasDb) return [];
  return PROVIDERS.filter((p) => {
    if (p === "github") return !!(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET);
    if (p === "google") return !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
    if (p === "apple") return !!(env.APPLE_CLIENT_ID && env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_PRIVATE_KEY);
    // Orunbase registers clients only for approved redirect hosts, and this
    // site's isn't one yet (OP-35); offer it once ORUNBASE_SIGNIN is "on".
    return env.ORUNBASE_SIGNIN === "on";
  });
}

type Fetch = typeof fetch;
const UA = "openproduct-web (+https://github.com/vijayakrishnans/openproduct)";

async function json(res: Response, what: string): Promise<Record<string, unknown>> {
  if (!res.ok) throw new Error(`${what} answered ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/* ── Orunbase: discovery and a client this site registers for itself ── */

const ORUNBASE_DISCOVERY = "https://api.orunbase.com/.well-known/oauth-authorization-server";
type OrunbaseMeta = { authorization_endpoint: string; token_endpoint: string; registration_endpoint: string };
let orunbaseMeta: { at: number; meta: OrunbaseMeta } | null = null;

async function orunbaseDiscovery(f: Fetch): Promise<OrunbaseMeta> {
  if (orunbaseMeta && Date.now() - orunbaseMeta.at < 60 * 60 * 1000) return orunbaseMeta.meta;
  const m = await json(await f(ORUNBASE_DISCOVERY, { headers: { accept: "application/json" } }), "Orunbase discovery");
  const meta = {
    authorization_endpoint: str(m.authorization_endpoint),
    token_endpoint: str(m.token_endpoint),
    registration_endpoint: str(m.registration_endpoint),
  };
  if (!meta.authorization_endpoint || !meta.token_endpoint || !meta.registration_endpoint) {
    throw new Error("Orunbase discovery is missing an endpoint");
  }
  orunbaseMeta = { at: Date.now(), meta: meta as OrunbaseMeta };
  return orunbaseMeta.meta;
}

/** Orunbase's identity read lives on the same API host as its token endpoint. */
function orunbaseIdentityUrl(meta: OrunbaseMeta): string {
  return new URL("/v1/identity/me", meta.token_endpoint).toString();
}

// Orunbase forgets a self-registered client 30 days after it was last used.
// Re-register a little before that, keyed by redirect address so stage and
// prod each keep their own.
const ORUNBASE_CLIENT_REFRESH_MS = 25 * 24 * 60 * 60 * 1000;

export async function orunbaseClientId(db: Db, redirectUri: string, f: Fetch = fetch, now = Date.now()): Promise<string> {
  const key = `orunbase_client:${redirectUri}`;
  const row = await db.prepare(`SELECT value, updated_at FROM settings WHERE key = ?`).bind(key).first<{ value: string; updated_at: number }>();
  if (row && now - row.updated_at < ORUNBASE_CLIENT_REFRESH_MS) return row.value;
  const meta = await orunbaseDiscovery(f);
  const reg = await json(
    await f(meta.registration_endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        client_name: "openproduct",
        redirect_uris: [redirectUri],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code"],
        response_types: ["code"],
      }),
    }),
    "Orunbase client registration",
  );
  const clientId = str(reg.client_id);
  if (!clientId) throw new Error("Orunbase registration returned no client id");
  await db
    .prepare(`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`)
    .bind(key, clientId, now)
    .run();
  return clientId;
}

/** A successful Orunbase sign-in keeps the client alive on their side; note that here too. */
export async function touchOrunbaseClient(db: Db, redirectUri: string, now = Date.now()): Promise<void> {
  await db.prepare(`UPDATE settings SET updated_at = ? WHERE key = ?`).bind(now, `orunbase_client:${redirectUri}`).run();
}

/* ── The flows ── */

export async function authorizationUrl(
  provider: ProviderId,
  opts: { env: AppEnv; db: Db; redirectUri: string; state: string; verifier: string; fetch?: Fetch },
): Promise<string> {
  const challenge = await pkceChallenge(opts.verifier);
  const common = {
    response_type: "code",
    redirect_uri: opts.redirectUri,
    state: opts.state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  };
  if (provider === "github") {
    return `https://github.com/login/oauth/authorize?${new URLSearchParams({
      ...common,
      client_id: opts.env.GITHUB_CLIENT_ID!,
      scope: "read:user",
      allow_signup: "true",
    })}`;
  }
  if (provider === "google") {
    return `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
      ...common,
      client_id: opts.env.GOOGLE_CLIENT_ID!,
      scope: "openid email profile",
      prompt: "select_account",
    })}`;
  }
  if (provider === "apple") {
    // No scopes: the site doesn't need a name or an email from Apple, and
    // without them Apple returns to a plain GET (response_mode=query), the
    // same callback as everyone else. Apple doesn't take PKCE; a nonce bound
    // to this flow's verifier, checked in the ID token, does that job.
    return `https://appleid.apple.com/auth/authorize?${new URLSearchParams({
      response_type: "code",
      response_mode: "query",
      client_id: opts.env.APPLE_CLIENT_ID!,
      redirect_uri: opts.redirectUri,
      state: opts.state,
      nonce: await appleNonce(opts.verifier),
    })}`;
  }
  const meta = await orunbaseDiscovery(opts.fetch ?? fetch);
  const clientId = await orunbaseClientId(opts.db, opts.redirectUri, opts.fetch ?? fetch);
  // `identity`: a token that can only say who this is (Orunbase's narrow scope).
  return `${meta.authorization_endpoint}?${new URLSearchParams({ ...common, client_id: clientId, scope: "identity" })}`;
}

/** Trade the code for a token, read who signed in, and drop the token. */
export async function completeSignIn(
  provider: ProviderId,
  opts: { env: AppEnv; db: Db; redirectUri: string; code: string; verifier: string; fetch?: Fetch },
): Promise<ProviderProfile> {
  const f = opts.fetch ?? fetch;
  const form = (extra: Record<string, string>) =>
    new URLSearchParams({
      grant_type: "authorization_code",
      code: opts.code,
      redirect_uri: opts.redirectUri,
      code_verifier: opts.verifier,
      ...extra,
    });
  const post = (url: string, body: URLSearchParams) =>
    f(url, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" }, body });

  if (provider === "github") {
    const tok = await json(
      await post("https://github.com/login/oauth/access_token", form({ client_id: opts.env.GITHUB_CLIENT_ID!, client_secret: opts.env.GITHUB_CLIENT_SECRET! })),
      "GitHub token",
    );
    const access = str(tok.access_token);
    if (!access) throw new Error(`GitHub refused the code: ${str(tok.error) ?? "no token"}`);
    const u = await json(
      await f("https://api.github.com/user", { headers: { authorization: `Bearer ${access}`, accept: "application/vnd.github+json", "user-agent": UA } }),
      "GitHub user",
    );
    if (typeof u.id !== "number" && typeof u.id !== "string") throw new Error("GitHub returned no user id");
    return {
      providerUserId: String(u.id),
      login: str(u.login),
      displayName: str(u.name) ?? str(u.login),
      avatarUrl: str(u.avatar_url),
      // GitHub's profile email isn't guaranteed verified; not stored (D11).
      email: null,
    };
  }

  if (provider === "google") {
    const tok = await json(
      await post("https://oauth2.googleapis.com/token", form({ client_id: opts.env.GOOGLE_CLIENT_ID!, client_secret: opts.env.GOOGLE_CLIENT_SECRET! })),
      "Google token",
    );
    const access = str(tok.access_token);
    if (!access) throw new Error("Google refused the code");
    const u = await json(await f("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${access}` } }), "Google user");
    const sub = str(u.sub);
    if (!sub) throw new Error("Google returned no subject");
    return {
      providerUserId: sub,
      login: null,
      displayName: str(u.name),
      avatarUrl: str(u.picture),
      email: u.email_verified === true ? str(u.email) : null,
    };
  }

  if (provider === "apple") {
    const env = opts.env;
    const secret = await appleClientSecret({ teamId: env.APPLE_TEAM_ID!, keyId: env.APPLE_KEY_ID!, clientId: env.APPLE_CLIENT_ID!, privateKey: env.APPLE_PRIVATE_KEY! });
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code: opts.code,
      redirect_uri: opts.redirectUri,
      client_id: env.APPLE_CLIENT_ID!,
      client_secret: secret,
    });
    const tok = await json(await post("https://appleid.apple.com/auth/token", body), "Apple token");
    const idToken = str(tok.id_token);
    if (!idToken) throw new Error("Apple returned no ID token");
    // The token came straight from Apple over TLS in exchange for our code,
    // so its claims are checked rather than its signature (OIDC 3.1.3.7).
    const claims = readAppleIdToken(idToken, { clientId: env.APPLE_CLIENT_ID!, nonce: await appleNonce(opts.verifier) });
    return { providerUserId: claims.sub, login: null, displayName: null, avatarUrl: null, email: null };
  }

  const meta = await orunbaseDiscovery(f);
  const clientId = await orunbaseClientId(opts.db, opts.redirectUri, f);
  const tok = await json(await post(meta.token_endpoint, form({ client_id: clientId })), "Orunbase token");
  const access = str(tok.access_token);
  if (!access) throw new Error("Orunbase refused the code");
  const raw = await json(await f(orunbaseIdentityUrl(meta), { headers: { authorization: `Bearer ${access}`, accept: "application/json" } }), "Orunbase identity");
  // The read may come wrapped in the platform's `{ data: … }` envelope.
  const me = (raw.data && typeof raw.data === "object" ? raw.data : raw) as Record<string, unknown>;
  const subjectId = str(me.subjectId);
  if (!subjectId) throw new Error("Orunbase returned no subject");
  await touchOrunbaseClient(opts.db, opts.redirectUri);
  return { providerUserId: subjectId, login: null, displayName: str(me.displayName), avatarUrl: null, email: null };
}
