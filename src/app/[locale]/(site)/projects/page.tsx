import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProjectCard } from "@/components/projects/project-card";
import { projects } from "@/data/projects";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/projects">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = (await getDictionary(locale)).projects;
  return { title: t.metaTitle, description: t.metaDescription };
}

export default async function ProjectsPage({
  params,
}: PageProps<"/[locale]/projects">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = (await getDictionary(locale)).projects;
  return (
    <div className="shell page-wrap">
      <header className="page-intro">
        <p className="eyebrow">{t.eyebrow}</p>
        <h1>{t.title}</h1>
        <p>{t.description}</p>
      </header>
      <div className="project-grid projects-page-grid">
        {projects.map((project, index) => (
          <ProjectCard
            key={project.slug}
            locale={locale}
            project={project}
            priority={index === 0}
          />
        ))}
      </div>
    </div>
  );
}
