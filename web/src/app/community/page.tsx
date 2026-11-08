import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TabBar } from "@/components/tab-bar";
import { COMMUNITY, SOURCE, type CommunityChannel } from "@/lib/links";

export const metadata: Metadata = {
  title: "Community",
  description: "Where openproduct builders talk: Discord, Reddit, YouTube and X.",
};

/** A small mark per channel, in the channel's own colour. */
const MARK: Record<CommunityChannel["key"], { glyph: string; bg: string }> = {
  discord: { glyph: "D", bg: "#5865F2" },
  reddit: { glyph: "r/", bg: "#FF4500" },
  youtube: { glyph: "▶", bg: "#FF0000" },
  x: { glyph: "X", bg: "#000000" },
};

function ChannelCard({ channel }: { channel: CommunityChannel }) {
  const mark = MARK[channel.key];
  const body = (
    <>
      <span className="community-mark" style={{ background: mark.bg }} aria-hidden>
        {mark.glyph}
      </span>
      <strong>{channel.name}</strong>
      <p>{channel.pitch}</p>
      <span className={channel.url ? "community-cta" : "community-cta soon"}>
        {channel.url ? `${channel.cta} →` : "Link coming soon"}
      </span>
    </>
  );
  return channel.url ? (
    <a className="community-card" href={channel.url} target="_blank" rel="noopener noreferrer">
      {body}
    </a>
  ) : (
    <div className="community-card is-soon">{body}</div>
  );
}

export default function CommunityPage() {
  return (
    <>
      <SiteHeader current="/community" />
      <main className="wrap section">
        <div className="section-head">
          <h1 style={{ margin: 0, fontSize: 34, letterSpacing: "-0.02em" }}>Community</h1>
          <span className="sub">Where builders talk between pull requests.</span>
        </div>
        <div className="community-grid">
          {COMMUNITY.map((c) => (
            <ChannelCard key={c.key} channel={c} />
          ))}
        </div>
        <p className="sample-note">
          Prefer code to chat? Every build here is a public repo, and so is{" "}
          <a className="link" href={SOURCE}>
            this site
          </a>
          .
        </p>
      </main>
      <SiteFooter />
      <TabBar current="/community" />
    </>
  );
}
