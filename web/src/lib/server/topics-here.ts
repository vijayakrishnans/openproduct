// Topics as this site shows them (TC1): topics from writing here, plus the
// directory's categories and stacks, so a topic has both its writing and
// its builds.
import { topicActivity } from "../auth/topics";
import { topicSignals, trendingScore } from "../auth/topic-follows";
import { sortBuilds, type Build, type Topic } from "../directory";
import { normalizeTopic, topicLabel } from "../topics";
import { database } from "./env";
import { loadDirectoryHere } from "./directory-here";

export type TopicSummary = {
  slug: string;
  label: string;
  writing: number;
  /** New writing in the last 7 days. */
  thisWeek: number;
  builds: number;
  /** Searches that landed on the topic, last 7 days (TC4). */
  searches: number;
  /** New follows, last 7 days (TC4). */
  newFollows: number;
  /** Trending = searches + 3 × new writing + 5 × new follows. */
  score: number;
};

/** A build's topics: its category, and its stack. */
export function buildTopics(b: Build): string[] {
  return [...new Set([b.category, ...b.stack].map((x) => (x ? normalizeTopic(x) : null)).filter((x): x is string => !!x))];
}

export const buildsInTopic = (builds: Build[], slug: string) => sortBuilds(builds.filter((b) => buildTopics(b).includes(slug)), "active");

export async function loadTopics(): Promise<{ topics: TopicSummary[]; builds: Build[]; categories: Topic[] }> {
  const [dir, db] = await Promise.all([loadDirectoryHere(), database()]);
  const builds = dir.ok ? dir.builds : [];
  const categories = dir.ok ? dir.topics : [];
  const none = { searches: new Map<string, number>(), follows: new Map<string, number>() };
  const [activity, signals] = db ? await Promise.all([topicActivity(db).catch(() => []), topicSignals(db).catch(() => none)]) : [[], none];
  const map = new Map<string, TopicSummary>();
  const get = (slug: string, label?: string) => {
    let t = map.get(slug);
    if (!t) map.set(slug, (t = { slug, label: label ?? topicLabel(slug), writing: 0, thisWeek: 0, builds: 0, searches: 0, newFollows: 0, score: 0 }));
    return t;
  };
  for (const c of categories) {
    const slug = normalizeTopic(c.value);
    if (slug) get(slug, c.label);
  }
  for (const b of builds) for (const slug of buildTopics(b)) get(slug).builds++;
  for (const a of activity) Object.assign(get(a.slug, a.label), { writing: a.writing, thisWeek: a.thisWeek });
  for (const t of map.values()) {
    t.searches = signals.searches.get(t.slug) ?? 0;
    t.newFollows = signals.follows.get(t.slug) ?? 0;
    t.score = trendingScore(t);
  }
  // A topic is listed once it has a build, or two pieces of writing (D1).
  const topics = [...map.values()].filter((t) => t.builds > 0 || t.writing >= 2);
  return { topics, builds, categories };
}
