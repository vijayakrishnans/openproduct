import { describe, expect, it } from "vitest";
import { embedUrl, parseVideoUrl, storedVideo, watchUrl } from "./video";

const ok = (raw: string) => {
  const r = parseVideoUrl(raw);
  if (!r.ok) throw new Error(`refused ${raw}: ${r.message}`);
  return r.video;
};

describe("parseVideoUrl", () => {
  it("accepts YouTube watch, short, shorts, embed and live links", () => {
    expect(ok("https://www.youtube.com/watch?v=Sklc_fQBmcs")).toEqual({ provider: "youtube", id: "Sklc_fQBmcs" });
    expect(ok("https://youtube.com/watch?v=Sklc_fQBmcs&t=42s")).toEqual({ provider: "youtube", id: "Sklc_fQBmcs" });
    expect(ok("https://m.youtube.com/watch?v=Sklc_fQBmcs")).toEqual({ provider: "youtube", id: "Sklc_fQBmcs" });
    expect(ok("https://youtu.be/Sklc_fQBmcs?si=abc")).toEqual({ provider: "youtube", id: "Sklc_fQBmcs" });
    expect(ok("https://www.youtube.com/shorts/Sklc_fQBmcs")).toEqual({ provider: "youtube", id: "Sklc_fQBmcs" });
    expect(ok("https://www.youtube-nocookie.com/embed/Sklc_fQBmcs")).toEqual({ provider: "youtube", id: "Sklc_fQBmcs" });
    expect(ok("https://www.youtube.com/live/Sklc_fQBmcs")).toEqual({ provider: "youtube", id: "Sklc_fQBmcs" });
  });

  it("accepts Vimeo and Loom links", () => {
    expect(ok("https://vimeo.com/76979871")).toEqual({ provider: "vimeo", id: "76979871" });
    expect(ok("https://player.vimeo.com/video/76979871")).toEqual({ provider: "vimeo", id: "76979871" });
    const loom = "0123456789abcdef0123456789abcdef";
    expect(ok(`https://www.loom.com/share/${loom}`)).toEqual({ provider: "loom", id: loom });
    expect(ok(`https://loom.com/embed/${loom}`)).toEqual({ provider: "loom", id: loom });
  });

  it("refuses every other site, scheme and shape", () => {
    for (const bad of [
      "https://evil.example/watch?v=Sklc_fQBmcs",
      "https://youtube.com.evil.example/watch?v=Sklc_fQBmcs",
      "https://notyoutube.com/watch?v=Sklc_fQBmcs",
      "javascript:alert(1)",
      "data:text/html,<iframe>",
      "https://www.youtube.com/watch?v=short",
      "https://www.youtube.com/watch?v=Sklc_fQBmcs\"><script>",
      "https://www.youtube.com/channel/UC123",
      "https://www.youtube.com/playlist?list=PL123",
      "https://youtu.be/Sklc_fQBmcs/extra",
      "https://vimeo.com/channels/staffpicks",
      "https://vimeo.com/76979871/extra",
      "https://www.loom.com/share/not-a-loom-id",
      "https://user:pw@www.youtube.com/watch?v=Sklc_fQBmcs",
      "https://www.youtube.com:8443/watch?v=Sklc_fQBmcs",
      "<iframe src=\"https://www.youtube.com/embed/Sklc_fQBmcs\"></iframe>",
      "",
    ]) {
      expect(parseVideoUrl(bad).ok, bad).toBe(false);
    }
  });
});

describe("players are built from the id alone", () => {
  it("builds privacy-friendly embed URLs and watch links", () => {
    expect(embedUrl({ provider: "youtube", id: "Sklc_fQBmcs" })).toBe("https://www.youtube-nocookie.com/embed/Sklc_fQBmcs");
    expect(embedUrl({ provider: "vimeo", id: "76979871" })).toBe("https://player.vimeo.com/video/76979871?dnt=1");
    expect(watchUrl({ provider: "youtube", id: "Sklc_fQBmcs" })).toBe("https://www.youtube.com/watch?v=Sklc_fQBmcs");
  });

  it("re-validates what it reads back", () => {
    expect(storedVideo("youtube", "Sklc_fQBmcs")).toEqual({ provider: "youtube", id: "Sklc_fQBmcs" });
    expect(storedVideo("youtube", "x/../../evil")).toBeNull();
    expect(storedVideo("dailymotion", "x7tgad0")).toBeNull();
    expect(storedVideo(null, null)).toBeNull();
  });
});
