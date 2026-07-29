import type { SanityPost } from "@/lib/sanity/types";
import { SanityImage } from "./sanity-image";
import { SanityPortableText } from "./portable-text";

const dateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function SanityPostArticle({ post }: { post: SanityPost }) {
  return (
    <>
      <header className="article-header">
        <p className="eyebrow">
          {post.category ?? "Journal"} · {post.location ?? "From the desk"}
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
