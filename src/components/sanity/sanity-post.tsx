import type { SanityPost } from "@/lib/sanity/types";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { SanityImage } from "./sanity-image";
import { SanityPortableText } from "./portable-text";

export async function SanityPostArticle({
  post,
  locale,
}: {
  post: SanityPost;
  locale: Locale;
}) {
  const dictionary = await getDictionary(locale);
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return (
    <>
      <header className="article-header">
        <p className="eyebrow">
          {post.category ?? dictionary.common.journalFallback} ·{" "}
          {post.location ?? dictionary.common.fromTheDesk}
        </p>
        <h1>{post.title}</h1>
        <p className="article-deck">{post.excerpt}</p>
        <p className="article-meta">
          <time dateTime={post.publishedAt}>
            {dateFormatter.format(new Date(post.publishedAt))}
          </time>
        </p>
      </header>
      {post.coverImage ? (
        <div className="sanity-article-hero">
          <SanityImage
            image={post.coverImage}
            priority
            sizes="(max-width: 760px) 100vw, 1000px"
          />
        </div>
      ) : null}
      <div className="article-body">
        <SanityPortableText value={post.body} />
      </div>
    </>
  );
}
