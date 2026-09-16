import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ParityTool } from "@/features/lab/i18n-parity/parity-tool";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale, localizedPath } from "@/i18n/config";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/lab/i18n-parity">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = (await getDictionary(locale)).parityTool;
  return { title: t.metaTitle, description: t.metaDescription };
}

export default async function I18nParityPage({
  params,
}: PageProps<"/[locale]/lab/i18n-parity">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dictionary = await getDictionary(locale);
  const t = dictionary.parityTool;

  return (
    <div className="shell page-wrap parity-page">
      <Link className="back-link" href={localizedPath(locale, "/lab")}>
        ← {dictionary.common.backToLab}
      </Link>

      <header className="page-intro parity-intro">
        <p className="eyebrow">{t.eyebrow}</p>
        <h1>{t.title}</h1>
        <p>{t.description}</p>
      </header>

      <ParityTool />
    </div>
  );
}
