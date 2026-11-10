import type { HelpfulKind, HelpfulState } from "@/lib/auth/rankings";

/**
 * "Helpful" on a post or a reply (TC5): one per account, counted in the
 * topic's rankings. Your own writing shows its count without a button.
 */
export function HelpfulButton({ kind, id, state, mine, next }: { kind: HelpfulKind; id: string; state?: HelpfulState; mine: boolean; next: string }) {
  const count = state?.count ?? 0;
  if (mine) return count ? <span className="helpful-count muted">▲ {count} found this helpful</span> : null;
  return (
    <form method="post" action="/act" className="act-form helpful-form">
      <input type="hidden" name="action" value="helpful" />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="key" value={id} />
      <input type="hidden" name="next" value={next} />
      <button type="submit" className={`helpful-btn${state?.mine ? " is-on" : ""}`} aria-pressed={state?.mine ? "true" : "false"}>
        ▲ Helpful{count ? <span className="mono"> {count}</span> : null}
      </button>
    </form>
  );
}
