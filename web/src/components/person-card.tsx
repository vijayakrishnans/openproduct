import Link from "next/link";
import type { Person } from "@/lib/directory";
import { initials } from "@/lib/directory";

export function Avatar({ handle, size = 40 }: { handle: string; size?: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden>
      {initials(handle)}
    </span>
  );
}

export function PersonCard({ person }: { person: Person }) {
  return (
    <Link href={`/builders/${person.handle}`} className="person-card">
      <div className="person-head">
        <Avatar handle={person.handle} />
        <div>
          <strong>{person.displayName}</strong>
          <span className="mono handle">@{person.handle}</span>
        </div>
      </div>
      {person.bio ? <p>{person.bio}</p> : null}
      <div className="card-badges">
        {person.openToProject ? <span className="badge role">Open to a project</span> : null}
        {person.maintains.length > 0 ? (
          <span className="badge">
            Maintains {person.maintains.length} {person.maintains.length === 1 ? "build" : "builds"}
          </span>
        ) : null}
        {person.contributesTo > 0 ? <span className="badge">Contributes to {person.contributesTo}</span> : null}
      </div>
    </Link>
  );
}
