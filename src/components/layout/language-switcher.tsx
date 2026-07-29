"use client";

import { usePathname, useRouter } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { locales } from "@/i18n/config";
import { useI18n } from "@/i18n/client-context";

export function LanguageSwitcher() {
  const { locale, dictionary } = useI18n();
  const pathname = usePathname();
  const router = useRouter();

  function switchLocale(nextLocale: Locale) {
    const segments = pathname.split("/");
    if (locales.includes(segments[1] as Locale)) segments[1] = nextLocale;
    else segments.splice(1, 0, nextLocale);
    router.push(segments.join("/") || `/${nextLocale}`);
  }

  return (
    <label className="language-switcher">
      <span className="sr-only">{dictionary.common.language}</span>
      <select
        aria-label={dictionary.common.language}
        onChange={(event) => switchLocale(event.target.value as Locale)}
        value={locale}
      >
        <option value="en">EN</option>
        <option value="id">ID</option>
      </select>
    </label>
  );
}
