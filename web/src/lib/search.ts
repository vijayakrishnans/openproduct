import type { Build, Person, Topic } from "./directory";

export type SearchResults = { builds: Build[]; people: Person[]; topics: Topic[] };

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");

/** Every word of the query must appear somewhere in the item's text. */
function matcher(q: string) {
  const terms = norm(q).split(/\s+/).filter(Boolean);
  return (...fields: (string | null | undefined)[]) => {
    const hay = norm(fields.filter(Boolean).join(" "));
    return terms.length > 0 && terms.every((t) => hay.includes(t));
  };
}

/** Name matches rank above matches elsewhere in the text. */
function byName<T>(items: T[], name: (x: T) => string, q: string): T[] {
  const n = norm(q.trim());
  const rank = (x: T) => (norm(name(x)) === n ? 0 : norm(name(x)).startsWith(n) ? 1 : norm(name(x)).includes(n) ? 2 : 3);
  return [...items].sort((a, b) => rank(a) - rank(b));
}

export function search(q: string, builds: Build[], people: Person[], topics: Topic[]): SearchResults {
  const hit = matcher(q);
  const topicLabel = (v: string | null) => topics.find((t) => t.value === v)?.label;
  return {
    builds: byName(
      builds.filter((b) => hit(b.slug, b.tagline, b.category, topicLabel(b.category), b.licence, b.stack.join(" "))),
      (b) => b.slug,
      q,
    ),
    people: byName(
      people.filter((p) => hit(p.handle, p.displayName, p.bio, p.maintains.join(" "))),
      (p) => p.displayName,
      q,
    ),
    topics: byName(topics.filter((t) => hit(t.label, t.value)), (t) => t.label, q),
  };
}
