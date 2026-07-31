import { sanityClient } from "./client";
import { postQuery, postsQuery, postSlugsQuery } from "./queries";
import type { Locale } from "@/i18n/config";
import type { SanityPost, SanityPostPreview } from "./types";

export async function getSanityPosts(
  locale: Locale,
): Promise<SanityPostPreview[] | null> {
  if (!sanityClient) return null;
  return sanityClient.fetch<SanityPostPreview[]>(
    postsQuery,
    { locale },
    { next: { revalidate: 3600, tags: ["posts"] } },
  );
}

export async function getSanityPost(
  slug: string,
  locale: Locale,
): Promise<SanityPost | null> {
  if (!sanityClient) return null;
  return sanityClient.fetch<SanityPost | null>(
    postQuery,
    { slug, locale },
    { next: { revalidate: 3600, tags: ["posts", `post:${slug}`] } },
  );
}

export async function getSanitySlugs(
  locale: Locale,
): Promise<string[] | null> {
  if (!sanityClient) return null;
  const rows = await sanityClient.fetch<{ slug: string }[]>(
    postSlugsQuery,
    { locale },
    { next: { revalidate: 3600, tags: ["posts"] } },
  );
  return rows?.map((row) => row.slug) ?? null;
}
