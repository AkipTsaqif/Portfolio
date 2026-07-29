import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowIcon } from "@/components/ui/arrow-icon";
import { labTools } from "@/data/tools";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale, localizedPath } from "@/i18n/config";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/lab">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = (await getDictionary(locale)).lab;
  return { title: t.metaTitle, description: t.metaDescription };
}

export default async function LabPage({ params }: PageProps<"/[locale]/lab">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dictionary = await getDictionary(locale);
  const t = dictionary.lab;
  return (
    <div className="shell page-wrap lab-page">
      <header className="page-intro lab-intro">
        <p className="eyebrow">{t.eyebrow}</p>
        <h1>{t.title}</h1>
        <div className="lab-intro-copy">
          <p>{t.description}</p>
          <p className="lab-privacy-note">
            <span aria-hidden="true">●</span> {t.privacy}
          </p>
        </div>
      </header>
      <section className="lab-grid" aria-label={t.available}>
        {labTools.map((tool, index) => (
          <article className="lab-card" key={tool.slug}>
            <Link
              className="lab-card-link"
              href={localizedPath(locale, `/lab/${tool.slug}`)}
            >
              <div className="lab-card-topline">
                <span>0{index + 1}</span>
                <span>{t.status[tool.status]}</span>
              </div>
              <div className="lab-card-copy">
                <p className="lab-category">{t.category[tool.category]}</p>
                <h2>
                  {tool.slug === "pdf-progress-chart"
                    ? dictionary.pdfTool.toolName
                    : tool.name}
                </h2>
                <p>
                  {tool.slug === "pdf-progress-chart"
                    ? dictionary.pdfTool.toolDescription
                    : tool.description}
                </p>
              </div>
              <div className="lab-card-footer">
                <span>{tool.localOnly ? t.runsLocally : t.webUtility}</span>
                <ArrowIcon />
              </div>
            </Link>
          </article>
        ))}
      </section>
      <aside className="lab-principles" aria-label={t.principlesLabel}>
        <p className="eyebrow">{t.principlesEyebrow}</p>
        <ol>
          <li>
            <span>01</span>
            <strong>{t.focused}</strong>
            <p>{t.focusedText}</p>
          </li>
          <li>
            <span>02</span>
            <strong>{t.private}</strong>
            <p>{t.privateText}</p>
          </li>
          <li>
            <span>03</span>
            <strong>{t.open}</strong>
            <p>{t.openText}</p>
          </li>
        </ol>
      </aside>
    </div>
  );
}
