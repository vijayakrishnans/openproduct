import type { ProviderId } from "@/lib/auth/providers";

/** A small, plain mark per provider: a letterform, not a brand logo. */
export function ProviderMark({ provider }: { provider: ProviderId }) {
  const letter = provider === "github" ? "GH" : provider === "google" ? "G" : "O";
  return (
    <span className={`provider-mark ${provider}`} aria-hidden>
      {letter}
    </span>
  );
}
