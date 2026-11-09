// What kind of seat a role is, read from its title. The API has no role type
// yet, and most seats are not engineering jobs, so the label is derived here.

export const ROLE_TYPES = ["engineering", "design", "advisor", "growth", "design-partner", "contributor"] as const;
export type RoleType = (typeof ROLE_TYPES)[number];

export const ROLE_LABEL: Record<RoleType, string> = {
  engineering: "Engineering",
  design: "Design",
  advisor: "Advisor",
  growth: "Growth",
  "design-partner": "Design partner",
  contributor: "Contributor",
};

// First match wins, so the narrower phrases come first: "design partners"
// is a user seat, not a design seat; "partner manager" is growth.
const RULES: [RoleType, RegExp][] = [
  ["design-partner", /design partners?|to pilot|co-design|beta testers?|teams with|leads at|founders|owners|operators|landlords|contractors with|subcontractors|writers|podcasters/i],
  ["engineering", /engineer|developer|hackers?|programmer|\bsre\b/i],
  ["design", /designer|\bux\b|\bui\b/i],
  ["advisor", /advis|attorney|lawyer|paralegal|counsel|consultant|researcher|specialist|accountant/i],
  ["growth", /growth|partnerships?|partner|marketer|marketing|devrel|community|network|channel|sales/i],
];

export function roleType(title: string): RoleType {
  return RULES.find(([, re]) => re.test(title))?.[0] ?? "contributor";
}

/** What each kind of seat owns, and a first PR that fits it. Suggestions, said as such. */
export const ROLE_GUIDE: Record<RoleType, { owns: string; firstPr: string }> = {
  engineering: {
    owns: "A part of the codebase, end to end: build it, test it, keep it running.",
    firstPr: "Run it locally, then fix something you hit or pick an open issue.",
  },
  design: {
    owns: "How the product looks and flows, from first screen to the hard edge cases.",
    firstPr: "Redesign one screen, or write up a UX review of the main flow in docs/.",
  },
  advisor: {
    owns: "Getting the domain right: the rules, the edge cases and the wording.",
    firstPr: "Review the product's rules or copy and open a PR with corrections in docs/.",
  },
  growth: {
    owns: "Getting the build in front of the people it is for.",
    firstPr: "A launch post, a list of partners to approach, or landing-page copy.",
  },
  "design-partner": {
    owns: "Telling the team what to build next, from using it on real work.",
    firstPr: "Try it on a real case, then open a PR or issue with what broke and what you needed.",
  },
  contributor: {
    owns: "Whatever the maintainers scope with you in the first PR.",
    firstPr: "Open a small PR that improves the README or docs, and say what you'd like to own.",
  },
};

const STACK_NAMES: Record<string, string> = {
  typescript: "TypeScript", javascript: "JavaScript", nextjs: "Next.js", react: "React", tailwind: "Tailwind",
  sqlite: "SQLite", postgres: "Postgres", workers: "Workers", cloudflare: "Cloudflare", go: "Go", python: "Python",
  rust: "Rust", d1: "D1", supabase: "Supabase", stripe: "Stripe", vue: "Vue", svelte: "Svelte", node: "Node.js",
};

/** "nextjs" → "Next.js"; unknown names keep their own spelling. */
export const stackName = (s: string) => STACK_NAMES[s.toLowerCase()] ?? s;
