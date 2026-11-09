// Pure request guards, kept apart from `request.ts` so tests can import them
// without Next.js request context.

/**
 * Where to go after sign-in. Only a path on this site: "/x", never "//x"
 * or "/\\x" (both of which a browser reads as another host), never a URL.
 */
export function safeNext(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  if (/[\r\n\t]/.test(raw) || raw.length > 500) return "/";
  return raw;
}

/** A write must come from a page on this site (design D9). */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  return origin === new URL(request.url).origin;
}
