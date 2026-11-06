import Link from "next/link";
import { OPENPRODUCT } from "@/lib/links";

const NAV = [
  { href: "/", label: "Builds" },
  { href: "/roles", label: "Open roles" },
  { href: "/#topics", label: "Topics" },
  { href: `${OPENPRODUCT}/people`, label: "People" },
];

export function SiteHeader({ current }: { current?: string }) {
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
          <div className="search" role="search">
            <span aria-hidden>⌕</span> Search builds, stacks, people <span className="kbd mono">⌘K</span>
          </div>
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
