// The one place this app reads openproduct.live's public API and turns its
// shapes into the app's own (design.md §1). Every read is tolerant: a missing
// field is a blank, never a crash, and a failed read is an `unreachable`
// result the page renders, never a 500.
import { repoOf } from "./merged-prs";
import { roleType, stackName, type RoleType } from "./roles";

export const API_ORIGIN = "https://api.openproduct.live";

export type PieceKey = "data" | "sign-in" | "payments" | "deploy";
export type Piece = { key: PieceKey; label: string; provider: string | null; movedLast: boolean };

export type Build = {
  slug: string;
  tagline: string;
  category: string | null;
  licence: string | null;
  changes7d: number;
  upvotes: number;
  roleCount: number;
  stack: string[];
  publishedAt: string | null;
  lastCommitAt: string | null;
  pieces: Piece[];
  /** The listing's hero screenshot, when the maintainer uploaded one. */
  cover: { src: string; alt: string } | null;
  /** Which values on this build are sample, not from the API. */
  sample: string[];
};

export type Topic = { value: string; label: string; products: number };

export type Directory =
  | { ok: true; builds: Build[]; topics: Topic[]; fetchedAt: string }
  | { ok: false; reason: string };

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === "object" ? (v as Json) : {});
const val = (v: unknown): unknown => obj(v).value;
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** A stable small hash, so sample values do not change between visits. */
export function seed(slug: string): number {
  let h = 2166136261;
  for (let i = 0; i < slug.length; i++) h = Math.imul(h ^ slug.charCodeAt(i), 16777619);
  return h >>> 0;
}

const PROVIDERS: Record<PieceKey, string[]> = {
  data: ["Supabase Postgres", "Cloudflare D1", "Turso", "Neon Postgres"],
  "sign-in": ["Supabase Auth", "Clerk", "Passkeys", "Better Auth"],
  payments: ["Stripe", "Razorpay", "Paddle"],
  deploy: ["Cloudflare"],
};
const LABELS: Record<PieceKey, string> = { data: "Data", "sign-in": "Sign-in", payments: "Payments", deploy: "Deploy" };

/**
 * The app map. The API does not describe a build's integrations yet, so the
 * pieces are SAMPLE, derived from the slug: deploy and data always present,
 * sign-in and payments on some builds, and one piece marked as moved last.
 */
export function samplePieces(slug: string): Piece[] {
  const s = seed(slug);
  const keys: PieceKey[] = ["data", "deploy"];
  if (s % 3 !== 0) keys.push("sign-in");
  if (s % 5 < 2) keys.push("payments");
  const moved = keys[(s >>> 4) % keys.length];
  return (["sign-in", "data", "payments", "deploy"] as PieceKey[]).map((key) => {
    const present = keys.includes(key);
    const list = PROVIDERS[key];
    return {
      key,
      label: LABELS[key],
      provider: present ? list[(s >>> 8) % list.length] : null,
      movedLast: present && key === moved,
    };
  });
}

/** The hero image from a listing's media, else its first image; null when it has none. */
export function toCover(media: unknown): Build["cover"] {
  const items = (Array.isArray(media) ? media : [])
    .map((m) => obj(val(m)))
    .filter((m) => typeof m.ref === "string" && /^[a-f0-9]{64}\.(png|jpe?g|webp|gif)$/.test(m.ref));
  const pick = items.find((m) => m.kind === "hero") ?? items[0];
  if (!pick) return null;
  return { src: `${API_ORIGIN}/v1/media/${pick.ref}`, alt: str(pick.alt) ?? "" };
}

export function toBuild(p: Json): Build | null {
  const slug = str(p.slug);
  if (!slug) return null;
  const metrics = obj(p.metrics);
  const metric = (k: string) => num(val(metrics[k]));
  const stack = val(p.stack);
  return {
    slug,
    tagline: str(val(p.tagline)) ?? "",
    category: str(val(p.category)),
    licence: str(val(p.licence)),
    changes7d: metric("merges.7d"),
    upvotes: metric("endorsements.total"),
    roleCount: Array.isArray(p.openings) ? p.openings.length : num(val(p.openRoles)),
    stack: Array.isArray(stack) ? stack.filter((x): x is string => typeof x === "string") : [],
    publishedAt: str(p.publishedAt),
    lastCommitAt: str(val(p.lastCommitAt)),
    pieces: samplePieces(slug),
    cover: toCover(p.media),
    sample: ["pieces"],
  };
}

/** Most active = (changes + 1) × (upvotes + 1), the PDF's formula. */
export const activity = (b: Build) => (b.changes7d + 1) * (b.upvotes + 1);

export type Sort = "active" | "newest" | "upvoted" | "roles";
export const SORTS: { key: Sort; label: string }[] = [
  { key: "active", label: "Most active" },
  { key: "newest", label: "Newest" },
  { key: "upvoted", label: "Upvoted" },
  { key: "roles", label: "Roles" },
];

export function sortBuilds(builds: Build[], sort: Sort): Build[] {
  const by: Record<Sort, (b: Build) => number> = {
    active: activity,
    newest: (b) => (b.publishedAt ? Date.parse(b.publishedAt) : 0),
    upvoted: (b) => b.upvotes,
    roles: (b) => b.roleCount,
  };
  return [...builds].sort((a, b) => by[sort](b) - by[sort](a) || a.slug.localeCompare(b.slug));
}

/** No public change in seven days: still listed, in the quiet row. */
export const belowFloor = (b: Build) => b.changes7d === 0;

/** A listing with no tagline is an unfinished draft; the directory leaves it out. */
export const listable = (b: Build) => b.tagline.length > 0 && b.category !== null;

async function getJson(path: string): Promise<Json> {
  const res = await fetch(`${API_ORIGIN}${path}`, { headers: { accept: "application/json" }, cache: "no-store" });
  if (!res.ok) throw new Error(`${path} answered ${res.status}`);
  return obj(await res.json());
}

export async function loadDirectory(): Promise<Directory> {
  try {
    const [list, topics] = await Promise.all([
      getJson("/v1/products"),
      getJson("/v1/public/openproduct/topics").catch(() => ({})),
    ]);
    const raw = obj(list.data).products;
    const builds = (Array.isArray(raw) ? raw : []).map((p) => toBuild(obj(p))).filter((b): b is Build => !!b && listable(b));
    const rawTopics = obj(obj(topics).data).topics;
    const topicList: Topic[] = (Array.isArray(rawTopics) ? rawTopics : [])
      .map((t) => obj(t))
      .map((t) => ({ value: str(t.value) ?? "", label: str(t.label) ?? "", products: num(t.products) }))
      .filter((t) => t.value && t.label && t.products > 0);
    return { ok: true, builds, topics: topicList, fetchedAt: new Date().toISOString() };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "unknown error" };
  }
}

export const initials = (slug: string) => slug.replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase();


/* ── One build ─────────────────────────────────────────────────────── */

export type Role = {
  id: string;
  title: string;
  type: RoleType;
  /** The maintainer's brief for the seat, when they wrote one. */
  description: string | null;
  /** Hours or terms, when the maintainer gave them. */
  commitment: string | null;
  /** The build's own stack: where a first PR would land. */
  skills: string[];
};
export type LogEntry = { ago: string; kind: "deploy" | "feature" | "people" | "data" | "roles"; text: string };

export type BuildDetail = Build & {
  pitch: string | null;
  repoUrl: string | null;
  liveUrl: string | null;
  workspaceRef: string | null;
  maintainers: number;
  roles: Role[];
  /** SAMPLE until the API has a build log: derived from the slug. */
  log: LogEntry[];
  pinned: string;
};


export function sampleLog(b: Build): { log: LogEntry[]; pinned: string } {
  const s = seed(b.slug);
  const moved = b.pieces.find((p) => p.movedLast);
  const log: LogEntry[] = [
    { ago: "14m", kind: "deploy", text: `Deployed to ${moved?.key === "deploy" ? "prod" : "stage and prod"} on Cloudflare` },
    { ago: "3h", kind: "feature", text: `Shipped a change to ${moved?.label.toLowerCase() ?? "the app"}` },
    { ago: "1d", kind: "people", text: "New contributor merged their first PR" },
    { ago: "4d", kind: "data", text: "Added a column to the main table" },
    { ago: "6d", kind: "roles", text: "Opened a role" },
  ].slice(0, 3 + (s % 3)) as LogEntry[];
  return { log, pinned: "Looking for people who want to own a piece of this. Open roles are on the right." };
}

export async function loadBuild(slug: string): Promise<BuildDetail | null | "unreachable"> {
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(slug)) return null;
  let res: Response;
  try {
    res = await fetch(`${API_ORIGIN}/v1/products/${slug}`, { headers: { accept: "application/json" }, cache: "no-store" });
  } catch {
    return "unreachable";
  }
  if (res.status === 404) return null;
  if (!res.ok) return "unreachable";
  const data = obj(obj(await res.json()).data);
  const p = obj(data.product ?? data);
  const b = toBuild(p);
  if (!b || !listable(b)) return null;
  const openings = Array.isArray(p.openings) ? p.openings.map(obj) : [];
  const roles: Role[] = openings
    .map((o, i) => ({
      id: str(o.id) ?? String(i),
      title: str(val(o.title)) ?? "",
      type: roleType(str(val(o.title)) ?? ""),
      description: str(val(o.description)),
      commitment: str(val(o.commitment)),
      skills: b.stack.slice(0, 3).map(stackName),
    }))
    .filter((r) => r.title);
  const maintainers = Array.isArray(p.maintainers) ? p.maintainers.length : 0;
  return {
    ...b,
    pitch: str(val(p.pitch)),
    repoUrl: str(val(p.repoUrl)),
    liveUrl: str(val(p.liveUrl)),
    workspaceRef: str(p.workspaceRef),
    maintainers,
    roles,
    ...sampleLog(b),
    sample: ["pieces", "log", "pinned", ...(maintainers ? [] : ["people"])],
  };
}

/* ── Pulse and roles ───────────────────────────────────────────────── */

export function ago(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

/** The newest public commits across builds: real times from lastCommitAt. */
export function pulse(builds: Build[], n = 5): { slug: string; when: string; at: string; category: string | null }[] {
  return builds
    .filter((b) => b.lastCommitAt)
    .sort((a, b) => Date.parse(b.lastCommitAt!) - Date.parse(a.lastCommitAt!))
    .slice(0, n)
    .map((b) => ({ slug: b.slug, when: ago(b.lastCommitAt!), at: b.lastCommitAt!, category: b.category }));
}

export type OpenRole = Role & { slug: string; tagline: string; repoUrl: string | null };

/** Open roles across builds, most active builds first. Each needs one detail read. */
export async function loadRoles(builds: Build[], limit?: number): Promise<OpenRole[]> {
  const withRoles = sortBuilds(builds.filter((b) => b.roleCount > 0), "active").slice(0, limit ?? builds.length);
  const details = await Promise.all(withRoles.map((b) => loadBuild(b.slug).catch(() => null)));
  return details.flatMap((d) =>
    d && d !== "unreachable" ? d.roles.map((r) => ({ ...r, slug: d.slug, tagline: d.tagline, repoUrl: d.repoUrl })) : [],
  );
}

/* ── People ────────────────────────────────────────────────────────── */

export type Person = {
  handle: string;
  displayName: string;
  bio: string | null;
  openToProject: boolean;
  /** Slugs of the builds this person maintains. */
  maintains: string[];
  contributesTo: number;
  /** Whether a build they maintain has launched; null where the read doesn't say. */
  launched: boolean | null;
};

export type PersonDetail = Person & {
  githubUrl: string | null;
  siteUrl: string | null;
  followers: number;
  publishedAt: string | null;
  maintainsBuilds: { slug: string; tagline: string }[];
  contributesToBuilds: { slug: string; tagline: string }[];
};

const HANDLE = /^[a-z0-9][a-z0-9_-]{0,62}$/i;
const httpUrl = (v: unknown): string | null => {
  const s = str(v);
  return s && /^https?:\/\//.test(s) ? s : null;
};
const listings = (v: unknown) =>
  (Array.isArray(v) ? v : [])
    .map(obj)
    .map((l) => ({ slug: str(l.slug) ?? "", tagline: str(l.tagline) ?? "" }))
    .filter((l) => l.slug);

export function toPerson(c: Json): Person | null {
  const handle = str(c.handle);
  if (!handle) return null;
  const maintains = Array.isArray(c.maintains)
    ? c.maintains.map((m) => (typeof m === "string" ? m : str(obj(m).slug))).filter((m): m is string => !!m)
    : [];
  return {
    handle,
    displayName: str(c.displayName) ?? handle,
    bio: str(c.bio),
    openToProject: c.openToProject === true,
    maintains,
    contributesTo: num(c.contributesTo),
    launched: typeof c.launched === "boolean" ? c.launched : null,
  };
}

export async function loadPeople(): Promise<Person[] | "unreachable"> {
  try {
    const raw = obj(obj(await getJson("/v1/public/openproduct/contributors")).data).contributors;
    return (Array.isArray(raw) ? raw : [])
      .map((c) => toPerson(obj(c)))
      .filter((p): p is Person => !!p)
      .sort(
        (a, b) =>
          Number(b.openToProject) - Number(a.openToProject) ||
          b.maintains.length + b.contributesTo - (a.maintains.length + a.contributesTo) ||
          a.handle.localeCompare(b.handle),
      );
  } catch {
    return "unreachable";
  }
}

export async function loadPerson(handle: string): Promise<PersonDetail | null | "unreachable"> {
  if (!HANDLE.test(handle)) return null;
  let res: Response;
  try {
    res = await fetch(`${API_ORIGIN}/v1/public/openproduct/people/${encodeURIComponent(handle)}`, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    return "unreachable";
  }
  if (res.status === 404) return null;
  if (!res.ok) return "unreachable";
  const c = obj(obj(obj(await res.json()).data).contributor);
  const person = toPerson(c);
  if (!person) return null;
  // The profile read doesn't carry `launched`; the directory list does.
  if (person.launched === null) {
    const all = await loadPeople().catch(() => "unreachable" as const);
    if (all !== "unreachable") person.launched = all.find((p) => p.handle === person.handle)?.launched ?? null;
  }
  return {
    ...person,
    githubUrl: httpUrl(c.githubUrl),
    siteUrl: httpUrl(c.siteUrl),
    followers: num(c.followers),
    publishedAt: str(c.publishedAt),
    maintainsBuilds: listings(c.maintains),
    contributesToBuilds: listings(c.contributesToListings),
  };
}

/** The slugs a builder maintains on openproduct.live, or null when the profile can't be read. */
export async function maintainsOf(handle: string): Promise<string[] | null> {
  const person = await loadPerson(handle);
  return person && person !== "unreachable" ? person.maintainsBuilds.map((b) => b.slug) : null;
}

/**
 * Repo → slug for every public build with a GitHub repo (BP7). The listing
 * doesn't carry `repoUrl`, so each build's page is read; callers cache the
 * result for a day. Null when the directory can't be read.
 */
export async function loadBuildRepos(): Promise<Record<string, string> | null> {
  const dir = await loadDirectory();
  if (!dir.ok) return null;
  const details = await Promise.all(dir.builds.map((b) => loadBuild(b.slug).catch(() => null)));
  const out: Record<string, string> = {};
  for (const d of details) {
    if (!d || d === "unreachable") continue;
    const repo = repoOf(d.repoUrl);
    if (repo && !out[repo]) out[repo] = d.slug;
  }
  return out;
}
