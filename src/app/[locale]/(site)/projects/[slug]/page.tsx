import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowIcon } from "@/components/ui/arrow-icon";
import { getProject, projects } from "@/data/projects";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale, localizedPath } from "@/i18n/config";

export function generateStaticParams() {
  return projects.flatMap((project) =>
    ["en", "id"].map((locale) => ({ locale, slug: project.slug })),
  );
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/projects/[slug]">): Promise<Metadata> {
  const { slug, locale } = await params;
  const project = getProject(slug);
  if (!project || !isLocale(locale)) return {};
  return { title: project.title, description: project.summary };
}

export default async function ProjectPage({
  params,
}: PageProps<"/[locale]/projects/[slug]">) {
  const { slug, locale } = await params;
  if (!isLocale(locale)) notFound();
  const project = getProject(slug);
  if (!project) notFound();
  const t = (await getDictionary(locale)).projects;

  return (
    <article className="shell page-wrap case-study">
      <Link className="back-link" href={localizedPath(locale, "/projects")}>
        ← {t.all}
      </Link>
      <header className="case-header">
        <p className="eyebrow">
          {project.role} · {project.year}
        </p>
        <h1>{project.title}</h1>
        <p>{project.summary}</p>
      </header>
      <div className={`case-hero visual-${project.accent}`}>
        <div className="visual-window" aria-hidden="true">
          <span />
          <span />
          <span />
          <strong>{project.title}</strong>
        </div>
      </div>
      <div className="case-grid">
        <div>
          <p className="eyebrow">{t.overview}</p>
          <p className="case-description">{project.description}</p>
        </div>
        <dl>
          <div>
            <dt>{t.role}</dt>
            <dd>{project.role}</dd>
          </div>
          <div>
            <dt>{t.year}</dt>
            <dd>{project.year}</dd>
          </div>
          <div>
            <dt>{t.stack}</dt>
            <dd>{project.stack.join(", ")}</dd>
          </div>
        </dl>
      </div>
      <section className="case-outcome">
        <p className="eyebrow">{t.outcome}</p>
        <h2>{project.outcome}</h2>
      </section>
      <Link className="button-link" href={localizedPath(locale, "/contact")}>
        {t.discuss} <ArrowIcon />
      </Link>
    </article>
  );
}
