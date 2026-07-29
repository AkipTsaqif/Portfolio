import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PdfProgressTool } from "@/features/lab/pdf-progress/pdf-progress-tool";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale, localizedPath } from "@/i18n/config";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/lab/pdf-progress-chart">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = (await getDictionary(locale)).pdfToolPage;
  return { title: t.metaTitle, description: t.metaDescription };
}

export default async function PdfProgressPage({
  params,
}: PageProps<"/[locale]/lab/pdf-progress-chart">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dictionary = await getDictionary(locale);
  const t = dictionary.pdfToolPage;
  return (
    <div className="shell page-wrap pdf-progress-page">
      <Link className="back-link" href={localizedPath(locale, "/lab")}>
        ← {dictionary.common.backToLab}
      </Link>
      <header className="page-intro pdf-tool-intro">
        <p className="eyebrow">{t.eyebrow}</p>
        <h1>{t.title}</h1>
        <p>{t.description}</p>
      </header>
      <PdfProgressTool />
    </div>
  );
}
