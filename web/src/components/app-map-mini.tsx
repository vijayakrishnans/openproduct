import type { Build } from "@/lib/directory";
import { initials, tint } from "@/lib/directory";

/** The card's living app map: the build in the middle, its pieces around it. */
export function AppMapMini({ build }: { build: Build }) {
  const at = (k: string) => build.pieces.find((p) => p.key === k)!;
  const node = (k: string, cls: string) => {
    const p = at(k);
    if (!p.provider) return null;
    return (
      <span className={`map-node ${cls}`}>
        <span className={`map-dot${p.movedLast ? " moved" : ""}`} aria-hidden />
        {p.key}
      </span>
    );
  };
  return (
    <div className="map-mini" style={{ background: tint(build) }} aria-label={`${build.slug} app map (sample)`}>
      {(["sign-in", "data", "payments", "deploy"] as const).map((k) =>
        at(k).provider ? <span key={k} className={`map-line to-${k}`} aria-hidden /> : null,
      )}
      <span className="map-tile mono">{initials(build.slug)}</span>
      {node("sign-in", "top")}
      {node("data", "left")}
      {node("payments", "right")}
      {node("deploy", "bottom")}
    </div>
  );
}
