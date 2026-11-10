import type { Metadata } from "next";
import Link from "next/link";
import { ArticleCard } from "@/components/article-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TabBar } from "@/components/tab-bar";
import { listArticles } from "@/lib/auth/articles";
import { database } from "@/lib/server/env";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "From the builders",
  description: "Build logs, demos and lessons, written by the builders on openproduct.",
};

export default async function PostsPage() {
  const db = await database();
  const articles = db ? await listArticles(db, { limit: 50 }).catch(() => []) : [];
  return (
    <>
      <SiteHeader current="/community" />
      <main className="wrap section">
        <Link className="link" href="/community">← Community</Link>
        <div className="forum-head">
          <div>
            <h1>From the builders</h1>
            <p className="sub">Build logs, demos and lessons, written by the people building here.</p>
          </div>
          <Link className="btn btn-dark" href="/posts/new">+ Write a post</Link>
        </div>
        {articles.length ? (
          <div className="article-grid">{articles.map((a) => <ArticleCard key={a.id} article={a} />)}</div>
        ) : (
          <div className="forum-empty">
            <strong>No posts yet.</strong>
            <p>Share what you&apos;re building: a write-up, a demo video, a lesson learned.</p>
            <Link className="btn btn-ghost" href="/posts/new">Write the first one</Link>
          </div>
        )}
      </main>
      <SiteFooter />
      <TabBar current="/community" />
    </>
  );
}
