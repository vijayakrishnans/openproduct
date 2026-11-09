// A builder's badges (builder-profiles BP1, design D1/D2).
//
// Every badge is a pure function of public data, and carries `from`: what it
// was computed from, in words, so a reader can check it. Nothing here is
// awarded, and no badge is a score — the contribution tiers stop at 10.

export type BadgeKind = "since" | "open" | "launched" | "maintains" | "contributor-tier" | "contributor";

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
