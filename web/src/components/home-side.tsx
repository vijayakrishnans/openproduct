import Link from "next/link";
import type { Article } from "@/lib/auth/articles";
import { ago, initials, type OpenRole, type Topic } from "@/lib/directory";
import type { Thread } from "@/lib/forum";
import { ROLE_LABEL } from "@/lib/roles";
import { TrendingRow } from "./thread-row";

/** One open seat, compact: who's asking, what for, and where the first PR lands. */
function RoleLine({ role }: { role: OpenRole }) {
  return (
    <Link className="side-role" href={`/roles?seat=${encodeURIComponent(`${role.slug}/${role.id}`)}`}>
      <span className="pulse-tile mono" aria-hidden>{initials(role.slug)}</span>
      <span className="side-role-text">
        <strong>{role.title}</strong>
        <span>
          <span className={`role-type t-${role.type}`}>{ROLE_LABEL[role.type]}</span> at {role.slug}
        </span>
      </span>
    </Link>
  );
}

/**
 * The home page's right-hand column (OP-24): open seats, topics, and what
 * the community is talking about. Each box links to its full page.
 */
export function HomeSide({ roles, topics, threads, articles }: { roles: OpenRole[]; topics: Topic[]; threads: Thread[]; articles: Article[] }) {
  const busiest = [...topics].filter((t) => t.products > 0).sort((a, b) => b.products - a.products || a.label.localeCompare(b.label));
  return (
    <aside className="home-side" aria-label="Roles, topics and community">
      <section className="side-box" aria-labelledby="side-roles">
        <div className="side-head">
          <h2 id="side-roles">Open roles</h2>
          <Link className="link" href="/roles">All</Link>
        </div>
        {roles.length ? (
          <>
            <p className="side-sub">Builds with open seats. Join with a PR, not a CV.</p>
            <div className="side-roles">{roles.map((r) => <RoleLine key={`${r.slug}-${r.id}`} role={r} />)}</div>
          </>
        ) : (
          <p className="muted">No open seats right now.</p>
        )}
      </section>

      {busiest.length ? (
        <section className="side-box" aria-labelledby="side-topics">
          <div className="side-head">
            <h2 id="side-topics">Topics</h2>
            <Link className="link" href="/topics">All</Link>
          </div>
          <ul className="side-topics">
            {busiest.slice(0, 8).map((t) => (
              <li key={t.value}>
                <Link href={`/topics/${t.value}`}>
                  <span>{t.label}</span>
                  <span className="mono muted">{t.products}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="side-box" aria-labelledby="side-community">
        <div className="side-head">
          <h2 id="side-community">Community</h2>
          <Link className="link" href="/community">All</Link>
        </div>
        {threads.length ? (
          <div className="trend-list">{threads.map((t) => <TrendingRow key={t.id} thread={t} />)}</div>
        ) : (
          <p className="muted">No discussions yet. <Link className="link" href="/community/new">Start one</Link>.</p>
        )}
        {articles.length ? (
          <div className="side-posts">
            <h3>From the builders</h3>
            {articles.map((a) => (
              <Link key={a.id} className="side-post" href={`/posts/${a.id}`}>
                <strong>{a.video ? "▶ " : ""}{a.title}</strong>
                <span className="muted">{a.author} · {ago(a.createdAt)} ago</span>
              </Link>
            ))}
          </div>
        ) : null}
      </section>
    </aside>
  );
}
