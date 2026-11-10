// Topics as tags (topics-and-community TC1, design D1). A topic is
// lowercase words joined by hyphens, 2–32 characters. "#Cloudflare
// Workers", "cloudflare_workers" and "cloudflare-workers" are one topic,
// and a short alias list folds obvious twins. Writing carries one to five.

export const MAX_TOPICS = 5;

/** Obvious twins, folded into one topic. */
const ALIASES: Record<string, string> = {
  "next-js": "nextjs",
  "next": "nextjs",
  "cf-workers": "cloudflare-workers",
  "workers": "cloudflare-workers",
  "cloudflare-worker": "cloudflare-workers",
  "js": "javascript",
  "ts": "typescript",
  "postgresql": "postgres",
  "ai-ml": "ai",
  "a11y": "accessibility",
  "ux": "design",
  "ui": "design",
  "devtools": "dev-tools",
  "dev-tool": "dev-tools",
};

/** One topic from whatever was typed, or null. */
export function normalizeTopic(raw: string): string | null {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/^#+/, "")
    .replace(/[\s_.\/]+/g, "-")
    .replace(/[^a-z0-9+-]/g, "")
    .replace(/\+/g, "plus")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
  if (s.length < 2 || s.length > 32) return null;
  return ALIASES[s] ?? s;
}

/** Up to five distinct topics from a comma-separated (or #hash-separated) field. */
export function parseTopics(raw: string | string[]): string[] {
  const parts = Array.isArray(raw) ? raw : raw.split(/[,\n]|(?=#)/);
  const out: string[] = [];
  for (const p of parts) {
    const t = normalizeTopic(p);
    if (t && !out.includes(t)) out.push(t);
    if (out.length === MAX_TOPICS) break;
  }
  return out;
}

/** Proper names for topics whose slug doesn't spell them. */
const LABELS: Record<string, string> = {
  ai: "AI", nextjs: "Next.js", typescript: "TypeScript", javascript: "JavaScript", "cloudflare-workers": "Cloudflare Workers",
  postgres: "Postgres", sqlite: "SQLite", d1: "D1", api: "API", ux: "UX", css: "CSS", html: "HTML", go: "Go",
  react: "React", tailwind: "Tailwind", supabase: "Supabase", stripe: "Stripe", oauth: "OAuth", llm: "LLMs", saas: "SaaS",
  "dev-tools": "Dev tools", graphql: "GraphQL", github: "GitHub", orunbase: "Orunbase",
};

/** "cloudflare-workers" → "Cloudflare Workers": a known name, or a label made from the slug. */
export function topicLabel(slug: string): string {
  if (LABELS[slug]) return LABELS[slug]!;
  const words = slug.split("-");
  return [words[0]!.charAt(0).toUpperCase() + words[0]!.slice(1), ...words.slice(1)].join(" ");
}
