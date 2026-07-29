import Link from "next/link";
import type { Project } from "@/data/projects";
import { ArrowIcon } from "@/components/ui/arrow-icon";
import type { Locale } from "@/i18n/config";
import { localizedPath } from "@/i18n/config";

export function ProjectCard({
  project,
  priority = false,
  locale = "en",
}: {
  project: Project;
  priority?: boolean;
  locale?: Locale;
}) {
  return (
    <article className="project-card">
      <Link
        href={localizedPath(locale, `/projects/${project.slug}`)}
        className={`project-visual visual-${project.accent}`}
      >
        <span className="visual-index">
          0{priority ? "1" : (project.slug.length % 8) + 1}
        </span>
        <div className="visual-window" aria-hidden="true">
          <span />
          <span />
          <span />
          <strong>{project.title}</strong>
        </div>
        <span className="sr-only">View {project.title} case study</span>
      </Link>
      <div className="project-card-copy">
        <div>
          <p className="project-meta">
            {project.role} · {project.year}
          </p>
          <h3>
            <Link href={localizedPath(locale, `/projects/${project.slug}`)}>
              {project.title}
            </Link>
          </h3>
          <p>{project.summary}</p>
        </div>
        <Link
          className="circle-link"
          href={localizedPath(locale, `/projects/${project.slug}`)}
          aria-label={`View ${project.title}`}
        >
          <ArrowIcon />
        </Link>
      </div>
    </article>
  );
}
