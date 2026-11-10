import type { IdentityProvider } from "@/lib/auth/providers";

/** A small, plain mark per provider: a letterform, not a brand logo. */
const LETTER: Record<IdentityProvider, string> = { github: "GH", google: "G", apple: "A", orunbase: "O", email: "@" };

export function ProviderMark({ provider }: { provider: IdentityProvider }) {
  const letter = LETTER[provider];
  return (
    <span className={`provider-mark ${provider}`} aria-hidden>
      {letter}
    </span>
  );
}
