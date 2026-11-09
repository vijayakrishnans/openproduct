"use client";

import { useEffect, useState } from "react";
import { nextTheme, THEME_COOKIE, type ThemeChoice } from "@/lib/theme";

const LABEL: Record<ThemeChoice, string> = { system: "Theme: match device", light: "Theme: light", dark: "Theme: dark" };

function apply(choice: ThemeChoice) {
  const dark = choice === "dark" || (choice === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  document.documentElement.setAttribute("data-theme-choice", choice);
}

/** Cycles device → light → dark. The head script has already applied the saved choice. */
export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>("system");

  useEffect(() => {
    const saved = document.documentElement.getAttribute("data-theme-choice");
    if (saved === "light" || saved === "dark" || saved === "system") setChoice(saved);
  }, []);

  // While following the device, follow it live.
  useEffect(() => {
    if (choice !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [choice]);

  const toggle = () => {
    const next = nextTheme(choice);
    setChoice(next);
    apply(next);
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  };

  return (
    <button type="button" className="theme-toggle" onClick={toggle} aria-label={`${LABEL[choice]}. Change theme`} title={LABEL[choice]}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {choice === "dark" ? (
          <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
        ) : choice === "light" ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        ) : (
          <>
            <circle cx="12" cy="12" r="8" />
            <path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" />
          </>
        )}
      </svg>
    </button>
  );
}
