import type { Metadata } from "next";
import { PersonCard } from "@/components/person-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TabBar } from "@/components/tab-bar";
import { newBuilders } from "@/lib/auth/builders";
import { currentSession } from "@/lib/auth/request";
import { loadPeople, type Person } from "@/lib/directory";
import { database } from "@/lib/server/env";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Builders", description: "The builders who maintain and contribute to builds on openproduct." };

export default async function BuildersPage() {
  const [remote, db, session] = await Promise.all([loadPeople(), database(), currentSession()]);
  // Profiles started on this site join the directory after openproduct.live's.
  const local: Person[] = db
    ? (await newBuilders(db).catch(() => [])).map((b) => ({
        handle: b.handle,
        displayName: b.displayName ?? b.handle,
        bio: b.bio,
        openToProject: false,
        maintains: [],
        contributesTo: 0,
        launched: null,
      }))
    : [];
  const people = remote === "unreachable" ? remote : [...remote, ...local.filter((l) => !remote.some((r) => r.handle === l.handle))];
  const open = people === "unreachable" ? 0 : people.filter((p) => p.openToProject).length;
  return (
    <>
      <SiteHeader current="/builders" />
      <main className="wrap section">
        <div className="section-head">
          <h1 style={{ margin: 0, fontSize: 34, letterSpacing: "-0.02em" }}>Builders</h1>
          {people !== "unreachable" ? (
            <span className="sub">
              {people.length} {people.length === 1 ? "builder" : "builders"} building in the open
              {open > 0 ? `, ${open} open to a project` : ""}.
            </span>
          ) : null}
          <span className="end">
            <a className="btn btn-ghost" href={session ? "/builders/new" : "/signin?next=/builders/new"}>Start your builder profile</a>
          </span>
        </div>
        {people === "unreachable" ? (
          <div className="unreachable">The builders directory could not be reached just now. Try again in a minute.</div>
        ) : people.length === 0 ? (
          <div className="unreachable">Nobody has published a profile yet.</div>
        ) : (
          <div className="people-grid">{people.map((p) => <PersonCard key={p.handle} person={p} />)}</div>
        )}
      </main>
      <SiteFooter />
      <TabBar current="/builders" />
    </>
  );
}
