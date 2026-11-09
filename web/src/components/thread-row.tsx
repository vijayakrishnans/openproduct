import Link from "next/link";
import { ago, initials } from "@/lib/directory";
import { TAG_LABELS, type Thread } from "@/lib/forum";

function Bubble() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12Z" />
    </svg>
  );
}

/** One thread in the forum list: where it lives, its title, and its replies. */
export function ThreadRow({ thread: t }: { thread: Thread }) {
  const moved = t.lastPostAt ?? t.createdAt;
  return (
    <Link href={`/community/t/${encodeURIComponent(t.id)}`} className="thread-row">
      <span className="pulse-tile mono" aria-hidden>{initials(t.slug ?? t.title)}</span>
      <span className="thread-main">
        {t.slug ? <span className="thread-where mono">p/{t.slug}</span> : null}
        <strong>{t.title}</strong>
        <span className="thread-meta">
          <span className="thread-tag">{TAG_LABELS[t.tag] ?? t.tag}</span>
          {t.author ? <span>by {t.author}</span> : null}
          <span>{t.lastPostAt ? `last reply ${ago(moved)} ago` : `started ${ago(moved)} ago`}</span>
          {t.state === "answered" ? <span className="thread-answered">Answered</span> : null}
          {t.state === "locked" ? <span>Locked</span> : null}
        </span>
      </span>
      <span className="thread-count mono" aria-label={`${t.replies} replies`}>
        <Bubble /> {t.replies}
      </span>
    </Link>
  );
}

/** A compact row for the Trending sidebar. */
export function TrendingRow({ thread: t }: { thread: Thread }) {
  return (
    <Link href={`/community/t/${encodeURIComponent(t.id)}`} className="trend-row">
      {t.slug ? <span className="thread-where mono">p/{t.slug}</span> : null}
      <strong>{t.title}</strong>
      <span className="thread-meta">
        <span className="thread-replies"><Bubble /> {t.replies}</span>
        <span>{TAG_LABELS[t.tag] ?? t.tag}</span>
      </span>
    </Link>
  );
}
