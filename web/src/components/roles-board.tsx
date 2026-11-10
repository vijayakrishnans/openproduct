"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { OpenRole } from "@/lib/directory";
import { initials } from "@/lib/directory";
import { ROLE_GUIDE, ROLE_LABEL, ROLE_TYPES, type RoleType } from "@/lib/roles";

const key = (r: OpenRole) => `${r.slug}/${r.id}`;
const norm = (s: string) => s.toLowerCase();

function TypeBadge({ type }: { type: RoleType }) {
  return <span className={`role-type t-${type}`}>{ROLE_LABEL[type]}</span>;
}

function FirstPrIn({ skills }: { skills: string[] }) {
  if (!skills.length) return null;
  return (
    <span className="first-pr">
      First PR in {skills.map((s) => <span key={s} className="skill mono">{s}</span>)}
    </span>
  );
}

function claim(r: OpenRole) {
  return r.repoUrl
    ? { href: r.repoUrl, label: "Claim with a PR" }
    : { href: `/builds/${r.slug}#roles`, label: "Raise your hand" };
}

function Detail({ role, siblings, onPick, onClose }: { role: OpenRole; siblings: OpenRole[]; onPick: (k: string) => void; onClose: () => void }) {
  const guide = ROLE_GUIDE[role.type];
  const c = claim(role);
  return (
    <div className="seat-detail">
      <div className="seat-detail-top">
        <TypeBadge type={role.type} />
        <button type="button" className="seat-close" onClick={onClose} aria-label="Close">×</button>
      </div>
      <h2>{role.title}</h2>
      <Link className="seat-build" href={`/builds/${role.slug}`}>
        <span className="pulse-tile mono" aria-hidden>{initials(role.slug)}</span>
        <span><strong>{role.slug}</strong><span>{role.tagline}</span></span>
      </Link>
      {role.description ? <p className="seat-brief">{role.description}</p> : null}
      <dl className="seat-facts">
        <div><dt>What it owns</dt><dd>{guide.owns}</dd></div>
        <div><dt>A good first PR <span className="muted">(suggested)</span></dt><dd>{guide.firstPr}</dd></div>
        {role.commitment ? <div><dt>Time</dt><dd>{role.commitment}</dd></div> : null}
        {role.skills.length ? <div><dt>Where the code is</dt><dd><FirstPrIn skills={role.skills} /></dd></div> : null}
      </dl>
      {c.href.startsWith("/") ? (
        <Link className="btn btn-dark seat-claim" href={c.href}>{c.label} →</Link>
      ) : (
        <a className="btn btn-dark seat-claim" href={c.href} target="_blank" rel="noopener noreferrer">{c.label} →</a>
      )}
      {siblings.length ? (
        <div className="seat-more">
          <h3>More roles at {role.slug}</h3>
          {siblings.map((s) => (
            <button type="button" key={key(s)} className="seat-more-row" onClick={() => onPick(key(s))}>
              <TypeBadge type={s.type} />
              <span>{s.title}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function RolesBoard({ roles, initialSeat = null }: { roles: OpenRole[]; initialSeat?: string | null }) {
  const [type, setType] = useState<RoleType | null>(null);
  const [query, setQuery] = useState("");
  // A link straight to one seat (`/roles?seat=<slug>/<id>`, e.g. from the home page) opens it.
  const [picked, setPicked] = useState<string | null>(initialSeat && roles.some((r) => key(r) === initialSeat) ? initialSeat : null);

  const counts = useMemo(() => {
    const c = new Map<RoleType, number>();
    for (const r of roles) c.set(r.type, (c.get(r.type) ?? 0) + 1);
    return c;
  }, [roles]);

  const filtering = type !== null || query.trim() !== "";
  const terms = norm(query).split(/\s+/).filter(Boolean);
  const matches = roles.filter(
    (r) =>
      (!type || r.type === type) &&
      terms.every((t) => norm([r.title, r.slug, r.tagline, ROLE_LABEL[r.type], r.skills.join(" "), r.description ?? ""].join(" ")).includes(t)),
  );

  // Seats grouped by build, in the order the builds came in (most active first).
  const groups = useMemo(() => {
    const out: { slug: string; tagline: string; all: OpenRole[]; shown: OpenRole[] }[] = [];
    for (const r of roles) {
      let g = out.find((x) => x.slug === r.slug);
      if (!g) out.push((g = { slug: r.slug, tagline: r.tagline, all: [], shown: [] }));
      g.all.push(r);
    }
    return out;
  }, [roles]);
  const visible = groups
    .map((g) => ({ ...g, shown: g.all.filter((r) => matches.includes(r)) }))
    .filter((g) => g.shown.length);

  const selected = roles.find((r) => key(r) === picked) ?? null;
  const siblings = selected ? roles.filter((r) => r.slug === selected.slug && key(r) !== key(selected)) : [];

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPicked(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  return (
    <div className="roles-board">
      <div className="roles-tools">
        <div className="cats roles-chips" role="group" aria-label="Role type">
          <button type="button" aria-pressed={type === null} onClick={() => setType(null)}>
            All <span className="n">{roles.length}</span>
          </button>
          {ROLE_TYPES.filter((t) => counts.get(t)).map((t) => (
            <button type="button" key={t} aria-pressed={type === t} onClick={() => setType(type === t ? null : t)}>
              {ROLE_LABEL[t]} <span className="n">{counts.get(t)}</span>
            </button>
          ))}
        </div>
        <label className="search roles-search">
          <span aria-hidden>⌕</span>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search roles, builds, stacks" aria-label="Search roles" />
        </label>
      </div>

      <div className={`roles-layout${selected ? " has-detail" : ""}`}>
        <div className="seat-groups">
          {visible.length === 0 ? (
            <div className="forum-empty">
              <strong>No seats match.</strong>
              <button type="button" className="btn btn-ghost" onClick={() => { setType(null); setQuery(""); }}>Clear filters</button>
            </div>
          ) : (
            visible.map((g) => {
              const shown = filtering ? g.shown : g.shown.slice(0, 1);
              const hidden = g.all.length - shown.length;
              return (
                <section key={g.slug} className="seat-group">
                  <header className="seat-group-head">
                    <span className="pulse-tile mono" aria-hidden>{initials(g.slug)}</span>
                    <span className="seat-group-name">
                      <Link href={`/builds/${g.slug}`}><strong>{g.slug}</strong></Link>
                      <span>{g.tagline}</span>
                    </span>
                    <span className="count">{g.all.length} {g.all.length === 1 ? "seat" : "seats"}</span>
                    <Link className="link seat-view" href={`/builds/${g.slug}#roles`}>View build</Link>
                  </header>
                  {shown.map((r) => (
                    <button
                      type="button"
                      key={key(r)}
                      className={`seat-row${picked === key(r) ? " on" : ""}`}
                      aria-pressed={picked === key(r)}
                      onClick={() => setPicked(picked === key(r) ? null : key(r))}
                    >
                      <TypeBadge type={r.type} />
                      <strong>{r.title}</strong>
                      <FirstPrIn skills={r.skills} />
                      <span className="seat-chev" aria-hidden>›</span>
                    </button>
                  ))}
                  {!filtering && hidden > 0 ? (
                    <Link className="seat-more-bar" href={`/builds/${g.slug}#roles`}>
                      +{hidden} more {hidden === 1 ? "role" : "roles"} at {g.slug} →
                    </Link>
                  ) : null}
                </section>
              );
            })
          )}
        </div>
        <aside className="seat-panel" aria-live="polite">
          {selected ? (
            <>
              <div className="seat-scrim" onClick={() => setPicked(null)} aria-hidden />
              <Detail role={selected} siblings={siblings} onPick={setPicked} onClose={() => setPicked(null)} />
            </>
          ) : (
            <div className="seat-detail seat-empty">
              <strong>Pick a seat</strong>
              <p>See what it owns, a first PR that fits it, and how to claim it.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
