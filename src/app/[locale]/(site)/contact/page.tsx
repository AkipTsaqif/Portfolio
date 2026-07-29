import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { siteConfig } from "@/data/site";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/contact">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = (await getDictionary(locale)).contact;
  return { title: t.metaTitle, description: t.metaDescription };
}

export default async function ContactPage({
  params,
}: PageProps<"/[locale]/contact">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = (await getDictionary(locale)).contact;
  return (
    <div className="shell page-wrap contact-page">
      <p className="eyebrow">{t.eyebrow}</p>
      <h1>{t.title}</h1>
      <div className="contact-grid">
        <p>{t.description}</p>
        <div>
          <a className="contact-email" href={`mailto:${siteConfig.email}`}>
            {siteConfig.email}
          </a>
          <div className="contact-links">
            {siteConfig.socialLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noreferrer"
              >
                {link.label} ↗
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
