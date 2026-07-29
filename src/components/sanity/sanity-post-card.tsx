import Link from "next/link";
import type { SanityPostPreview } from "@/lib/sanity/types";
import { SanityImage } from "./sanity-image";
import { ArrowIcon } from "@/components/ui/arrow-icon";
import type { Locale } from "@/i18n/config";
import { localizedPath } from "@/i18n/config";

const dateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function SanityPostCard({
  post,
  locale = "en",
}: {
  post: SanityPostPreview;
  locale?: Locale;
}) {
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
          {post.location ?? "From the desk"}
        </span>
      </Link>
      <div className="post-card-copy">
        <p className="post-meta">
          <span>{post.category ?? "Journal"}</span>
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
          {locale === "id" ? "Baca cerita" : "Read story"} <ArrowIcon />
        </Link>
      </div>
    </article>
  );
}
