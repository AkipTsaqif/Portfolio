import Link from "next/link";
import { notFound } from "next/navigation";
import { SanityLatestPosts } from "@/components/sanity/sanity-blog-content";
import { ProjectCard } from "@/components/projects/project-card";
import { ArrowIcon } from "@/components/ui/arrow-icon";
import { SectionHeading } from "@/components/ui/section-heading";
import { projects } from "@/data/projects";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale, localizedPath } from "@/i18n/config";

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dictionary = await getDictionary(locale);
  const t = dictionary.home;
  return (
    <>
      <section className="hero shell">
        <div className="hero-status">
          <span className="status-dot" aria-hidden="true" />
          {t.status}
        </div>
        <h1>
          {t.heroTitle}
          <span>{t.heroAccent}</span>
        </h1>
        <div className="hero-bottom">
          <p>{t.heroDescription}</p>
          <Link
            className="button-link"
            href={localizedPath(locale, "/projects")}
          >
            {t.exploreWork} <ArrowIcon />
          </Link>
        </div>
        <div className="hero-orbit" aria-hidden="true">
          <span>DESIGN</span>
          <i />
          <span>CODE</span>
          <i />
          <span>EXPLORE</span>
        </div>
      </section>

      <section className="section shell" aria-labelledby="selected-work">
        <SectionHeading
          eyebrow={t.selectedEyebrow}
          title={t.selectedTitle}
          description={t.selectedDescription}
        />
        <div className="project-grid">
          {projects
            .filter((project) => project.featured)
            .map((project, index) => (
              <ProjectCard
                key={project.slug}
                locale={locale}
                project={project}
                priority={index === 0}
              />
            ))}
        </div>
        <div className="section-action">
          <Link className="text-link" href={localizedPath(locale, "/projects")}>
            {t.allProjects} <ArrowIcon />
          </Link>
        </div>
      </section>

      <section className="statement-section">
        <div className="shell statement-grid">
          <p className="eyebrow">{t.workEyebrow}</p>
          <blockquote>
            {t.workPrefix} <em>{t.workEmphasis}</em>
            {t.workSuffix}
          </blockquote>
          <div className="principles">
            <div>
              <span>01</span>
              <p>{t.principle1}</p>
            </div>
            <div>
              <span>02</span>
              <p>{t.principle2}</p>
            </div>
            <div>
              <span>03</span>
              <p>{t.principle3}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section shell" aria-labelledby="journal-heading">
        <SectionHeading
          eyebrow={t.journalEyebrow}
          title={t.journalTitle}
          description={t.journalDescription}
        />
        <div className="post-grid">
          <SanityLatestPosts locale={locale} />
        </div>
        <div className="section-action">
          <Link className="text-link" href={localizedPath(locale, "/blog")}>
            {t.visitJournal} <ArrowIcon />
          </Link>
        </div>
      </section>
    </>
  );
}
