import { defineQuery } from "next-sanity";

export const postsQuery = defineQuery(`
  *[_type == "post" && defined(slug.current) && publishedAt <= now() && language == $locale]
  | order(publishedAt desc) {
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
  `*[_type == "post" && defined(slug.current) && language == $locale]{"slug": slug.current}`,
);

/**
 * Destinations that can actually be plotted.
 *
 * `defined(coordinates)` is a filter, not a formality: a destination without coordinates has
 * nowhere to go on a map, and silently dropping it is worse than hiding it — so the query
 * is explicit that this is the plottable subset, and the page reports the total separately
 * if the two ever diverge.
 */
export const destinationsQuery = defineQuery(`
  *[_type == "destination" && defined(slug.current) && defined(coordinates)]
  | order(country asc, name asc) {
    _id,
    "slug": slug.current,
    name,
    country,
    description,
    coordinates
  }
`);

export const postQuery = defineQuery(`
  *[_type == "post" && slug.current == $slug && language == $locale][0] {
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
