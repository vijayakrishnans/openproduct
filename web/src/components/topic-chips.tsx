import Link from "next/link";
import { topicLabel } from "@/lib/topics";

/** A row of topics, each linking to its page (TC1). */
export function TopicChips({ topics, small }: { topics: string[]; small?: boolean }) {
  if (!topics.length) return null;
  return (
    <span className={`topic-chips${small ? " small" : ""}`}>
      {topics.map((t) => (
        <Link key={t} className="topic-chip" href={`/topics/${t}`}>
          #{topicLabel(t)}
        </Link>
      ))}
    </span>
  );
}
