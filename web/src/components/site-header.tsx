import Link from "next/link";
import { currentSession } from "@/lib/auth/request";
import { isDemoAccount } from "@/lib/auth/demo";
import { appEnv, demoSignIn } from "@/lib/server/env";
import { SearchBox } from "./search-box";
import { ThemeToggle } from "./theme-toggle";

const NAV = [
  { href: "/", label: "Builds" },
  { href: "/roles", label: "Open roles" },
  { href: "/topics", label: "Topics" },
  { href: "/builders", label: "Builders" },
  { href: "/community", label: "Community" },
];

/** On stage (OP-34): who you're signed in as, if a demo account, or how to become one. */
function DemoBar({ demoName }: { demoName: string | null }) {
  return (
    <div className="demo-bar" role="note">
      <div className="wrap">
        {demoName ? (
          <>
            <span>
              <b>Demo account.</b> You&apos;re signed in as {demoName} on stage. Nothing here is real.
            </span>
            <span className="demo-bar-acts">
              <Link href="/demo">Switch</Link>
              <form method="post" action="/signout">
                <button type="submit">Sign out</button>
              </form>
            </span>
          </>
        ) : (
          <>
            <span>
              <b>Stage.</b> See every signed-in screen without an account.
            </span>
            <Link href="/demo">Try a demo account →</Link>
          </>
        )}
      </div>
    </div>
  );
}

export async function SiteHeader({ current, query }: { current?: string; query?: string }) {
  const [session, env] = await Promise.all([currentSession(), appEnv()]);
  const name = session?.account.displayName ?? "Your account";
  const demo = demoSignIn(env);
  const demoName = demo && session && isDemoAccount(session.account.id) ? name : null;
  return (
    <>
    {demo && (!session || demoName) ? <DemoBar demoName={demoName} /> : null}
    <header className="site-header">
      <div className="wrap">
        <Link href="/" className="brand">
          <span className="brand-dot" aria-hidden />
          openproduct
        </Link>
        <nav className="nav" aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={current === n.href ? "page" : undefined}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="header-end">
          <SearchBox initial={query} />
          <Link href="/search" className="search-icon" aria-label="Search">⌕</Link>
          <ThemeToggle />
          {session ? (
            <Link className="account-chip" href="/account" title={name}>
              {session.account.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={session.account.avatarUrl} alt="" width={26} height={26} referrerPolicy="no-referrer" />
              ) : (
                <span className="account-initial" aria-hidden>{name.slice(0, 1).toUpperCase()}</span>
              )}
              <span className="account-name">{name}</span>
            </Link>
          ) : (
            <Link className="btn-plain" href="/signin" style={{ textDecoration: "none", fontWeight: 500 }}>
              Sign in
            </Link>
          )}
          <a className="btn btn-dark" href="/list">
            + List your build
          </a>
        </div>
      </div>
    </header>
    </>
  );
}
