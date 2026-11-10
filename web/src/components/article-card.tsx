import Link from "next/link";
import type { Article } from "@/lib/auth/articles";
import { ago } from "@/lib/directory";
import { VIDEO_PROVIDER_LABEL, embedUrl, watchUrl, type Video } from "@/lib/video";
import { Avatar } from "./person-card";
import { TopicChips } from "./topic-chips";

/**
 * A video player built from a provider and id (design D7). The iframe is
 * sandboxed to what the players need, loads lazily, and is the only
 * third-party code a post can bring.
 */
export function VideoEmbed({ video, title }: { video: Video; title: string }) {
  return (
    <figure className="video-embed">
      <div className="video-frame">
        <iframe
          src={embedUrl(video)}
          title={`${VIDEO_PROVIDER_LABEL[video.provider]} video: ${title}`}
          loading="lazy"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"
          allow="accelerometer; encrypted-media; fullscreen; gyroscope; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
      <figcaption>
        <a className="link" href={watchUrl(video)} target="_blank" rel="noopener noreferrer">
          Watch on {VIDEO_PROVIDER_LABEL[video.provider]}
        </a>
      </figcaption>
    </figure>
  );
}

function Meta({ a, withAuthor }: { a: Article; withAuthor: boolean }) {
  return (
    <span className="article-meta">
      {withAuthor ? (
        <Link className="article-author" href={`/builders/${encodeURIComponent(a.authorHandle)}`}>
          <Avatar handle={a.authorHandle} size={22} />
          {a.author}
        </Link>
      ) : null}
      <span>{ago(a.createdAt)} ago</span>
      {a.buildSlug ? <Link className="mono" href={`/builds/${a.buildSlug}`}>p/{a.buildSlug}</Link> : null}
      {a.video ? <span className="article-kind">▶ {VIDEO_PROVIDER_LABEL[a.video.provider]}</span> : null}
    </span>
  );
}

/** A post in a list: its video plays in place; the title opens the post. */
export function ArticleCard({ article: a, withAuthor = true }: { article: Article; withAuthor?: boolean }) {
  return (
    <article className="article-card">
      {a.video ? <VideoEmbed video={a.video} title={a.title} /> : null}
      <div className="article-card-body">
        <h3>
          <Link href={`/posts/${a.id}`}>{a.title}</Link>
        </h3>
        <Meta a={a} withAuthor={withAuthor} />
        <TopicChips topics={a.topics} small />
        {a.excerpt ? <p className="article-excerpt">{a.excerpt}</p> : null}
        <Link className="link" href={`/posts/${a.id}`}>Read the post →</Link>
      </div>
    </article>
  );
}

export { Meta as ArticleMeta };
