import { defineQuery } from "next-sanity";

export const postsQuery = defineQuery(`
  *[_type == "post" && defined(slug.current) && publishedAt <= now()] | order(publishedAt desc) {
    _id,
    "slug": slug.current,
    title,
    excerpt,
    publishedAt,
    coverImage,
    "category": categories[0]->title,
    "location": coalesce(destination->name + ", " + destination->country, "From the desk")
  }
`);

export const postSlugsQuery = defineQuery(
  `*[_type == "post" && defined(slug.current)]{"slug": slug.current}`,
);

export const postQuery = defineQuery(`
  *[_type == "post" && slug.current == $slug][0] {
    _id,
    "slug": slug.current,
    title,
    excerpt,
    publishedAt,
    updatedAt,
    coverImage,
    body,
    "category": categories[0]->title,
    "location": coalesce(destination->name + ", " + destination->country, "From the desk"),
    author->{name, shortBio, photo},
    seo
  }
`);
