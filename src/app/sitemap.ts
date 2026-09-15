import type { MetadataRoute } from "next";
import { posts } from "@/data/posts";
import { projects } from "@/data/projects";
import { labTools } from "@/data/tools";
import { locales, localizedPath } from "@/i18n/config";
import { isDatabaseConfigured } from "@/lib/db/env";
import { listPublishedDates } from "@/features/lab/daily-questions/questions";
import { getSanityDestinations, getSanitySlugs } from "@/lib/sanity/fetch";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const staticRoutes = [
    "",
    "/about",
    "/projects",
    "/blog",
    "/lab",
    "/contact",
    "/ai-usage",
  ];

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

  // The public Daily Questions surfaces are real, changing content. Room and join
  // routes are deliberately absent: they are private and must never be listed.
  const dailyQuestionEntries: MetadataRoute.Sitemap = locales.flatMap(
    (locale) => [
      {
        url: `${baseUrl}${localizedPath(locale, "/lab/daily-questions/today")}`,
        changeFrequency: "daily" as const,
        priority: 0.7,
      },
      {
        url: `${baseUrl}${localizedPath(locale, "/lab/daily-questions/archive")}`,
        changeFrequency: "daily" as const,
        priority: 0.6,
      },
    ],
  );

  // One page per day that has a question. These are real, dated, unique content — the
  // strongest thing the tool has for search — and they were previously missing from the
  // sitemap while `/today` and `/archive` were listed.
  //
  // Bounded, and guarded: a sitemap that throws is a sitemap search engines drop. An
  // unreachable database yields the two index pages rather than a 500.
  const archivedDates = isDatabaseConfigured()
    ? await listPublishedDates(90).catch(() => [])
    : [];

  const dailyArchiveEntries: MetadataRoute.Sitemap = locales.flatMap((locale) =>
    archivedDates.map((date) => ({
      url: `${baseUrl}${localizedPath(locale, `/lab/daily-questions/archive/${date}`)}`,
      changeFrequency: "yearly" as const,
      priority: 0.5,
    })),
  );

  // The travel map is content-dependent: with no destinations entered it renders an empty
  // state, and an empty page is not worth indexing. It joins the sitemap only once there is
  // something to see, so it becomes discoverable exactly when it is worth finding.
  const destinations = (await getSanityDestinations().catch(() => null)) ?? [];
  const travelEntries: MetadataRoute.Sitemap =
    destinations.length > 0
      ? locales.map((locale) => ({
          url: `${baseUrl}${localizedPath(locale, "/travel")}`,
          changeFrequency: "monthly" as const,
          priority: 0.6,
        }))
      : [];

  return [
    ...staticEntries,
    ...projectEntries,
    ...blogEntries,
    ...labEntries,
    ...dailyQuestionEntries,
    ...dailyArchiveEntries,
    ...travelEntries,
  ];
}
