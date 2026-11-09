import type { Metadata } from "next";
import { RolesBoard } from "@/components/roles-board";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TabBar } from "@/components/tab-bar";
import { loadDirectory, loadRoles } from "@/lib/directory";
import { OPENPRODUCT } from "@/lib/links";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Open roles",
  description: "Open seats on builds made in the open. Claim one with a pull request, not a CV.",
};

const STEPS = [
  { n: "1", title: "Claim a seat", body: "Pick the seat that fits what you do." },
  { n: "2", title: "Open a PR", body: "Code, a design, or a written review all count." },
  { n: "3", title: "Get merged, get in", body: "A merged PR is how you join the team." },
];

export default async function RolesPage() {
  const dir = await loadDirectory();
  const roles = dir.ok ? await loadRoles(dir.builds) : [];
  const builds = new Set(roles.map((r) => r.slug)).size;
  return (
    <>
      <SiteHeader current="/roles" />
      <main className="wrap section">
        <section className="roles-hero">
          <div>
            <span className="chip">OPEN ROLES</span>
            <h1>Less CV. More PR.</h1>
            <p>
              {roles.length} open {roles.length === 1 ? "seat" : "seats"} across {builds} {builds === 1 ? "build" : "builds"}. Most
              aren&apos;t engineering jobs. Advisors, growth leads and design partners join the same way: with a pull request.
            </p>
          </div>
          <ol className="roles-steps">
            {STEPS.map((s) => (
              <li key={s.n}>
                <span className="step-n mono">{s.n}</span>
                <strong>{s.title}</strong>
                <span>{s.body}</span>
              </li>
            ))}
          </ol>
        </section>
        {dir.ok ? (
          <RolesBoard roles={roles} />
        ) : (
          <div className="unreachable">
            The directory could not be reached just now. Roles are listed at <a className="link" href={OPENPRODUCT}>openproduct.live</a>.
          </div>
        )}
      </main>
      <SiteFooter />
      <TabBar current="/roles" />
    </>
  );
}
