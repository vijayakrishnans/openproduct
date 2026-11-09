// The short-lived cookie that carries one sign-in attempt from the
// provider's door back to the callback: which provider, the state value the
// callback must see echoed, the PKCE verifier, and where to land after.
import { base64url } from "./crypto";
import { isProvider, type ProviderId } from "./providers";

export const FLOW_COOKIE = "op_oauth";
export const FLOW_MAX_AGE = 10 * 60;

export type Flow = { provider: ProviderId; state: string; verifier: string; next: string };

export function encodeFlow(flow: Flow): string {
  return base64url(new TextEncoder().encode(JSON.stringify(flow)));
}

export function decodeFlow(raw: string | undefined | null): Flow | null {
  if (!raw || raw.length > 2000) return null;
  try {
    const b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64 + "===".slice((b64.length + 3) % 4));
    const v = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))) as Record<string, unknown>;
    if (typeof v.provider !== "string" || !isProvider(v.provider)) return null;
    if (typeof v.state !== "string" || typeof v.verifier !== "string" || typeof v.next !== "string") return null;
    return { provider: v.provider, state: v.state, verifier: v.verifier, next: v.next };
  } catch {
    return null;
  }
}

export function flowCookieOptions(secure: boolean) {
  return { httpOnly: true, secure, sameSite: "lax" as const, path: "/auth", maxAge: FLOW_MAX_AGE };
}
