export type PostPreview = {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  readingTime: string;
  category: string;
  location: string;
  accent: "sun" | "sea" | "forest";
};

// Temporary content for the UI. Sanity will replace this data source in Phase 3.
export const posts: PostPreview[] = [
  {
    slug: "four-slow-days-in-ubud",
    title: "Four slow days in Ubud",
    excerpt:
      "Rice fields before breakfast, an unexpected downpour, and learning to leave the itinerary behind.",
    publishedAt: "2026-07-12",
    readingTime: "6 min read",
    category: "Travel",
    location: "Bali, Indonesia",
    accent: "forest",
  },
  {
    slug: "building-for-the-long-way-round",
    title: "Building for the long way round",
    excerpt:
      "A few notes on making digital products with patience, curiosity, and room to change direction.",
    publishedAt: "2026-06-03",
    readingTime: "4 min read",
    category: "Development",
    location: "From the desk",
    accent: "sea",
  },
  {
    slug: "postcards-from-yogyakarta",
    title: "Postcards from Yogyakarta",
    excerpt:
      "Sunrise temples, tiny coffee shops, and a city best explored one unhurried street at a time.",
    publishedAt: "2026-04-18",
    readingTime: "8 min read",
    category: "Travel",
    location: "Yogyakarta, Indonesia",
    accent: "sun",
  },
];

export function getPost(slug: string) {
  return posts.find((post) => post.slug === slug);
}
