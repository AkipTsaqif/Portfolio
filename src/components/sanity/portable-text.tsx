import { PortableText } from "@portabletext/react";
import { SanityImage } from "./sanity-image";
import { YouTubeEmbed } from "./youtube-embed";
import type { PortableTextComponents } from "@portabletext/react";
import type {
  SanityImage as SanityImageType,
  SanityPostBody,
} from "@/lib/sanity/types";

const components = {
  block: {
    normal: ({ children }) => <p>{children}</p>,
    h2: ({ children }) => <h2>{children}</h2>,
    h3: ({ children }) => <h3>{children}</h3>,
    blockquote: ({ children }) => <blockquote>{children}</blockquote>,
  },
  marks: {
    link: ({ children, value }) => {
      const href = typeof value?.href === "string" ? value.href : "#";
      const external = href.startsWith("http");
      return (
        <a
          href={href}
          rel={external ? "noreferrer" : undefined}
          target={external ? "_blank" : undefined}
        >
          {children}
        </a>
      );
    },
  },
  types: {
    image: ({ value }) => (
      <figure className="portable-image">
        <div className="portable-image-frame">
          <SanityImage image={value} sizes="(max-width: 760px) 100vw, 650px" />
        </div>
        {value.caption ? (
          <figcaption>
            {value.caption}
            {value.credit ? ` · ${value.credit}` : ""}
          </figcaption>
        ) : null}
      </figure>
    ),
    gallery: ({ value }) => (
      <figure className="portable-gallery">
        <div className="gallery-grid">
          {value.images?.map((image: SanityImageType) => (
            <div className="gallery-image" key={image.asset?._ref}>
              <SanityImage
                image={image}
                sizes="(max-width: 760px) 100vw, 325px"
              />
            </div>
          ))}
        </div>
        {value.caption ? <figcaption>{value.caption}</figcaption> : null}
      </figure>
    ),
    youtube: ({ value }) => (
      <YouTubeEmbed
        url={value.url}
        title={value.title}
        caption={value.caption}
      />
    ),
    callout: ({ value }) => (
      <aside className={`portable-callout tone-${value.tone ?? "note"}`}>
        {value.text}
      </aside>
    ),
  },
} satisfies Partial<PortableTextComponents>;

export function SanityPortableText({ value }: { value: SanityPostBody }) {
  return <PortableText components={components} value={value as never} />;
}
