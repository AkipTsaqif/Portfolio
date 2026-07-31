import Link from "next/link";
import type { PostPreview } from "@/data/posts";
import { ArrowIcon } from "@/components/ui/arrow-icon";
import type { Locale } from "@/i18n/config";
import { localizedPath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export async function PostCard({
  post,
  locale = "en",
}: {
  post: PostPreview;
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
        className={`post-visual post-${post.accent}`}
        href={localizedPath(locale, `/blog/${post.slug}`)}
      >
        <span className="post-location">{post.location}</span>
        <span className="post-shape" aria-hidden="true" />
      </Link>
      <div className="post-card-copy">
        <p className="post-meta">
          <span>{post.category}</span>
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
