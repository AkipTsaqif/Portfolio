import { posts } from "@/data/posts";
import { defaultLocale } from "@/i18n/config";
import { getSanityPosts } from "@/lib/sanity/fetch";

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const sanityPosts = await getSanityPosts(defaultLocale);
  const items = sanityPosts ?? posts;
  const blogPath = `/${defaultLocale}/blog`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>Sri Ahmad Tsaqif — Journal</title><link>${baseUrl}${blogPath}</link>
<description>Travel stories, development notes, and observations from elsewhere.</description>
${items.map((post) => `<item><title><![CDATA[${post.title}]]></title><link>${baseUrl}${blogPath}/${post.slug}</link><guid>${baseUrl}${blogPath}/${post.slug}</guid><pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate><description><![CDATA[${post.excerpt}]]></description></item>`).join("\n")}
</channel></rss>`;
  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
