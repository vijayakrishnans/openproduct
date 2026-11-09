import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TabBar } from "@/components/tab-bar";
import { builderOfAccount, MAX_BIO, MAX_DISPLAY_NAME } from "@/lib/auth/builders";
import { currentSession } from "@/lib/auth/request";
import { database } from "@/lib/server/env";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Start your builder profile", robots: { index: false } };

type Search = Promise<{ error?: string; handle?: string; name?: string }>;

export default async function NewBuilderPage({ searchParams }: { searchParams: Search }) {
  const q = await searchParams;
  const session = await currentSession();
  if (!session) redirect("/signin?next=/builders/new");
  const db = await database();
  const own = db ? await builderOfAccount(db, session.account.id) : null;
  if (own) redirect(`/builders/${own.handle}`);

  return (
    <>
      <SiteHeader current="/builders" />
      <main className="wrap section account-page">
        <Link className="link" href="/builders">← Builders</Link>
        <h1>Start your builder profile</h1>
        <p className="sub">
          Already have a profile on openproduct.live? <Link className="link" href="/builders">Find it</Link> and claim it instead, so your builds come with it.
        </p>
        {q.error ? <p className="auth-error" role="alert">{q.error.slice(0, 200)}</p> : null}
        <form method="post" action="/account/profile" className="panel account-form">
          <input type="hidden" name="mode" value="create" />
          <label>
            Handle
            <span className="handle-input">
              <span className="mono">@</span>
              <input name="handle" required minLength={2} maxLength={30} pattern="[a-z0-9]+(-[a-z0-9]+)*" defaultValue={q.handle ?? ""} autoComplete="username" />
            </span>
            <small>Your page lives at /builders/handle. Lowercase letters, numbers and hyphens.</small>
          </label>
          <label>
            Name
            <input name="displayName" required maxLength={MAX_DISPLAY_NAME} defaultValue={q.name ?? session.account.displayName ?? ""} />
          </label>
          <label>
            Bio
            <textarea name="bio" rows={4} maxLength={MAX_BIO} placeholder="What you build, and what you'd like to work on next" />
          </label>
          <button className="btn btn-dark" type="submit">Create profile</button>
        </form>
      </main>
      <SiteFooter />
      <TabBar current="/builders" />
    </>
  );
}
