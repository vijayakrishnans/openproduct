import type { Metadata } from "next";
import { PersonCard } from "@/components/person-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TabBar } from "@/components/tab-bar";
import { loadPeople } from "@/lib/directory";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "People", description: "The people who maintain and contribute to builds on openproduct." };

export default async function PeoplePage() {
  const people = await loadPeople();
  const open = people === "unreachable" ? 0 : people.filter((p) => p.openToProject).length;
  return (
    <>
      <SiteHeader current="/people" />
      <main className="wrap section">
        <div className="section-head">
          <h1 style={{ margin: 0, fontSize: 34, letterSpacing: "-0.02em" }}>People</h1>
          {people !== "unreachable" ? (
            <span className="sub">
              {people.length} {people.length === 1 ? "person" : "people"} building in the open
              {open > 0 ? `, ${open} open to a project` : ""}.
            </span>
          ) : null}
        </div>
        {people === "unreachable" ? (
          <div className="unreachable">The people directory could not be reached just now. Try again in a minute.</div>
        ) : people.length === 0 ? (
          <div className="unreachable">Nobody has published a profile yet.</div>
        ) : (
          <div className="people-grid">{people.map((p) => <PersonCard key={p.handle} person={p} />)}</div>
        )}
      </main>
      <SiteFooter />
      <TabBar current="/people" />
    </>
  );
}
