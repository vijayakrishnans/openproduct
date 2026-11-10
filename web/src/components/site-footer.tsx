import Link from "next/link";
import { COMMUNITY, ORUNBASE, SOURCE } from "@/lib/links";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div>
          <strong>openproduct</strong>
          <p>Products built in the open. Every build is a public repo and a public workspace on Orunbase.</p>
          <a className="src" href={SOURCE}>
            This site is an open build too. View its repo
          </a>
        </div>
        <ul>
          <li><Link href="/">Builds</Link></li>
          <li><Link href="/roles">Open roles</Link></li>
          <li><Link href="/topics">Topics</Link></li>
          <li><Link href="/#ranking">Ranking formula</Link></li>
        </ul>
        <ul>
          <li><Link href="/builders">Builders</Link></li>
          <li><Link href="/posts">Posts from builders</Link></li>
          <li><Link href="/builders/new">Start your builder profile</Link></li>
          <li><a href={ORUNBASE}>Build on Orunbase</a></li>
        </ul>
        <ul>
          <li><Link href="/community">Community</Link></li>
          {COMMUNITY.filter((c) => c.url).map((c) => (
            <li key={c.key}>
              <a href={c.url!} target="_blank" rel="noopener noreferrer">{c.name}</a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
