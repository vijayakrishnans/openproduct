import Link from "next/link";
import type { ReactNode } from "react";
import { safeHref, type RenderNode } from "@/lib/forum";

/** Draws a post's typed body tree. Never parses markup, so a post cannot inject HTML. */
export function PostBody({ nodes }: { nodes: RenderNode[] }) {
  return <div className="post-body">{nodes.map(draw)}</div>;
}

function draw(n: RenderNode, i: number): ReactNode {
  switch (n.kind) {
    case "text":
      return n.value;
    case "code":
      return <code key={i}>{n.value}</code>;
    case "codeblock":
      return <pre key={i}><code>{n.value}</code></pre>;
    case "emphasis":
      return <em key={i}>{n.children.map(draw)}</em>;
    case "strong":
      return <strong key={i}>{n.children.map(draw)}</strong>;
    case "paragraph":
      return <p key={i}>{n.children.map(draw)}</p>;
    case "quote":
      return <blockquote key={i}>{n.children.map(draw)}</blockquote>;
    case "listitem":
      return <li key={i}>{n.children.map(draw)}</li>;
    case "list":
      return n.ordered ? <ol key={i}>{n.children.map(draw)}</ol> : <ul key={i}>{n.children.map(draw)}</ul>;
    case "link": {
      const href = safeHref(n.href);
      return href ? (
        <a key={i} className="link" href={href} rel="nofollow ugc noopener noreferrer" target="_blank">
          {n.children.map(draw)}
        </a>
      ) : (
        <span key={i}>{n.children.map(draw)}</span>
      );
    }
    case "mention":
      return n.claimed ? (
        <Link key={i} className="link" href={`/people/${encodeURIComponent(n.handle)}`}>@{n.handle}</Link>
      ) : (
        `@${n.handle}`
      );
  }
}
