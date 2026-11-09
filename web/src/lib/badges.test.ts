import { describe, expect, it } from "vitest";
import { builderBadges, cardBadges, type BadgeInputs } from "./badges";

const none: BadgeInputs = { publishedAt: null, openToProject: false, launched: false, maintains: 0, contributes: 0 };
const kinds = (i: BadgeInputs) => builderBadges(i).map((b) => b.kind);

describe("builderBadges", () => {
  it("gives a builder with nothing public no badges, and never a zero", () => {
    expect(builderBadges(none)).toEqual([]);
  });

  it("says what each badge was computed from", () => {
    const all = builderBadges({
      publishedAt: "2026-09-07T05:02:36.951Z",
      openToProject: true,
      launched: true,
      maintains: 2,
      contributes: 1,
      contributesTo: ["ackstack"],
    });
    expect(all.map((b) => b.kind)).toEqual(["open", "launched", "maintains", "contributor-tier", "since", "contributor"]);
    for (const b of all) expect(b.from.length).toBeGreaterThan(0);
  });

  it("dates the since badge from publishedAt, in UTC", () => {
    const [since] = builderBadges({ ...none, publishedAt: "2026-09-30T23:30:00Z" });
    expect(since).toMatchObject({ label: "Builder since Sep 2026", from: "Profile published 30 Sep 2026" });
  });

  it("skips an unparseable publishedAt", () => {
    expect(builderBadges({ ...none, publishedAt: "not a date" })).toEqual([]);
  });

  it("counts maintained builds with the right plural", () => {
    expect(builderBadges({ ...none, maintains: 1 })[0]!.from).toBe("1 public build lists them as maintainer");
    expect(builderBadges({ ...none, maintains: 3 })[0]).toMatchObject({ label: "Maintains 3", from: "3 public builds list them as maintainer" });
  });

  it("shows only the highest contribution tier, capped at 10+", () => {
    const tier = (n: number) => builderBadges({ ...none, contributes: n }).map((b) => b.label);
    expect(tier(1)).toEqual(["First contribution"]);
    expect(tier(2)).toEqual(["First contribution"]);
    expect(tier(3)).toEqual(["3+ builds"]);
    expect(tier(9)).toEqual(["3+ builds"]);
    expect(tier(10)).toEqual(["10+ builds"]);
    expect(tier(250)).toEqual(["10+ builds"]);
  });

  it("gives one linked badge per build contributed to", () => {
    const per = builderBadges({ ...none, contributes: 2, contributesTo: ["a", "b"] }).filter((b) => b.kind === "contributor");
    expect(per.map((b) => [b.label, b.href])).toEqual([
      ["Contributor · a", "/builds/a"],
      ["Contributor · b", "/builds/b"],
    ]);
  });

  it("gives no launched badge when the read doesn't say", () => {
    expect(kinds({ ...none, launched: null })).toEqual([]);
    expect(kinds({ ...none, launched: false })).toEqual([]);
  });
});

describe("support badge (BP4)", () => {
  it("appears with the count of links, and not at zero", () => {
    const none = { publishedAt: null, openToProject: false, launched: false, maintains: 0, contributes: 0 };
    expect(builderBadges({ ...none, supportLinks: 2 })).toEqual([
      { kind: "support", label: "Open to support", from: "They list 2 ways to support their work" },
    ]);
    expect(builderBadges({ ...none, supportLinks: 0 })).toEqual([]);
  });
});

describe("cardBadges", () => {
  it("keeps at most three, drops the date and the per-build badges", () => {
    const card = cardBadges({
      publishedAt: "2026-09-07T00:00:00Z",
      openToProject: true,
      launched: true,
      maintains: 2,
      contributes: 4,
      contributesTo: ["a", "b", "c", "d"],
    });
    expect(card.map((b) => b.kind)).toEqual(["open", "launched", "maintains"]);
  });
});
