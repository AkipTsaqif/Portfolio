import { localizedPath, type Locale } from "@/i18n/config";

/** Absolute site URL, for the invite link we ask people to send on. */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /\/+$/,
    "",
  );
}

export function inviteUrl(locale: Locale, code: string): string {
  return `${siteUrl()}${localizedPath(locale, `/lab/daily-questions/join/${code}`)}`;
}

export function absoluteUrl(locale: Locale, path: string): string {
  return `${siteUrl()}${localizedPath(locale, path)}`;
}
