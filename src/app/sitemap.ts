import type { MetadataRoute } from "next";
import { posts } from "@/data/posts";
import { projects } from "@/data/projects";
import { labTools } from "@/data/tools";
import { locales, localizedPath } from "@/i18n/config";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const staticRoutes = ["", "/about", "/projects", "/blog", "/lab", "/contact"];

  return locales.flatMap((locale) => [
    ...staticRoutes.map((route) => ({
      url: `${baseUrl}${localizedPath(locale, route || "/")}`,
      changeFrequency:
        route === "/blog" ? ("weekly" as const) : ("monthly" as const),
      priority: route === "" ? 1 : 0.8,
      alternates: {
        languages: Object.fromEntries(
          locales.map((language) => [
            language,
            `${baseUrl}${localizedPath(language, route || "/")}`,
          ]),
        ),
      },
    })),
    ...projects.map((project) => ({
      url: `${baseUrl}${localizedPath(locale, `/projects/${project.slug}`)}`,
      changeFrequency: "yearly" as const,
      priority: 0.7,
    })),
    ...posts.map((post) => ({
      url: `${baseUrl}${localizedPath(locale, `/blog/${post.slug}`)}`,
      lastModified: new Date(post.publishedAt),
      changeFrequency: "yearly" as const,
      priority: 0.7,
    })),
    ...labTools.map((tool) => ({
      url: `${baseUrl}${localizedPath(locale, `/lab/${tool.slug}`)}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ]);
}
