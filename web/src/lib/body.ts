// A small, safe subset of Markdown for posts written here (builder-profiles
// BP5): paragraphs, lists, quotes, code, **strong**, *emphasis*, [links](…)
// and bare https links. It produces the same RenderNode tree the
// openproduct.live API sends, so one renderer draws both. Nothing is ever
// interpreted as HTML: the output is data, and React escapes every string.
import { safeHref, type RenderNode } from "./forum";

export const MAX_POST_BODY = 5000;
export const MAX_THREAD_TITLE = 140;

/** `headings` turns on `##` and `###`, for builder posts; discussions keep the API's subset. */
export function parseBody(source: string, opts: { headings?: boolean } = {}): RenderNode[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const out: RenderNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (line.trim() === "") {
      i++;
      continue;
    }
    if (line.trim().startsWith("```")) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.trim().startsWith("```")) code.push(lines[i++]!);
      i++; // the closing fence, if any
      out.push({ kind: "codeblock", value: code.join("\n") });
      continue;
    }
    const heading = opts.headings ? /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line) : null;
    if (heading) {
      out.push({ kind: "heading", level: heading[1]!.length as 2 | 3, children: inline(heading[2]!) });
      i++;
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quoted: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i]!)) quoted.push(lines[i++]!.replace(/^>\s?/, ""));
      out.push({ kind: "quote", children: [{ kind: "paragraph", children: inline(quoted.join(" ")) }] });
      continue;
    }
    const bullet = /^\s*[-*]\s+/;
    const numbered = /^\s*\d+[.)]\s+/;
    if (bullet.test(line) || numbered.test(line)) {
      const ordered = numbered.test(line);
      const marker = ordered ? numbered : bullet;
      const items: RenderNode[] = [];
      while (i < lines.length && marker.test(lines[i]!)) {
        items.push({ kind: "listitem", children: inline(lines[i++]!.replace(marker, "")) });
      }
      out.push({ kind: "list", ordered, children: items });
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i]!.trim() !== "" && !/^(```|>|\s*[-*]\s|\s*\d+[.)]\s)/.test(lines[i]!) && !(opts.headings && /^#{2,3}\s/.test(lines[i]!))) para.push(lines[i++]!.trim());
    out.push({ kind: "paragraph", children: inline(para.join(" ")) });
  }
  return out;
}

const TOKEN = /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*|\[([^\]]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g;

function inline(text: string): RenderNode[] {
  const out: RenderNode[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    if (m.index! > last) out.push({ kind: "text", value: text.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ kind: "code", value: m[1] });
    else if (m[2] !== undefined) out.push({ kind: "strong", children: inline(m[2]) });
    else if (m[3] !== undefined) out.push({ kind: "emphasis", children: inline(m[3]) });
    else if (m[4] !== undefined) {
      const href = safeHref(m[5]!);
      out.push(href ? { kind: "link", href, children: inline(m[4]) } : { kind: "text", value: m[0] });
    } else if (m[6] !== undefined) {
      const href = safeHref(m[6]);
      out.push(href ? { kind: "link", href, children: [{ kind: "text", value: m[6] }] } : { kind: "text", value: m[6] });
    }
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", value: text.slice(last) });
  return out;
}
