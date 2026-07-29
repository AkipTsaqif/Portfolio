import type { PortableTextBlock } from "@portabletext/types";

export type SanityImage = {
  _type: "image";
  asset: { _ref: string; _type: "reference" };
  alt?: string;
  caption?: string;
  credit?: string;
  hotspot?: { x: number; y: number; height: number; width: number };
  crop?: { top: number; right: number; bottom: number; left: number };
};

export type SanityPostPreview = {
  _id: string;
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  coverImage?: SanityImage;
  category?: string;
  location?: string;
};

export type GalleryBlock = {
  _type: "gallery";
  _key: string;
  images: SanityImage[];
  caption?: string;
};
export type YoutubeBlock = {
  _type: "youtube";
  _key: string;
  url: string;
  title: string;
  caption?: string;
};
export type CalloutBlock = {
  _type: "callout";
  _key: string;
  tone?: "note" | "tip" | "warning";
  text: string;
};
export type SanityPostBody = Array<
  PortableTextBlock | SanityImage | GalleryBlock | YoutubeBlock | CalloutBlock
>;

export type SanityPost = SanityPostPreview & {
  updatedAt?: string;
  body: SanityPostBody;
  readingTime?: string;
  author?: { name: string; shortBio?: string; photo?: SanityImage };
  seo?: {
    metaTitle?: string;
    metaDescription?: string;
    socialImage?: SanityImage;
    canonicalUrl?: string;
  };
};
