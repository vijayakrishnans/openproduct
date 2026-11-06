import { OPENPRODUCT, SOURCE } from "@/lib/links";

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
          <li><a href={`${OPENPRODUCT}/digest`}>Weekly digest</a></li>
          <li><a href={`${OPENPRODUCT}/stacks`}>Stacks</a></li>
          <li><a href="https://api.openproduct.live/v1/openapi.json">The API</a></li>
          <li><a href={`${OPENPRODUCT}/transparency`}>What we removed, and how often we were wrong</a></li>
        </ul>
        <ul>
          <li><a href={`${OPENPRODUCT}/collections`}>Collections</a></li>
          <li><a href={`${OPENPRODUCT}/rss`}>RSS</a></li>
          <li><a href={`${OPENPRODUCT}/automation`}>What runs automatically</a></li>
          <li><a href="/#ranking">Ranking formulas</a></li>
        </ul>
      </div>
    </footer>
  );
}
