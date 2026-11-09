import Link from "next/link";
import { BadgeList } from "@/components/badge-list";
import { cardBadges } from "@/lib/badges";
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
      <BadgeList
        compact
        badges={cardBadges({
          publishedAt: null,
          openToProject: person.openToProject,
          launched: person.launched,
          maintains: person.maintains.length,
          contributes: person.contributesTo,
        })}
      />
    </Link>
  );
}
