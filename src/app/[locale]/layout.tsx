import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { isLocale, locales } from "@/i18n/config";
import { I18nProvider } from "@/i18n/client-context";
import { getDictionary } from "@/i18n/dictionaries";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: {
    default: "Sri Ahmad Tsaqif — Web developer",
    template: "%s — Sri Ahmad Tsaqif",
  },
  description:
    "A web developer building thoughtful digital products and documenting the places that inspire them.",
  openGraph: { type: "website", siteName: "Sri Ahmad Tsaqif" },
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dictionary = await getDictionary(locale);

  return (
    <I18nProvider locale={locale} dictionary={dictionary}>
      <div lang={locale} data-locale={locale}>
        <a className="skip-link" href="#main-content">
          {dictionary.common.skipToContent}
        </a>
        <SiteHeader />
        <main id="main-content">{children}</main>
        <SiteFooter />
      </div>
    </I18nProvider>
  );
}
