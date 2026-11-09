import { MAX_SUPPORT_LINKS, SUPPORT_PROVIDER_LABEL, SUPPORT_PROVIDERS, type SupportLink } from "@/lib/support-links";

/** Four slots, posted whole: an emptied slot removes that link. */
export function SupportForm({ kind, ownerKey, links, label }: { kind: "builder" | "build"; ownerKey: string; links: SupportLink[]; label: string }) {
  const hint = `support-hint-${kind}-${ownerKey}`;
  return (
    <form method="post" action="/account/support" className="account-form">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="key" value={ownerKey} />
      <p id={hint} className="support-hint">
        Up to {MAX_SUPPORT_LINKS}, from {SUPPORT_PROVIDERS.map((p) => SUPPORT_PROVIDER_LABEL[p]).join(", ")}. Link to your own page on the site.
      </p>
      <div className="support-slots">
        {Array.from({ length: MAX_SUPPORT_LINKS }, (_, i) => (
          <input
            key={i}
            name="link"
            type="url"
            inputMode="url"
            maxLength={300}
            aria-label={`${label}: support link ${i + 1}`}
            aria-describedby={hint}
            defaultValue={links[i]?.url ?? ""}
            placeholder={i === 0 ? "https://www.patreon.com/you" : "https://"}
          />
        ))}
      </div>
      <button className="btn btn-dark" type="submit">Save support links</button>
    </form>
  );
}
