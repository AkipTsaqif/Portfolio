import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SanityBlogPost } from "@/components/sanity/sanity-blog-content";
import { getPost as getFallbackPost, posts } from "@/data/posts";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale, localizedPath } from "@/i18n/config";
import { getSanityPost, getSanityPosts } from "@/lib/sanity/fetch";
import { urlForImage } from "@/lib/sanity/image";
import { siteConfig } from "@/data/site";

export async function generateStaticParams() {
  const sanityPosts = await getSanityPosts();
  return (sanityPosts ?? posts).flatMap((post) =>
    ["en", "id"].map((locale) => ({ locale, slug: post.slug })),
  );
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/blog/[slug]">): Promise<Metadata> {
  const { slug, locale } = await params;
  if (!isLocale(locale)) return {};
  const sanityPost = await getSanityPost(slug);
  const post = sanityPost ?? getFallbackPost(slug);
  if (!post) return {};
  const socialImage = sanityPost?.seo?.socialImage ?? sanityPost?.coverImage;
  return {
    title: sanityPost?.seo?.metaTitle ?? post.title,
    description: sanityPost?.seo?.metaDescription ?? post.excerpt,
    alternates: sanityPost?.seo?.canonicalUrl
      ? { canonical: sanityPost.seo.canonicalUrl }
      : undefined,
    openGraph: {
      type: "article",
      title: sanityPost?.seo?.metaTitle ?? post.title,
      description: sanityPost?.seo?.metaDescription ?? post.excerpt,
      publishedTime: post.publishedAt,
      modifiedTime: sanityPost?.updatedAt,
      images: socialImage
        ? [
            {
              url: urlForImage(socialImage)
                .width(1200)
                .height(630)
                .fit("crop")
                .auto("format")
                .url(),
              alt: socialImage.alt ?? "",
            },
          ]
        : undefined,
    },
  };
}

export default async function BlogPostPage({
  params,
}: PageProps<"/[locale]/blog/[slug]">) {
  const { slug, locale } = await params;
  if (!isLocale(locale)) notFound();
  const post = (await getSanityPost(slug)) ?? getFallbackPost(slug);
  if (!post) notFound();
  const dictionary = await getDictionary(locale);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt,
    author: {
      "@type": "Person",
      name:
        "author" in post && post.author?.name
          ? post.author.name
          : siteConfig.name,
    },
    mainEntityOfPage: `${baseUrl}${localizedPath(locale, `/blog/${slug}`)}`,
  };
  return (
    <article className="shell article-wrap">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <Link className="back-link" href={localizedPath(locale, "/blog")}>
        ← {dictionary.common.backToJournal}
      </Link>
      <SanityBlogPost slug={slug} locale={locale} />
    </article>
  );
}
