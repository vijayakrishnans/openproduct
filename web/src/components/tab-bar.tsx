import Link from "next/link";
import { OPENPRODUCT } from "@/lib/links";

const TABS = [
  { href: "/", label: "Builds", icon: "▦" },
  { href: "/roles", label: "Roles", icon: "⚇" },
  { href: OPENPRODUCT, label: "List yours", icon: "+", accent: true },
  { href: "/#topics", label: "Topics", icon: "≡" },
];

/** The phone's bottom bar; hidden on wider screens. */
export function TabBar({ current }: { current: string }) {
  return (
    <nav className="tabbar" aria-label="Sections">
      {TABS.map((t) => (
        <Link key={t.label} href={t.href} className={`${t.accent ? "accent" : ""}${current === t.href ? " on" : ""}`}>
          <span aria-hidden>{t.icon}</span>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
