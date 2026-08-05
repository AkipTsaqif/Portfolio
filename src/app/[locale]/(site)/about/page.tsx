import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowIcon } from "@/components/ui/arrow-icon";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale, localizedPath } from "@/i18n/config";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/about">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = (await getDictionary(locale)).about;
  return { title: t.metaTitle, description: t.metaDescription };
}

export default async function AboutPage({
  params,
}: PageProps<"/[locale]/about">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = (await getDictionary(locale)).about;
  return (
    <div className="shell page-wrap">
      <header className="page-intro about-intro">
        <p className="eyebrow">{t.eyebrow}</p>
        <h1>{t.title}</h1>
      </header>
      <section className="about-grid">
        <div className="portrait-placeholder" aria-label={t.portrait}>
          <span>{t.photo}</span>
        </div>
        <div className="long-copy">
          <p className="lead">{t.lead}</p>
          <p>{t.paragraph1}</p>
          <p>{t.paragraph2}</p>
          <p className="about-ai-note">
            {t.aiDisclosure}{" "}
            <Link href={localizedPath(locale, "/ai-usage")}>
              {t.aiDisclosureLink}
            </Link>
          </p>
          <h2>{t.skillsTitle}</h2>
          <ul className="skill-list">
            {t.skills.map((skill, index) => (
              <li key={skill}>
                <span>0{index + 1}</span>
                {skill}
              </li>
            ))}
          </ul>
          <Link
            className="button-link"
            href={localizedPath(locale, "/contact")}
          >
            {t.cta} <ArrowIcon />
          </Link>
        </div>
      </section>
    </div>
  );
}
