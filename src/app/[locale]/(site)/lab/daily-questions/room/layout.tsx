import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/features/lab/daily-questions/session";
import { isLocale, localizedPath } from "@/i18n/config";

/**
 * The guard for every private route.
 *
 * Three layers keep rooms out of search results: this metadata, an
 * `X-Robots-Tag` header in `next.config.ts`, and the fact that room URLs are
 * never listed in the sitemap. `robots.txt` deliberately does *not* disallow
 * them — a crawler that cannot fetch the page cannot see the `noindex` either,
 * which is the directive that actually removes it from results.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function RoomLayout({
  children,
  params,
}: LayoutProps<"/[locale]/lab/daily-questions/room">) {
  const { locale } = await params;

  if (isLocale(locale)) {
    const session = await getSession();
    if (!session) redirect(localizedPath(locale, "/lab/daily-questions"));
  }

  return children;
}
