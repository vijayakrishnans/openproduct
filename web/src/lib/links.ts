// Where the buttons this sample does not implement go: the real directory,
// and the platform the builds run on.
export const OPENPRODUCT = "https://openproduct.live";
export const ORUNBASE = "https://app.orunbase.com";
export const SOURCE = "https://github.com/vijayakrishnans/openproduct";

// The community's own channels. A channel with no `url` yet renders as
// "coming soon" rather than a dead link: fill the URL in here and every
// place that lists the channels (the /community page, the footer) picks it up.
export interface CommunityChannel {
  key: "discord" | "reddit" | "youtube" | "x";
  name: string;
  /** What the channel is for, in one line. */
  pitch: string;
  /** The call to action on the card. */
  cta: string;
  url: string | null;
}

export const COMMUNITY: CommunityChannel[] = [
  {
    key: "discord",
    name: "Discord",
    pitch: "Chat with builders, ask for help, and show what you shipped this week.",
    cta: "Join the server",
    url: "https://discord.gg/tGMzCwsP5",
  },
  {
    key: "reddit",
    name: "Reddit",
    pitch: "Longer threads: launch posts, feedback on builds, and stack debates.",
    cta: "Visit the subreddit",
    url: null,
  },
  {
    key: "youtube",
    name: "YouTube",
    pitch: "Build walkthroughs, demos, and the weekly digest on video.",
    cta: "Watch the channel",
    url: null,
  },
  {
    key: "x",
    name: "X",
    pitch: "New launches, open roles, and what changed on openproduct.",
    cta: "Follow on X",
    url: null,
  },
];
