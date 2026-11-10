// A listing's pitch, live link, Orunbase workspace and cover image
// (list-your-build LB5). The pitch is the posts' Markdown subset, parsed to
// data on read, never HTML. A cover is PNG, JPEG or WebP up to 2 MB,
// recognised by its first bytes rather than its name, stored in R2 under a
// random key, and served by /covers with its type set and sniffing off.
import type { Db } from "../server/db";
import type { CoverBucket } from "../server/env";
import { randomToken } from "./crypto";
import { getListing, isMaintainer } from "./listings";

export const MAX_PITCH = 5000;
export const MAX_COVER_BYTES = 2 * 1024 * 1024;
export const COVER_TYPES = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" } as const;
export type CoverKind = keyof typeof COVER_TYPES;

type Write = { ok: true } | { ok: false; message: string };

/** What an image really is, from its magic bytes; null for anything else (SVG included). */
export function sniffImage(bytes: Uint8Array): CoverKind | null {
  const b = (i: number) => bytes[i] ?? -1;
  if ([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b(i) === v)) return "png";
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return "jpeg";
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  return null;
}

/** An https address for the live app, or null; refused when it isn't one. */
export function checkLiveUrl(raw: string): { ok: true; url: string | null } | { ok: false; message: string } {
  const s = raw.trim();
  if (!s) return { ok: true, url: null };
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return { ok: false, message: "The live link must be a full address, like https://your-build.app." };
  }
  if (u.protocol !== "https:" || u.username || u.password) return { ok: false, message: "The live link must start with https://." };
  if (u.toString().length > 300) return { ok: false, message: "That link is too long." };
  return { ok: true, url: u.toString() };
}

/** An Orunbase workspace reference, as openproduct.live's builds carry them: org_… or ws_…. */
export function checkWorkspaceRef(raw: string): { ok: true; ref: string | null } | { ok: false; message: string } {
  const s = raw.trim();
  if (!s) return { ok: true, ref: null };
  return /^(org|ws)_[A-Za-z0-9]{6,40}$/.test(s) ? { ok: true, ref: s } : { ok: false, message: "An Orunbase workspace looks like ws_ABC12345 or org_…; copy it from Orunbase." };
}

async function mayEdit(db: Db, slug: string, accountId: string): Promise<string | null> {
  const l = await getListing(db, slug);
  return l && isMaintainer(l, accountId) && l.state !== "hidden" ? l.slug : null;
}

export async function updateDetails(
  db: Db,
  slug: string,
  accountId: string,
  input: { pitch: string; liveUrl: string; workspaceRef: string },
  now = Date.now(),
): Promise<Write> {
  const own = await mayEdit(db, slug, accountId);
  if (!own) return { ok: false, message: "That listing isn't yours." };
  const pitch = input.pitch.trim();
  if (pitch.length > MAX_PITCH) return { ok: false, message: `A pitch is at most ${MAX_PITCH.toLocaleString("en")} characters.` };
  const live = checkLiveUrl(input.liveUrl);
  if (!live.ok) return live;
  const ws = checkWorkspaceRef(input.workspaceRef);
  if (!ws.ok) return ws;
  await db
    .prepare(`UPDATE listings SET pitch = ?, live_url = ?, workspace_ref = ?, updated_at = ? WHERE slug = ?`)
    .bind(pitch || null, live.url, ws.ref, new Date(now).toISOString(), own)
    .run();
  return { ok: true };
}

/** Store a new cover (replacing the old one) after checking what the file really is. */
export async function setCover(db: Db, bucket: CoverBucket, slug: string, accountId: string, file: { size: number; arrayBuffer(): Promise<ArrayBuffer> }, now = Date.now()): Promise<Write> {
  const own = await mayEdit(db, slug, accountId);
  if (!own) return { ok: false, message: "That listing isn't yours." };
  if (!file.size) return { ok: false, message: "Choose an image first." };
  if (file.size > MAX_COVER_BYTES) return { ok: false, message: "A cover is at most 2 MB." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffImage(bytes);
  if (!kind) return { ok: false, message: "A cover must be a PNG, JPEG or WebP image." };
  const key = `covers/${own}/${randomToken(12).replace(/[^A-Za-z0-9]/g, "x")}.${kind === "jpeg" ? "jpg" : kind}`;
  await bucket.put(key, bytes, { httpMetadata: { contentType: COVER_TYPES[kind], cacheControl: "public, max-age=31536000, immutable" } });
  const old = await db.prepare(`SELECT cover_key FROM listings WHERE slug = ?`).bind(own).first<{ cover_key: string | null }>();
  await db.prepare(`UPDATE listings SET cover_key = ?, updated_at = ? WHERE slug = ?`).bind(key, new Date(now).toISOString(), own).run();
  if (old?.cover_key) await bucket.delete(old.cover_key).catch(() => undefined);
  return { ok: true };
}

export async function removeCover(db: Db, bucket: CoverBucket | undefined, slug: string, accountId: string, now = Date.now()): Promise<Write> {
  const own = await mayEdit(db, slug, accountId);
  if (!own) return { ok: false, message: "That listing isn't yours." };
  const old = await db.prepare(`SELECT cover_key FROM listings WHERE slug = ?`).bind(own).first<{ cover_key: string | null }>();
  await db.prepare(`UPDATE listings SET cover_key = NULL, updated_at = ? WHERE slug = ?`).bind(new Date(now).toISOString(), own).run();
  if (old?.cover_key && bucket) await bucket.delete(old.cover_key).catch(() => undefined);
  return { ok: true };
}

/** Only keys this module writes can be served: covers/<slug>/<random>.<ext>. */
export const COVER_KEY = /^covers\/[a-z0-9-]{2,40}\/[A-Za-z0-9]{8,32}\.(png|jpg|webp)$/;
