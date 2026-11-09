import Link from "next/link";
import type { OpenRole } from "@/lib/directory";
import { initials } from "@/lib/directory";
import { ROLE_LABEL } from "@/lib/roles";

export function RoleCard({ role }: { role: OpenRole }) {
  return (
    <div className="role-card">
      <div className="role-by">
        <span className="pulse-tile mono">{initials(role.slug)}</span>
        <Link href={`/builds/${role.slug}`}>{role.slug}</Link>
      </div>
      <span className={`role-type t-${role.type}`}>{ROLE_LABEL[role.type]}</span>
      <strong>{role.title}</strong>
      {role.skills.length ? (
        <div className="skills"><span className="muted">First PR in</span>{role.skills.map((s) => <span key={s} className="skill mono">{s}</span>)}</div>
      ) : null}
    </div>
  );
}

export function RolesRow({ roles }: { roles: OpenRole[] }) {
  if (!roles.length) return null;
  return (
    <section className="section" aria-labelledby="people-h">
      <div className="section-head">
        <h2 id="people-h">Looking for people</h2>
        <span className="sub">Builds with open seats. Join with a PR, not a CV.</span>
        <Link className="link end" href="/roles">All open roles</Link>
      </div>
      <div className="role-row">
        {roles.map((r) => <RoleCard key={`${r.slug}-${r.id}`} role={r} />)}
      </div>
    </section>
  );
}
