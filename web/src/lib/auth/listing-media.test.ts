import { beforeEach, describe, expect, it } from "vitest";
import { ensureSchema } from "../server/db";
import { sqliteDb } from "../server/sqlite-d1.test-helper";
import { resolveSignIn } from "./accounts";
import { startBuilder } from "./builders";
import { COVER_KEY, MAX_COVER_BYTES, checkLiveUrl, checkWorkspaceRef, removeCover, setCover, sniffImage, updateDetails } from "./listing-media";
import { createListing, getListing, listingToBuild, listingToDetail, type CreateDeps } from "./listings";

let db: ReturnType<typeof sqliteDb>;
const NOW = Date.parse("2026-11-10T12:00:00Z");
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16]);
const WEBP = new TextEncoder().encode("RIFF\u0000\u0000\u0000\u0000WEBPVP8 ");
const file = (bytes: Uint8Array, size = bytes.length) => ({ size, arrayBuffer: async () => bytes.slice().buffer as ArrayBuffer });

/** An in-memory R2 bucket. */
function bucket() {
  const store = new Map<string, { bytes: Uint8Array; type?: string }>();
  return {
    store,
    put: async (key: string, value: ArrayBuffer | Uint8Array, o?: { httpMetadata?: { contentType?: string } }) => {
      store.set(key, { bytes: new Uint8Array(value as ArrayBuffer), type: o?.httpMetadata?.contentType });
    },
    get: async (key: string) => {
      const v = store.get(key);
      return v ? { body: new Response(v.bytes.slice().buffer as ArrayBuffer).body!, httpMetadata: { contentType: v.type } } : null;
    },
    delete: async (key: string) => void store.delete(key),
  };
}

async function builder(id: string, handle: string) {
  const a = ((await resolveSignIn(db, "github", { providerUserId: id, login: handle, displayName: handle, avatarUrl: null, email: null }, null)) as { accountId: string }).accountId;
  await startBuilder(db, a, { handle, displayName: handle, bio: "" }, false);
  return a;
}

let ada: string;
beforeEach(async () => {
  db = sqliteDb();
  await ensureSchema(db);
  ada = await builder("1", "ada");
  const deps: CreateDeps = { auth: {}, categories: [], takenThere: async () => false, fetch: async () => Response.json({ private: false, owner: { login: "ada" }, topics: [] }) };
  await createListing(db, ada, { repo: "ada/tool", slug: "", tagline: "T", category: "dev-tools", stack: "" }, deps, NOW);
});

describe("covers (LB5)", () => {
  it("knows images by their first bytes, not their names", () => {
    expect(sniffImage(PNG)).toBe("png");
    expect(sniffImage(JPEG)).toBe("jpeg");
    expect(sniffImage(WEBP)).toBe("webp");
    expect(sniffImage(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"))).toBeNull();
    expect(sniffImage(new TextEncoder().encode("<html><script>alert(1)</script>"))).toBeNull();
    expect(sniffImage(new Uint8Array())).toBeNull();
  });

  it("stores a real image under a random key with its true type, and shows it on the card", async () => {
    const b = bucket();
    expect((await setCover(db, b, "tool", ada, file(PNG), NOW)).ok).toBe(true);
    const l = (await getListing(db, "tool"))!;
    expect(l.coverKey).toMatch(COVER_KEY);
    expect(b.store.get(l.coverKey!)?.type).toBe("image/png");
    expect(listingToBuild(l).cover).toEqual({ src: `/${l.coverKey}`, alt: "tool: cover image" });
  });

  it("refuses a text file named .png, an empty file, and anything over 2 MB", async () => {
    const b = bucket();
    const r = await setCover(db, b, "tool", ada, file(new TextEncoder().encode("<script>alert(1)</script>")), NOW);
    expect(r).toEqual({ ok: false, message: "A cover must be a PNG, JPEG or WebP image." });
    expect((await setCover(db, b, "tool", ada, file(new Uint8Array(), 0), NOW)).ok).toBe(false);
    expect((await setCover(db, b, "tool", ada, file(PNG, MAX_COVER_BYTES + 1), NOW)).ok).toBe(false);
    expect(b.store.size).toBe(0);
  });

  it("replacing deletes the old object; removing clears it", async () => {
    const b = bucket();
    await setCover(db, b, "tool", ada, file(PNG), NOW);
    const first = (await getListing(db, "tool"))!.coverKey!;
    await setCover(db, b, "tool", ada, file(JPEG), NOW + 1);
    const second = (await getListing(db, "tool"))!.coverKey!;
    expect(second).not.toBe(first);
    expect([...b.store.keys()]).toEqual([second]);
    await removeCover(db, b, "tool", ada, NOW + 2);
    expect((await getListing(db, "tool"))!.coverKey).toBeNull();
    expect(b.store.size).toBe(0);
  });

  it("only maintainers can change the cover", async () => {
    const eve = await builder("2", "eve");
    expect((await setCover(db, bucket(), "tool", eve, file(PNG), NOW)).ok).toBe(false);
    expect((await removeCover(db, bucket(), "tool", eve, NOW)).ok).toBe(false);
  });

  it("serves only keys the upload writes", () => {
    expect(COVER_KEY.test("covers/tool/abcdEFGH1234.png")).toBe(true);
    for (const bad of ["covers/../secrets.txt", "covers/tool/x.svg", "covers/tool/abcdEFGH1234.html", "other/tool/abcdEFGH1234.png"]) expect(COVER_KEY.test(bad), bad).toBe(false);
  });
});

describe("pitch and links (LB5)", () => {
  it("saves a pitch, an https live link and a workspace, shown on the build page", async () => {
    expect((await updateDetails(db, "tool", ada, { pitch: "## Why\nBecause.", liveUrl: "https://tool.app/", workspaceRef: "ws_ABC12345" }, NOW)).ok).toBe(true);
    const d = listingToDetail((await getListing(db, "tool"))!);
    expect(d).toMatchObject({ pitch: "## Why\nBecause.", liveUrl: "https://tool.app/", workspaceRef: "ws_ABC12345" });
  });

  it("refuses non-https links, bad workspaces, long pitches and outsiders", async () => {
    expect(checkLiveUrl("http://tool.app").ok).toBe(false);
    expect(checkLiveUrl("javascript:alert(1)").ok).toBe(false);
    expect(checkLiveUrl("https://user:pw@tool.app").ok).toBe(false);
    expect(checkLiveUrl("")).toEqual({ ok: true, url: null });
    expect(checkWorkspaceRef("ws_ENVF0PHY")).toEqual({ ok: true, ref: "ws_ENVF0PHY" });
    expect(checkWorkspaceRef("org_68a85ab22553456da57da988f424f856").ok).toBe(true);
    expect(checkWorkspaceRef("https://evil.example").ok).toBe(false);
    expect((await updateDetails(db, "tool", ada, { pitch: "x".repeat(5001), liveUrl: "", workspaceRef: "" }, NOW)).ok).toBe(false);
    const eve = await builder("2", "eve");
    expect((await updateDetails(db, "tool", eve, { pitch: "mine", liveUrl: "", workspaceRef: "" }, NOW)).ok).toBe(false);
  });
});
