import Link from "next/link";
import type { SanityPostPreview } from "@/lib/sanity/types";
import { SanityImage } from "./sanity-image";
import { ArrowIcon } from "@/components/ui/arrow-icon";
import type { Locale } from "@/i18n/config";
import { localizedPath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export async function SanityPostCard({
  post,
  locale = "en",
}: {
  post: SanityPostPreview;
  locale?: Locale;
}) {
  const dictionary = await getDictionary(locale);
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return (
    <article className="post-card">
      <Link
        className="sanity-post-visual"
        href={localizedPath(locale, `/blog/${post.slug}`)}
      >
        {post.coverImage ? (
          <SanityImage
            image={post.coverImage}
            sizes="(max-width: 760px) 100vw, 33vw"
          />
        ) : null}
        <span className="post-location">
          {post.location ?? dictionary.common.fromTheDesk}
        </span>
      </Link>
      <div className="post-card-copy">
        <p className="post-meta">
          <span>{post.category ?? dictionary.common.journalFallback}</span>
          <time dateTime={post.publishedAt}>
            {dateFormatter.format(new Date(post.publishedAt))}
          </time>
        </p>
        <h3>
          <Link href={localizedPath(locale, `/blog/${post.slug}`)}>
            {post.title}
          </Link>
        </h3>
        <p>{post.excerpt}</p>
        <Link
          className="text-link"
          href={localizedPath(locale, `/blog/${post.slug}`)}
        >
          {dictionary.common.readStory} <ArrowIcon />
        </Link>
      </div>
    </article>
  );
}
