import { describe, expect, it } from "vitest";

import {
  MAX_SUPPORT_LINKS,
  SUPPORT_PROVIDERS,
  SUPPORT_PROVIDER_LABEL,
  parseSupportLink,
  parseSupportLinks,
  storedSupportLinks,
} from "./support-links";

const ok = (raw: string) => {
  const checked = parseSupportLink(raw);
  if (!checked.ok) throw new Error(`refused ${raw}: ${checked.reason}`);
  return checked.link;
};
const reason = (raw: string) => {
  const checked = parseSupportLink(raw);
  return checked.ok ? "ok" : checked.reason;
};

describe("parseSupportLink", () => {
  it("derives the provider from the host for every allowlisted site", () => {
    expect(ok("https://www.patreon.com/ada").provider).toBe("patreon");
    expect(ok("https://patreon.com/c/ada").provider).toBe("patreon");
    expect(ok("https://github.com/sponsors/ada").provider).toBe("github-sponsors");
    expect(ok("https://ko-fi.com/ada").provider).toBe("ko-fi");
    expect(ok("https://www.buymeacoffee.com/ada").provider).toBe("buymeacoffee");
    expect(ok("https://opencollective.com/queue-kit").provider).toBe("opencollective");
    expect(ok("https://liberapay.com/ada").provider).toBe("liberapay");
    expect(ok("https://polar.sh/ada").provider).toBe("polar");
    expect(ok("https://gumroad.com/ada").provider).toBe("gumroad");
    expect(ok("https://ada.gumroad.com").provider).toBe("gumroad");
  });

  it("labels every provider", () => {
    for (const p of SUPPORT_PROVIDERS) expect(SUPPORT_PROVIDER_LABEL[p].length).toBeGreaterThan(0);
  });

  it("refuses any other site, including look-alikes", () => {
    expect(reason("https://example.com/ada")).toBe("unknown-site");
    expect(reason("https://patreon.com.evil.example/ada")).toBe("unknown-site");
    expect(reason("https://evilpatreon.com/ada")).toBe("unknown-site");
    expect(reason("https://github.com/ada")).toBe("unknown-site");
    expect(reason("https://ada.gumroad.com.evil.example")).toBe("unknown-site");
  });

  it("refuses http, credentials, ports and non-addresses", () => {
    expect(reason("http://patreon.com/ada")).toBe("not-https");
    expect(reason("javascript:alert(1)")).toBe("not-https");
    expect(reason("https://user:pw@patreon.com/ada")).toBe("not-a-url");
    expect(reason("https://patreon.com:8443/ada")).toBe("not-a-url");
    expect(reason("patreon.com/ada")).toBe("not-a-url");
    expect(reason(`https://patreon.com/${"a".repeat(300)}`)).toBe("too-long");
  });

  it("wants a page, not the site's home page", () => {
    expect(reason("https://patreon.com")).toBe("no-page");
    expect(reason("https://patreon.com/")).toBe("no-page");
    expect(reason("https://github.com/sponsors")).toBe("no-page");
    expect(reason("https://gumroad.com")).toBe("no-page");
  });

  it("drops the query and fragment and normalises the host", () => {
    expect(ok("https://WWW.Patreon.com/ada?ref=x#join").url).toBe("https://www.patreon.com/ada");
  });
});

describe("parseSupportLinks", () => {
  it("keeps the author's order, drops blanks and duplicates", () => {
    const checked = parseSupportLinks(["https://ko-fi.com/ada", "", "https://patreon.com/ada", "https://ko-fi.com/ada?x=1"]);
    expect(checked).toEqual({
      ok: true,
      links: [
        { provider: "ko-fi", url: "https://ko-fi.com/ada" },
        { provider: "patreon", url: "https://patreon.com/ada" },
      ],
    });
  });

  it("accepts {url} objects", () => {
    expect(parseSupportLinks([{ url: "https://polar.sh/ada", provider: "patreon" }])).toEqual({
      ok: true,
      links: [{ provider: "polar", url: "https://polar.sh/ada" }],
    });
  });

  it("says which entry it refused", () => {
    const checked = parseSupportLinks(["https://ko-fi.com/ada", "https://example.com/ada"]);
    expect(checked).toMatchObject({ ok: false, reason: "unknown-site", index: 1 });
  });

  it("refuses more than the limit, and a non-list", () => {
    const five = ["patreon.com/a", "ko-fi.com/a", "polar.sh/a", "liberapay.com/a", "opencollective.com/a"].map((s) => `https://${s}`);
    expect(five.length).toBeGreaterThan(MAX_SUPPORT_LINKS);
    expect(parseSupportLinks(five)).toMatchObject({ ok: false, reason: "too-many" });
    expect(parseSupportLinks("https://patreon.com/a")).toMatchObject({ ok: false, reason: "not-a-list" });
  });

  it("accepts an empty list, which clears them", () => {
    expect(parseSupportLinks([])).toEqual({ ok: true, links: [] });
  });
});

describe("storedSupportLinks", () => {
  it("re-validates on read, dropping anything no longer allowlisted", () => {
    expect(
      storedSupportLinks([
        { provider: "patreon", url: "https://patreon.com/ada" },
        { provider: "patreon", url: "https://example.com/ada" },
        "junk",
        null,
      ]),
    ).toEqual([{ provider: "patreon", url: "https://patreon.com/ada" }]);
  });

  it("is empty for a row written before the column", () => {
    expect(storedSupportLinks(undefined)).toEqual([]);
    expect(storedSupportLinks(null)).toEqual([]);
  });
});
