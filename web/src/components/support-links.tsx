import { SUPPORT_PROVIDER_LABEL, type SupportLink } from "@/lib/support-links";

/** Where people can pay a builder or a build. The label comes from the address, never from the author. */
export function SupportLinks({ links, title }: { links: SupportLink[]; title: string }) {
  if (links.length === 0) return null;
  return (
    <div className="support-block">
      <h2>{title}</h2>
      <ul className="support-list">
        {links.map((l) => (
          <li key={l.url}>
            <a className={`support-link ${l.provider}`} href={l.url} rel="noopener noreferrer nofollow" target="_blank">
              <span className="support-heart" aria-hidden>♥</span>
              {SUPPORT_PROVIDER_LABEL[l.provider]}
              <span className="support-host">{new URL(l.url).hostname.replace(/^www\./, "")}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
