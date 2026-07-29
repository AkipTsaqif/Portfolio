export type LabTool = {
  slug: string;
  name: string;
  description: string;
  category: "Developer" | "Design" | "Media" | "Everyday";
  status: "Stable" | "Experimental";
  localOnly: boolean;
};

/**
 * Add tools here after creating their route at `/lab/[slug]`.
 * The Lab index and sitemap are generated from this registry.
 *
 * Example:
 * {
 *   slug: "json-formatter",
 *   name: "JSON Formatter",
 *   description: "Format and validate JSON without sending it anywhere.",
 *   category: "Developer",
 *   status: "Stable",
 *   localOnly: true,
 * }
 */
export const labTools: LabTool[] = [
  {
    slug: "pdf-progress-chart",
    name: "PDF Progress Chart",
    description:
      "Compare progress metrics from multiple SE2026 reports locally.",
    category: "Everyday",
    status: "Experimental",
    localOnly: true,
  },
];
