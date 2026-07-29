import { posts } from "@/data/posts";
import { getSanityPosts } from "@/lib/sanity/fetch";

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const sanityPosts = await getSanityPosts();
  const items = sanityPosts ?? posts;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>Sri Ahmad Tsaqif — Journal</title><link>${baseUrl}/en/blog</link>
<description>Travel stories, development notes, and observations from elsewhere.</description>
${items.map((post) => `<item><title><![CDATA[${post.title}]]></title><link>${baseUrl}/en/blog/${post.slug}</link><guid>${baseUrl}/en/blog/${post.slug}</guid><pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate><description><![CDATA[${post.excerpt}]]></description></item>`).join("\n")}
</channel></rss>`;
  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
