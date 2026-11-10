import Link from "next/link";
import type { Article } from "@/lib/auth/articles";
import { ago } from "@/lib/directory";
import type { Thread } from "@/lib/forum";
import { TAG_LABELS } from "@/lib/forum";
import { POST_KIND } from "@/lib/post-kinds";

export type FeedItem = { kind: "post"; at: string; post: Article } | { kind: "thread"; at: string; thread: Thread };

/** Writing and discussions in one list, newest first (TC1; kinds arrive in TC2). */
export function TopicFeed({ items }: { items: FeedItem[] }) {
  return (
    <ul className="topic-feed">
      {items.map((i) =>
        i.kind === "post" ? (
          <li key={`p-${i.post.id}`}>
            <span className="feed-kind">
              {i.post.video ? "▶ " : ""}
              {POST_KIND[i.post.kind].label}
              {i.post.kind === "tutorial" && i.post.minutes ? ` · ${i.post.minutes} min` : ""}
            </span>
            <Link className="feed-title" href={`/posts/${i.post.id}`}>{i.post.title}</Link>
            {i.post.excerpt ? <p className="feed-excerpt">{i.post.excerpt}</p> : null}
            <span className="feed-meta">
              <Link href={`/builders/${i.post.authorHandle}`}>{i.post.author}</Link> · {ago(i.post.createdAt)} ago
            </span>
          </li>
        ) : (
          <li key={`t-${i.thread.id}`}>
            <span className="feed-kind">Discussion · {TAG_LABELS[i.thread.tag] ?? i.thread.tag}</span>
            <Link className="feed-title" href={`/community/t/${i.thread.id}`}>{i.thread.title}</Link>
            <span className="feed-meta">
              {i.thread.author ? <>{i.thread.author} · </> : null}
              {i.thread.replies} {i.thread.replies === 1 ? "post" : "posts"} · {ago(i.thread.lastPostAt ?? i.thread.createdAt)} ago
            </span>
          </li>
        ),
      )}
    </ul>
  );
}
