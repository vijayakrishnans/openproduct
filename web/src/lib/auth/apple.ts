// Sign in with Apple (builder-profiles BP3). Apple's token endpoint wants a
// client secret that is itself a short JWT, signed ES256 with the team's .p8
// key; WebCrypto does that without a library. Apple's ID token is read for
// its subject after checking issuer, audience, expiry and the flow's nonce.
import { base64url, pkceChallenge } from "./crypto";

const enc = new TextEncoder();
const b64 = (obj: unknown) => base64url(enc.encode(JSON.stringify(obj)));

function pemToDer(pem: string): Uint8Array<ArrayBuffer> {
  // Secrets pasted into a dashboard sometimes arrive with literal "\n".
  const body = pem.replace(/\\n/g, "\n").replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  const bin = atob(body);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** The client secret for Apple's token endpoint: a JWT valid for five minutes. */
export async function appleClientSecret(
  o: { teamId: string; keyId: string; clientId: string; privateKey: string },
  now = Date.now(),
): Promise<string> {
  const key = await crypto.subtle.importKey("pkcs8", pemToDer(o.privateKey), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const iat = Math.floor(now / 1000);
  const head = `${b64({ alg: "ES256", kid: o.keyId })}.${b64({ iss: o.teamId, iat, exp: iat + 300, aud: "https://appleid.apple.com", sub: o.clientId })}`;
  // WebCrypto's ECDSA signature is already r‖s, the form JWS wants.
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(head));
  return `${head}.${base64url(new Uint8Array(sig))}`;
}

/** The nonce sent to Apple: derived from this flow's secret verifier, so only this browser's flow matches. */
export function appleNonce(verifier: string): Promise<string> {
  return pkceChallenge(`apple-nonce:${verifier}`);
}

/** The claims of an Apple ID token, after checking it was meant for this site and this flow. */
export function readAppleIdToken(token: string, expect: { clientId: string; nonce: string }, now = Date.now()): { sub: string } {
  const part = token.split(".")[1];
  if (!part) throw new Error("Apple ID token is malformed");
  const json = atob(part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "="));
  const c = JSON.parse(new TextDecoder().decode(Uint8Array.from(json, (ch) => ch.charCodeAt(0)))) as Record<string, unknown>;
  if (c.iss !== "https://appleid.apple.com") throw new Error("Apple ID token has the wrong issuer");
  const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
  if (!aud.includes(expect.clientId)) throw new Error("Apple ID token is for another client");
  if (typeof c.exp !== "number" || c.exp * 1000 < now) throw new Error("Apple ID token has expired");
  if (c.nonce !== expect.nonce) throw new Error("Apple ID token doesn't belong to this sign-in");
  if (typeof c.sub !== "string" || !c.sub) throw new Error("Apple ID token has no subject");
  return { sub: c.sub };
}
