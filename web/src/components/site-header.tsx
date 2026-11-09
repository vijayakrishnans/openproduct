import Link from "next/link";
import { currentSession } from "@/lib/auth/request";
import { OPENPRODUCT } from "@/lib/links";
import { SearchBox } from "./search-box";
import { ThemeToggle } from "./theme-toggle";

const NAV = [
  { href: "/", label: "Builds" },
  { href: "/roles", label: "Open roles" },
  { href: "/topics", label: "Topics" },
  { href: "/builders", label: "Builders" },
  { href: "/community", label: "Community" },
];

export async function SiteHeader({ current, query }: { current?: string; query?: string }) {
  const session = await currentSession();
  const name = session?.account.displayName ?? "Your account";
  return (
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
          <a className="btn btn-dark" href={OPENPRODUCT}>
            + List your build
          </a>
        </div>
      </div>
    </header>
  );
}
