"use client";

import Link from "next/link";
import { navigation, siteConfig } from "@/data/site";
import { localizedPath } from "@/i18n/config";
import { useI18n } from "@/i18n/client-context";
import { LanguageSwitcher } from "./language-switcher";

export function SiteHeader() {
  const { locale, dictionary } = useI18n();
  const labels = dictionary.navigation;
  const translatedNavigation = navigation.slice(1).map((item) => ({
    ...item,
    label: labels[item.href.slice(1) as keyof typeof labels] ?? item.label,
  }));

  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link
          className="wordmark"
          href={localizedPath(locale)}
          aria-label={`${siteConfig.name}, home`}
        >
          <span className="wordmark-mark" aria-hidden="true">
            YN
          </span>
          <span>{siteConfig.name}</span>
        </Link>
        <nav aria-label="Primary navigation">
          <ul className="nav-list">
            {translatedNavigation.map((item) => (
              <li key={item.href}>
                <Link href={localizedPath(locale, item.href)}>
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <LanguageSwitcher />
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
