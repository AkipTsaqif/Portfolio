import Link from "next/link";
import { getSanityPost, getSanityPosts } from "@/lib/sanity/fetch";
import { SanityPostArticle } from "./sanity-post";
import { SanityPostCard } from "./sanity-post-card";
import { PostCard } from "@/components/blog/post-card";
import {
  posts as fallbackPosts,
  getPost as getFallbackPost,
} from "@/data/posts";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export async function SanityLatestPosts({ locale }: { locale: Locale }) {
  const sanityPosts = await getSanityPosts();
  if (!sanityPosts)
    return (
      <>
        {fallbackPosts.slice(0, 3).map((post) => (
          <PostCard key={post.slug} locale={locale} post={post} />
        ))}
      </>
    );
  return (
    <>
      {sanityPosts.slice(0, 3).map((post) => (
        <SanityPostCard key={post._id} locale={locale} post={post} />
      ))}
    </>
  );
}

export async function SanityBlogIndex({ locale }: { locale: Locale }) {
  const dictionary = await getDictionary(locale);
  const sanityPosts = await getSanityPosts();
  if (!sanityPosts)
    return (
      <div className="post-grid blog-page-grid">
        {fallbackPosts.map((post) => (
          <PostCard key={post.slug} locale={locale} post={post} />
        ))}
      </div>
    );
  if (sanityPosts.length === 0)
    return (
      <p className="empty-content">
        {dictionary.blog.empty} <Link href="/studio">Sanity Studio</Link>.
      </p>
    );
  return (
    <div className="post-grid blog-page-grid">
      {sanityPosts.map((post) => (
        <SanityPostCard key={post._id} locale={locale} post={post} />
      ))}
    </div>
  );
}

export async function SanityBlogPost({
  slug,
  locale,
}: {
  slug: string;
  locale: Locale;
}) {
  const dictionary = await getDictionary(locale);
  const post = await getSanityPost(slug);
  if (post) return <SanityPostArticle post={post} />;
  const fallback = getFallbackPost(slug);
  if (!fallback) return null;
  return (
    <>
      <header className="article-header">
        <p className="eyebrow">
          {fallback.category} · {fallback.location}
        </p>
        <h1>{fallback.title}</h1>
        <p className="article-deck">{fallback.excerpt}</p>
      </header>
      <div className={`article-hero post-${fallback.accent}`}>
        <span className="post-shape" aria-hidden="true" />
      </div>
      <div className="article-body">
        <p className="lead">{dictionary.blog.placeholderLead}</p>
        <p>{dictionary.blog.placeholderBody}</p>
      </div>
    </>
  );
}
