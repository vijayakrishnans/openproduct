// Videos in builder posts (builder-profiles BP6, design D7). A link is
// accepted only from YouTube, Vimeo or Loom, and is reduced to
// {provider, id}. The page builds the player URL itself from the id, so a
// stored post never carries an iframe, a player URL or any HTML.

export type VideoProvider = "youtube" | "vimeo" | "loom";
export type Video = { provider: VideoProvider; id: string };

export const VIDEO_PROVIDER_LABEL: Record<VideoProvider, string> = { youtube: "YouTube", vimeo: "Vimeo", loom: "Loom" };

const ID: Record<VideoProvider, RegExp> = {
  youtube: /^[A-Za-z0-9_-]{11}$/,
  vimeo: /^\d{1,12}$/,
  loom: /^[0-9a-f]{32}$/,
};

export type VideoParse = { ok: true; video: Video } | { ok: false; message: string };

const REFUSED = "Paste a YouTube, Vimeo or Loom link.";

/** A pasted link, to {provider, id}, or a reason it was refused. */
export function parseVideoUrl(raw: string): VideoParse {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return { ok: false, message: REFUSED };
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return { ok: false, message: REFUSED };
  if (u.username || u.password || u.port) return { ok: false, message: REFUSED };
  const host = u.hostname.toLowerCase().replace(/^(www\.|m\.)/, "");
  const parts = u.pathname.split("/").filter(Boolean);
  const pick = (provider: VideoProvider, id: string | null | undefined): VideoParse =>
    id && ID[provider].test(id) ? { ok: true, video: { provider, id } } : { ok: false, message: `That ${VIDEO_PROVIDER_LABEL[provider]} link doesn't name a video.` };

  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (parts[0] === "watch" && parts.length === 1) return pick("youtube", u.searchParams.get("v"));
    if ((parts[0] === "shorts" || parts[0] === "embed" || parts[0] === "live") && parts.length === 2) return pick("youtube", parts[1]);
    return pick("youtube", null);
  }
  if (host === "youtu.be") return pick("youtube", parts.length === 1 ? parts[0] : null);
  if (host === "vimeo.com") return pick("vimeo", parts.length === 1 ? parts[0] : null);
  if (host === "player.vimeo.com") return pick("vimeo", parts[0] === "video" && parts.length === 2 ? parts[1] : null);
  if (host === "loom.com") return pick("loom", (parts[0] === "share" || parts[0] === "embed") && parts.length === 2 ? parts[1] : null);
  return { ok: false, message: REFUSED };
}

/** A stored provider and id back to a Video, or null if either is off. */
export function storedVideo(provider: string | null, id: string | null): Video | null {
  if (!provider || !id || !(provider in ID)) return null;
  const p = provider as VideoProvider;
  return ID[p].test(id) ? { provider: p, id } : null;
}

/** The player to embed, built from the id alone. */
export function embedUrl(v: Video): string {
  switch (v.provider) {
    case "youtube":
      return `https://www.youtube-nocookie.com/embed/${v.id}`;
    case "vimeo":
      return `https://player.vimeo.com/video/${v.id}?dnt=1`;
    case "loom":
      return `https://www.loom.com/embed/${v.id}`;
  }
}

/** The link back to the video on its own site. */
export function watchUrl(v: Video): string {
  switch (v.provider) {
    case "youtube":
      return `https://www.youtube.com/watch?v=${v.id}`;
    case "vimeo":
      return `https://vimeo.com/${v.id}`;
    case "loom":
      return `https://www.loom.com/share/${v.id}`;
  }
}
