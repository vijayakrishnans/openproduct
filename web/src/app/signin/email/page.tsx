import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { maskEmail, peekEmailLink } from "@/lib/auth/email-link";
import { database } from "@/lib/server/env";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in by email", robots: { index: false } };

/**
 * Where an email link lands. It asks for one click rather than signing in
 * straight away: mail scanners open links, and must not use them up.
 */
export default async function EmailLinkPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const db = await database();
  const link = db ? await peekEmailLink(db, token).catch(() => null) : null;
  return (
    <>
      <SiteHeader />
      <main className="wrap section auth-page">
        <div className="auth-card panel">
          {link ? (
            <>
              <h1>Sign in to openproduct</h1>
              <p className="sub">Signing in as <b>{maskEmail(link.email)}</b>.</p>
              <form method="post" action="/auth/email/confirm">
                <input type="hidden" name="token" value={token} />
                <button className="btn btn-dark auth-btn" type="submit">Sign in</button>
              </form>
              <p className="auth-fine">This link works once, within 15 minutes of being sent.</p>
            </>
          ) : (
            <>
              <h1>That link has been used or has expired</h1>
              <p className="sub">Sign-in links work once, for 15 minutes. Ask for a new one.</p>
              <Link className="btn btn-dark auth-btn" href="/signin">Back to sign in</Link>
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
