// The community forum, read from the public threads API. Read-only: starting a
// thread or replying needs a signed-in account, which lives on openproduct.live.
import { API_ORIGIN } from "./directory";

export const THREAD_TAGS = ["design", "proposal", "question", "governance", "contributing", "accessibility"] as const;
export type ThreadTag = (typeof THREAD_TAGS)[number];
export const TAG_LABELS: Record<string, string> = {
  design: "Design",
  proposal: "Proposal",
  question: "Question",
  governance: "Governance",
  contributing: "Contributing",
  accessibility: "Accessibility",
  launch: "Comments",
};

export type ForumOrder = "latest" | "replied";
export const FORUM_ORDERS: { key: ForumOrder; label: string }[] = [
  { key: "latest", label: "Latest" },
  { key: "replied", label: "Most replied" },
];

export type Thread = {
  id: string;
  slug: string | null;
  tag: string;
  title: string;
  author: string | null;
  authorHandle: string | null;
  state: string;
  createdAt: string;
  lastPostAt: string | null;
  replies: number;
  /** Written on this site (BP5) rather than read from openproduct.live. */
  local?: boolean;
};

export type RenderNode =
  | { kind: "text" | "code" | "codeblock"; value: string }
  | { kind: "emphasis" | "strong" | "paragraph" | "quote" | "listitem"; children: RenderNode[] }
  | { kind: "list"; ordered: boolean; children: RenderNode[] }
  | { kind: "link"; href: string; children: RenderNode[] }
  | { kind: "mention"; handle: string; claimed: boolean };

export type Post = {
  id: string;
  parentId: string | null;
  author: string | null;
  authorHandle: string | null;
  createdAt: string;
  body: RenderNode[];
};

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === "object" ? (v as Json) : {});
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export const parseOrder = (raw: string | undefined): ForumOrder => (raw === "replied" ? "replied" : "latest");
export const parseTag = (raw: string | undefined): ThreadTag | null =>
  (THREAD_TAGS as readonly string[]).includes(raw ?? "") ? (raw as ThreadTag) : null;

export function toThread(raw: unknown): Thread | null {
  const t = obj(raw);
  const id = str(t.id);
  const title = str(t.title);
  const createdAt = str(t.createdAt);
  if (!id || !title || !createdAt || t.state === "removed") return null;
  return {
    id,
    slug: str(t.slug),
    tag: str(t.tag) ?? "question",
    title,
    author: str(t.authorName) ?? str(t.authorHandle),
    authorHandle: str(t.authorHandle),
    state: str(t.state) ?? "open",
    createdAt,
    lastPostAt: str(t.lastPostAt),
    replies: num(t.postCount),
  };
}

/** Keep only the node kinds we know how to draw; drop anything else. */
export function toNodes(raw: unknown): RenderNode[] {
  if (!Array.isArray(raw)) return [];
  const out: RenderNode[] = [];
  for (const r of raw) {
    const n = obj(r);
    const kids = () => toNodes(n.children);
    switch (n.kind) {
      case "text":
      case "code":
      case "codeblock":
        if (typeof n.value === "string") out.push({ kind: n.kind, value: n.value });
        break;
      case "emphasis":
      case "strong":
      case "paragraph":
      case "quote":
      case "listitem":
        out.push({ kind: n.kind, children: kids() });
        break;
      case "list":
        out.push({ kind: "list", ordered: n.ordered === true, children: kids() });
        break;
      case "link":
        if (typeof n.href === "string") out.push({ kind: "link", href: n.href, children: kids() });
        break;
      case "mention":
        if (typeof n.handle === "string") out.push({ kind: "mention", handle: n.handle, claimed: n.claimed === true });
        break;
    }
  }
  return out;
}

/** Only http(s) links are drawn as links; anything else renders as its text. */
export function safeHref(href: string): string | null {
  try {
    const u = new URL(href);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

async function get(path: string): Promise<Response> {
  return fetch(`${API_ORIGIN}${path}`, { headers: { accept: "application/json" }, cache: "no-store" });
}

export async function loadThreads(order: ForumOrder, tag: ThreadTag | null): Promise<Thread[] | "unreachable"> {
  const q = new URLSearchParams();
  if (order !== "latest") q.set("order", order);
  if (tag) q.set("tag", tag);
  try {
    const res = await get(`/v1/public/openproduct/threads${q.size ? `?${q}` : ""}`);
    if (!res.ok) return "unreachable";
    const raw = obj(obj(await res.json()).data).threads;
    return (Array.isArray(raw) ? raw : []).map(toThread).filter((t): t is Thread => !!t);
  } catch {
    return "unreachable";
  }
}

export async function loadThread(id: string): Promise<{ thread: Thread; posts: Post[] } | null | "unreachable"> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  let res: Response;
  try {
    res = await get(`/v1/public/openproduct/threads/${encodeURIComponent(id)}`);
  } catch {
    return "unreachable";
  }
  if (res.status === 404) return null;
  if (!res.ok) return "unreachable";
  const d = obj(obj(await res.json()).data);
  const thread = toThread({ slug: d.slug, ...obj(d.thread) });
  if (!thread) return null;
  const posts = (Array.isArray(d.posts) ? d.posts : [])
    .map(obj)
    .filter((p) => p.state !== "removed" && str(p.id) && str(p.createdAt))
    .map((p) => ({
      id: str(p.id)!,
      parentId: str(p.parentPostId),
      author: str(p.authorName) ?? str(p.authorHandle),
      authorHandle: str(p.authorHandle),
      createdAt: str(p.createdAt)!,
      body: toNodes(p.body),
    }));
  return { thread, posts };
}

/**
 * One list from two sources (BP5, D6): threads written here and threads read
 * from openproduct.live, in the same order the forum's tabs promise.
 */
export function mergeThreads(a: Thread[], b: Thread[], order: ForumOrder, limit = 50): Thread[] {
  const moved = (t: Thread) => Date.parse(t.lastPostAt ?? t.createdAt) || 0;
  const all = [...a, ...b];
  all.sort((x, y) => (order === "replied" ? y.replies - x.replies : 0) || moved(y) - moved(x));
  return all.slice(0, limit);
}
