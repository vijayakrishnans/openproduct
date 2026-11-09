import type { Build } from "@/lib/directory";
import { initials } from "@/lib/directory";

/** The card's cover: the build's tile over its hero screenshot, or over a dark panel when it has none. */
export function CardCover({ build }: { build: Build }) {
  return (
    <div className={`card-cover${build.cover ? "" : " blank"}`}>
      {build.cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={build.cover.src} alt="" loading="lazy" decoding="async" />
      ) : null}
      <span className="cover-tile mono" aria-hidden>{initials(build.slug)}</span>
    </div>
  );
}
