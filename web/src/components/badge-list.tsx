import Link from "next/link";
import type { Badge, BadgeKind } from "@/lib/badges";

const ICON: Record<BadgeKind, string> = {
  open: "M12 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm-8 19a8 8 0 0 1 16 0",
  launched: "M12 2c3 3 4 7 3 11l-3 3-3-3c-1-4 0-8 3-11Zm-3 13-3 3m9-3 3 3M12 16v6",
  maintains: "M4 7l8-4 8 4-8 4-8-4Zm0 5 8 4 8-4M4 17l8 4 8-4",
  "contributor-tier": "M6 4v10a6 6 0 0 0 12 0V4M9 4v8m6-8v8",
  contributor: "M7 7h10v10H7zM7 12h10M12 7v10",
  since: "M5 5h14v15H5zM5 10h14M9 3v4m6-4v4",
};

function Glyph({ kind }: { kind: BadgeKind }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={ICON[kind]} />
    </svg>
  );
}

/** Earned badges. Each says what it was computed from: in its tooltip on a card, and in full on the builder page. */
export function BadgeList({ badges, compact = false }: { badges: Badge[]; compact?: boolean }) {
  if (badges.length === 0) return null;
  return (
    <ul className={`earned${compact ? " compact" : ""}`} aria-label="Badges">
      {badges.map((b) => {
        const inner = (
          <>
            <Glyph kind={b.kind} />
            <span className="earned-label">{b.label}</span>
            {compact ? null : <small>{b.from}</small>}
          </>
        );
        const label = `${b.label}. ${b.from}.`;
        return (
          <li key={`${b.kind}:${b.label}`} className={`earned-badge ${b.kind}`} title={b.from}>
            {b.href && !compact ? (
              <Link href={b.href} aria-label={label}>{inner}</Link>
            ) : (
              <span aria-label={label}>{inner}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
