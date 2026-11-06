import Link from "next/link";
import type { Build, Topic } from "@/lib/directory";
import { initials, pulse } from "@/lib/directory";

export function LivePulse({ builds, topics }: { builds: Build[]; topics: Topic[] }) {
  const lines = pulse(builds);
  const label = (c: string | null) => topics.find((t) => t.value === c)?.label ?? c ?? "";
  return (
    <aside className="pulse" aria-labelledby="pulse-h">
      <div className="pulse-head">
        <span id="pulse-h"><i className="live-dot" /> Live pulse</span>
        <span className="mono muted">public commits · newest first</span>
      </div>
      <ul>
        {lines.map((l) => (
          <li key={l.slug}>
            <span className="pulse-tile mono">{initials(l.slug)}</span>
            <Link href={`/builds/${l.slug}`}>
              <b>{l.slug}</b> pushed to main
              <small>{label(l.category)}</small>
            </Link>
            <span className="mono muted">{l.when}</span>
          </li>
        ))}
      </ul>
      <div className="pulse-foot">Every line here comes from a public repo. Nothing is self-reported.</div>
    </aside>
  );
}

/** The phone's one-line pulse. */
export function PulseTicker({ builds }: { builds: Build[] }) {
  const top = pulse(builds, 1)[0];
  if (!top) return null;
  return (
    <Link href={`/builds/${top.slug}`} className="ticker">
      <i className="live-dot" /> <b>{top.slug}</b> pushed to main <span className="mono muted">{top.when}</span>
    </Link>
  );
}
