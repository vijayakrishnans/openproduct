// Support links (builder-profiles BP4, design D5).
//
// WHERE A READER CAN PAY THE PERSON — OR THE BUILD — THEY ARE LOOKING AT.
// A builder, and separately a listing, may name up to four: Patreon, GitHub
// Sponsors, Ko-fi and the like.
//
// AN ALLOWLIST, NOT A FREE-FORM LINK. A "pay me" button on a directory
// people trust is the most valuable phishing surface this estate could
// publish: the label is ours, so the destination has to be one we named.
// The provider is DERIVED from the host, never typed — a link cannot claim
// to be Patreon and go somewhere else. Adding a provider is one entry here.
//
// HTTPS, NO CREDENTIALS, NO QUERY, NO FRAGMENT. A support page is an
// address, and the query and fragment are where referral tags and
// look-alike tricks live; dropping them means two spellings of one page are
// one link.

export const SUPPORT_PROVIDERS = [
  "patreon",
  "github-sponsors",
  "ko-fi",
  "buymeacoffee",
  "opencollective",
  "liberapay",
  "polar",
  "gumroad",
] as const;
export type SupportProvider = (typeof SUPPORT_PROVIDERS)[number];

export const SUPPORT_PROVIDER_LABEL: Readonly<Record<SupportProvider, string>> = {
  patreon: "Patreon",
  "github-sponsors": "GitHub Sponsors",
  "ko-fi": "Ko-fi",
  buymeacoffee: "Buy Me a Coffee",
  opencollective: "Open Collective",
  liberapay: "Liberapay",
  polar: "Polar",
  gumroad: "Gumroad",
};

export const MAX_SUPPORT_LINKS = 4;
const MAX_SUPPORT_URL = 300;

export interface SupportLink {
  readonly provider: SupportProvider;
  readonly url: string;
}

/** The exact key set of one link on the wire, pinned like every public shape. */
export const SUPPORT_LINK_KEYS = ["provider", "url"] as const;

/** Which provider a host belongs to; `www.` is the same site. */
function providerOf(url: URL): SupportProvider | null {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const firstSegment = url.pathname.split("/").filter(Boolean)[0]?.toLowerCase();
  switch (host) {
    case "patreon.com":
      return "patreon";
    case "github.com":
      // Only the Sponsors pages. Any other github.com path is a profile or
      // a repo, which the GitHub link already covers — and is not a way to pay.
      return firstSegment === "sponsors" ? "github-sponsors" : null;
    case "ko-fi.com":
      return "ko-fi";
    case "buymeacoffee.com":
      return "buymeacoffee";
    case "opencollective.com":
      return "opencollective";
    case "liberapay.com":
      return "liberapay";
    case "polar.sh":
      return "polar";
    case "gumroad.com":
      return "gumroad";
    default:
      // Gumroad shops live on their own subdomain: `name.gumroad.com`.
      return /^[a-z0-9-]+\.gumroad\.com$/.test(host) ? "gumroad" : null;
  }
}

export type SupportLinkRefusal = "not-a-url" | "not-https" | "unknown-site" | "no-page" | "too-long" | "too-many" | "not-a-list";

export const SUPPORT_LINK_REFUSAL_COPY: Readonly<Record<SupportLinkRefusal, string>> = {
  "not-a-url": "That does not look like a web address.",
  "not-https": "Support links must start with https://.",
  "unknown-site": `Support links can point to ${SUPPORT_PROVIDERS.map((p) => SUPPORT_PROVIDER_LABEL[p]).join(", ")}.`,
  "no-page": "Link to your own page on that site, not its home page.",
  "too-long": "That address is too long.",
  "too-many": `At most ${MAX_SUPPORT_LINKS} support links.`,
  "not-a-list": "Support links must be a list of addresses.",
};

export type SupportLinkCheck =
  | { readonly ok: true; readonly link: SupportLink }
  | { readonly ok: false; readonly reason: SupportLinkRefusal; readonly message: string };

function refuse(reason: SupportLinkRefusal): { ok: false; reason: SupportLinkRefusal; message: string } {
  return { ok: false, reason, message: SUPPORT_LINK_REFUSAL_COPY[reason] };
}

/** Validate one support address, deriving its provider, or refuse with a reason. */
export function parseSupportLink(input: string): SupportLinkCheck {
  const raw = input.trim();
  if (raw.length > MAX_SUPPORT_URL) return refuse("too-long");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return refuse("not-a-url");
  }
  if (url.protocol !== "https:") return refuse("not-https");
  if (url.username || url.password || url.port) return refuse("not-a-url");
  const provider = providerOf(url);
  if (!provider) return refuse("unknown-site");

  // A page, not the site: `patreon.com` alone pays nobody. GitHub Sponsors
  // needs the account after `/sponsors/`; a Gumroad subdomain IS the page.
  const segments = url.pathname.split("/").filter(Boolean);
  const gumroadShop = provider === "gumroad" && url.hostname.toLowerCase().replace(/^www\./, "") !== "gumroad.com";
  const needed = provider === "github-sponsors" ? 2 : gumroadShop ? 0 : 1;
  if (segments.length < needed) return refuse("no-page");

  url.search = "";
  url.hash = "";
  return { ok: true, link: { provider, url: url.toString() } };
}

export type SupportLinksCheck =
  | { readonly ok: true; readonly links: SupportLink[] }
  | { readonly ok: false; readonly reason: SupportLinkRefusal; readonly message: string; readonly index?: number };

/**
 * Validate a whole list as an author submits it: an array of address
 * strings (or `{url}` objects). Blank entries are dropped, duplicates
 * collapse to the first, and the order is the author's.
 */
export function parseSupportLinks(value: unknown): SupportLinksCheck {
  if (!Array.isArray(value)) return refuse("not-a-list");
  const links: SupportLink[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < value.length; index++) {
    const item = value[index];
    const raw =
      typeof item === "string"
        ? item
        : item && typeof item === "object" && typeof (item as { url?: unknown }).url === "string"
          ? (item as { url: string }).url
          : null;
    if (raw === null) return { ...refuse("not-a-url"), index };
    if (raw.trim() === "") continue;
    const checked = parseSupportLink(raw);
    if (!checked.ok) return { ...checked, index };
    if (seen.has(checked.link.url)) continue;
    seen.add(checked.link.url);
    links.push(checked.link);
  }
  if (links.length > MAX_SUPPORT_LINKS) return refuse("too-many");
  return { ok: true, links };
}

/**
 * Read stored links back, tolerating anything: a row written before the
 * column, or a value that no longer passes today's allowlist, is dropped
 * rather than published. The read re-validates because the allowlist can
 * shrink, and a link we no longer vouch for must stop rendering.
 */
export function storedSupportLinks(value: unknown): SupportLink[] {
  if (!Array.isArray(value)) return [];
  const out: SupportLink[] = [];
  for (const item of value) {
    const url = item && typeof item === "object" ? (item as { url?: unknown }).url : null;
    if (typeof url !== "string") continue;
    const checked = parseSupportLink(url);
    if (checked.ok) out.push(checked.link);
    if (out.length === MAX_SUPPORT_LINKS) break;
  }
  return out;
}
