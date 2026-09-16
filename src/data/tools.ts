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
  {
    slug: "daily-questions",
    name: "Daily Questions",
    description:
      "One question a day, answered privately, then revealed to each other.",
    category: "Everyday",
    status: "Experimental",
    localOnly: false,
  },
  {
    slug: "i18n-parity",
    name: "i18n Parity Checker",
    description:
      "Compare two translation files and find the keys that drifted apart.",
    category: "Developer",
    status: "Stable",
    localOnly: true,
  },
];

/**
 * Per-slug overrides for the English defaults above.
 *
 * The Lab index prefers `dictionary.lab.toolCopy[slug]` when it exists, which is
 * how the tool cards get translated. This registry stays the English fallback
 * and the source of truth for the sitemap.
 */
