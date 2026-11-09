import Link from "next/link";
import { OPENPRODUCT } from "@/lib/links";
import { SearchBox } from "./search-box";

const NAV = [
  { href: "/", label: "Builds" },
  { href: "/roles", label: "Open roles" },
  { href: "/topics", label: "Topics" },
  { href: "/people", label: "People" },
  { href: "/community", label: "Community" },
];

export function SiteHeader({ current, query }: { current?: string; query?: string }) {
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
          <a className="btn-plain" href={OPENPRODUCT} style={{ textDecoration: "none", fontWeight: 500 }}>
            Sign in
          </a>
          <a className="btn btn-dark" href={OPENPRODUCT}>
            + List your build
          </a>
        </div>
      </div>
    </header>
  );
}
