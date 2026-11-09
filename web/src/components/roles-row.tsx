import Link from "next/link";
import type { OpenRole } from "@/lib/directory";
import { initials } from "@/lib/directory";

export function RoleCard({ role }: { role: OpenRole }) {
  return (
    <div className="role-card">
      <div className="role-by">
        <span className="pulse-tile mono">{initials(role.slug)}</span>
        <Link href={`/builds/${role.slug}`}>{role.slug}</Link>
      </div>
      <strong>{role.title}</strong>
      <div className="skills">{role.skills.map((s) => <span key={s} className="skill mono">{s}</span>)}</div>
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
      <p className="sample-note"><b>Live:</b> role titles. <b>Sample:</b> skills.</p>
    </section>
  );
}
