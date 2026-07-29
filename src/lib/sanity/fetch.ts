import { sanityClient } from "./client";
import { postQuery, postsQuery } from "./queries";
import type { SanityPost, SanityPostPreview } from "./types";

export async function getSanityPosts(): Promise<SanityPostPreview[] | null> {
  if (!sanityClient) return null;
  return sanityClient.fetch<SanityPostPreview[]>(
    postsQuery,
    {},
    { next: { revalidate: 3600, tags: ["posts"] } },
  );
}

export async function getSanityPost(slug: string): Promise<SanityPost | null> {
  if (!sanityClient) return null;
  return sanityClient.fetch<SanityPost | null>(
    postQuery,
    { slug },
    { next: { revalidate: 3600, tags: ["posts", `post:${slug}`] } },
  );
}
