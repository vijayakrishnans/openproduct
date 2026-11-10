// A builder's badges (builder-profiles BP1, design D1/D2).
//
// Every badge is a pure function of public data, and carries `from`: what it
// was computed from, in words, so a reader can check it. Nothing here is
// awarded, and no badge is a score — the contribution tiers stop at 10.

export type BadgeKind = "since" | "open" | "launched" | "maintains" | "contributor-tier" | "contributor" | "support" | "discussion" | "writer";

export type Badge = {
  kind: BadgeKind;
  label: string;
  /** What the badge was computed from, said plainly. */
  from: string;
  href?: string;
};

export type BadgeInputs = {
  /** When their public page began; null where the read doesn't carry it. */
  publishedAt: string | null;
  openToProject: boolean;
  /** Null where the read doesn't say, so no badge rather than a wrong one. */
  launched: boolean | null;
  maintains: number;
  contributes: number;
  /** The public builds they contribute to, one badge each; absent on cards. */
  contributesTo?: string[];
  /** How many support links they list on this site (BP4). */
  supportLinks?: number;
  /** How many visible discussions they started here (BP5). */
  discussions?: number;
  /** How many visible posts they published here (BP6). */
  posts?: number;
};

export const CONTRIBUTION_TIERS = [
  { min: 10, label: "10+ builds" },
  { min: 3, label: "3+ builds" },
  { min: 1, label: "First contribution" },
] as const;

// Spelled out rather than Intl: ICU versions disagree on "Sep" and "Sept",
// and the server and the tests must print the same thing.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const month = (d: Date) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
const day = (d: Date) => `${d.getUTCDate()} ${month(d)}`;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function builderBadges(i: BadgeInputs): Badge[] {
  const out: Badge[] = [];

  if (i.openToProject) {
    out.push({ kind: "open", label: "Open to a project", from: "They said so on their profile" });
  }
  if (i.launched === true) {
    out.push({ kind: "launched", label: "Launched a build", from: "A build they maintain has gone live on openproduct.live" });
  }
  if (i.maintains > 0) {
    out.push({
      kind: "maintains",
      label: `Maintains ${i.maintains}`,
      from: `${plural(i.maintains, "public build lists", "public builds list")} them as maintainer`,
    });
  }
  if (i.contributes > 0) {
    const tier = CONTRIBUTION_TIERS.find((t) => i.contributes >= t.min)!;
    out.push({
      kind: "contributor-tier",
      label: tier.label,
      from: `Listed as a contributor on ${plural(i.contributes, "public build", "public builds")}`,
    });
  }
  if (i.supportLinks && i.supportLinks > 0) {
    out.push({
      kind: "support",
      label: "Open to support",
      from: `They list ${plural(i.supportLinks, "way", "ways")} to support their work`,
    });
  }
  if (i.discussions && i.discussions > 0) {
    out.push({
      kind: "discussion",
      label: i.discussions === 1 ? "Started a discussion" : `Started ${i.discussions} discussions`,
      from: `${plural(i.discussions, "discussion", "discussions")} they started in the community`,
      href: "/community",
    });
  }
  if (i.posts && i.posts > 0) {
    out.push({
      kind: "writer",
      label: plural(i.posts, "post", "posts"),
      from: `${plural(i.posts, "post", "posts")} they published here`,
      href: "#posts",
    });
  }
  if (i.publishedAt) {
    const at = new Date(i.publishedAt);
    if (!Number.isNaN(at.getTime())) {
      out.push({ kind: "since", label: `Builder since ${month(at)}`, from: `Profile published ${day(at)}` });
    }
  }
  for (const slug of i.contributesTo ?? []) {
    out.push({
      kind: "contributor",
      label: `Contributor · ${slug}`,
      from: `${slug} lists them as a contributor`,
      href: `/builds/${slug}`,
    });
  }
  return out;
}

/** The few badges a builder card has room for, most telling first. */
export function cardBadges(i: BadgeInputs, max = 3): Badge[] {
  return builderBadges({ ...i, contributesTo: [] }).filter((b) => b.kind !== "since").slice(0, max);
}
