import type { Metadata } from "next";
import { RoleCard } from "@/components/roles-row";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TabBar } from "@/components/tab-bar";
import { loadDirectory, loadRoles } from "@/lib/directory";
import { OPENPRODUCT } from "@/lib/links";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Open roles" };

export default async function RolesPage() {
  const dir = await loadDirectory();
  const roles = dir.ok ? await loadRoles(dir.builds) : [];
  return (
    <>
      <SiteHeader current="/roles" />
      <main className="wrap section">
        <div className="section-head">
          <h1 style={{ margin: 0, fontSize: 34, letterSpacing: "-0.02em" }}>Open roles</h1>
          <span className="sub">{roles.length} seats across {new Set(roles.map((r) => r.slug)).size} builds. Join with a PR, not a CV.</span>
        </div>
        {dir.ok ? (
          <div className="role-grid">{roles.map((r) => <RoleCard key={`${r.slug}-${r.id}`} role={r} />)}</div>
        ) : (
          <div className="unreachable">
            The directory could not be reached just now. Roles are listed at <a className="link" href={OPENPRODUCT}>openproduct.live</a>.
          </div>
        )}
        <p className="sample-note"><b>Live:</b> role titles. <b>Sample:</b> skills and first tasks.</p>
      </main>
      <SiteFooter />
      <TabBar current="/roles" />
    </>
  );
}
