import type { MetadataRoute } from "next";
import { posts } from "@/data/posts";
import { projects } from "@/data/projects";
import { labTools } from "@/data/tools";
import {
  locales,
  localizedPath,
} from "@/i18n/config";
import { getSanitySlugs } from "@/lib/sanity/fetch";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const staticRoutes = ["", "/about", "/projects", "/blog", "/lab", "/contact"];

  // Per-locale Sanity blog slugs (falls back to static posts when Sanity is not
  // configured). Slugs differ per language under document-level i18n, so we
  // fetch each locale's slugs separately.
  const slugsByLocale = await Promise.all(
    locales.map(async (locale) => ({
      locale,
      slugs: (await getSanitySlugs(locale)) ?? posts.map((p) => p.slug),
    })),
  );

  const staticEntries: MetadataRoute.Sitemap = locales.flatMap((locale) =>
    staticRoutes.map((route) => ({
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
  );

  const projectEntries: MetadataRoute.Sitemap = locales.flatMap((locale) =>
    projects.map((project) => ({
      url: `${baseUrl}${localizedPath(locale, `/projects/${project.slug}`)}`,
      changeFrequency: "yearly" as const,
      priority: 0.7,
    })),
  );

  const blogEntries: MetadataRoute.Sitemap = slugsByLocale.flatMap(
    ({ locale, slugs }) =>
      slugs.map((slug) => ({
        url: `${baseUrl}${localizedPath(locale, `/blog/${slug}`)}`,
        changeFrequency: "yearly" as const,
        priority: 0.7,
      })),
  );

  const labEntries: MetadataRoute.Sitemap = locales.flatMap((locale) =>
    labTools.map((tool) => ({
      url: `${baseUrl}${localizedPath(locale, `/lab/${tool.slug}`)}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  );

  return [...staticEntries, ...projectEntries, ...blogEntries, ...labEntries];
}
