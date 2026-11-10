import Link from "next/link";
import type { Build, Topic } from "@/lib/directory";
import { CardCover } from "./card-cover";

function Spark({ build }: { build: Build }) {
  // Seven bars, the last one this week's changes. Earlier weeks are not in
  // the API, so only the last bar is real; the rest are flat.
  const bars = [1, 1, 1, 1, 1, 1, Math.max(1, Math.min(6, build.changes7d))];
  return (
    <span className="spark" aria-hidden>
      {bars.map((h, i) => (
        <span key={i} className={i === 6 && build.changes7d > 0 ? "hot" : ""} style={{ height: 3 + h * 2 }} />
      ))}
    </span>
  );
}

export function BuildCard({ build, topics, quiet, anchor }: { build: Build; topics: Topic[]; quiet?: boolean; anchor?: string }) {
  const label = topics.find((t) => t.value === build.category)?.label ?? build.category;
  return (
    <Link href={`/builds/${build.slug}`} className={`card${quiet ? " is-quiet" : ""}`} id={anchor}>
      <CardCover build={build} />
      <div className="card-body">
        <div className="card-title">
          <strong>{build.slug}</strong>
          {label ? <span className="card-cat">{label}</span> : null}
        </div>
        <p className="card-tag">{build.tagline}</p>
        <div className="card-badges">
          {build.licence ? <span className="badge mono">{build.licence}</span> : null}
          {quiet ? <span className="badge quiet-tag">Quiet this week</span> : null}
          {build.roleCount > 0 ? (
            <span className="badge role">
              {build.roleCount} {build.roleCount === 1 ? "role" : "roles"} open
            </span>
          ) : null}
        </div>
        <div className="card-foot">
          <Spark build={build} />
          <span className="mono">{build.changes7d} changes</span>
          <span className="vote mono">⌃ {build.upvotes}</span>
        </div>
      </div>
    </Link>
  );
}
