import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SanityBlogIndex } from "@/components/sanity/sanity-blog-content";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/blog">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = (await getDictionary(locale)).blog;
  return { title: t.metaTitle, description: t.metaDescription };
}

export default async function BlogPage({
  params,
}: PageProps<"/[locale]/blog">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = (await getDictionary(locale)).blog;
  return (
    <div className="shell page-wrap">
      <header className="page-intro">
        <p className="eyebrow">{t.eyebrow}</p>
        <h1>{t.title}</h1>
        <p>{t.description}</p>
      </header>
      <SanityBlogIndex locale={locale} />
    </div>
  );
}
