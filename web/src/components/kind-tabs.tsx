import Link from "next/link";
import { POST_KIND, type PostKind } from "@/lib/post-kinds";

export type KindTab = PostKind | "discussions" | null;

const ORDER: PostKind[] = ["tutorial", "blog", "doc", "baseline", "launch"];

/** All | Tutorials | Blogs | Docs | Baselines | Launches (| Discussions): TC2's tabs. */
export function KindTabs({ base, current, discussions, counts }: { base: string; current: KindTab; discussions?: boolean; counts?: Partial<Record<string, number>> }) {
  const href = (k: KindTab) => (k ? `${base}?kind=${k}` : base);
  const n = (k: string) => (counts && counts[k] !== undefined ? <span className="mono muted"> {counts[k]}</span> : null);
  return (
    <nav className="cats kind-tabs" aria-label="Kinds of writing">
      <Link href={href(null)} aria-current={!current ? "true" : undefined}>All{n("all")}</Link>
      {ORDER.map((k) => (
        <Link key={k} href={href(k)} aria-current={current === k ? "true" : undefined}>
          {POST_KIND[k].plural}
          {n(k)}
        </Link>
      ))}
      {discussions ? (
        <Link href={href("discussions")} aria-current={current === "discussions" ? "true" : undefined}>
          Discussions{n("discussions")}
        </Link>
      ) : null}
    </nav>
  );
}

export function parseKindTab(raw: string | undefined, allowDiscussions: boolean): KindTab {
  if (!raw) return null;
  if (raw === "discussions") return allowDiscussions ? "discussions" : null;
  return (ORDER as string[]).includes(raw) ? (raw as PostKind) : null;
}
