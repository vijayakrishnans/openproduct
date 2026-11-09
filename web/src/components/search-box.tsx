"use client";

import { useEffect, useRef } from "react";

/** The header search: a real GET form to /search, focused by ⌘K / Ctrl+K or "/". */
export function SearchBox({ initial = "" }: { initial?: string }) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        input.current?.focus();
        input.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <form className="search" role="search" action="/search" method="get">
      <span aria-hidden>⌕</span>
      <input
        ref={input}
        type="search"
        name="q"
        defaultValue={initial}
        placeholder="Search builds, builders"
        aria-label="Search builds, stacks and builders"
        autoComplete="off"
        enterKeyHint="search"
      />
      <span className="kbd mono" aria-hidden>⌘K</span>
    </form>
  );
}
