import Link from "next/link";

const TABS = [
  { href: "/", label: "Builds", icon: "▦" },
  { href: "/roles", label: "Roles", icon: "⚇" },
  { href: "/builders", label: "Builders", icon: "☻" },
  { href: "/topics", label: "Topics", icon: "≡" },
  { href: "/community", label: "Community", icon: "☺" },
];

/** The phone's bottom bar; hidden on wider screens. */
export function TabBar({ current }: { current: string }) {
  return (
    <nav className="tabbar" aria-label="Sections">
      {TABS.map((t) => (
        <Link key={t.label} href={t.href} className={current === t.href ? "on" : undefined}>
          <span aria-hidden>{t.icon}</span>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
