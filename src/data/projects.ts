export type Project = {
  slug: string;
  title: string;
  summary: string;
  description: string;
  year: string;
  role: string;
  stack: string[];
  outcome: string;
  accent: "cobalt" | "coral" | "lime";
  featured: boolean;
  liveUrl?: string;
  repositoryUrl?: string;
};

export const projects: Project[] = [
  {
    slug: "atlas-commerce",
    title: "Atlas Commerce",
    summary:
      "A fast storefront that makes discovering independent goods feel effortless.",
    description:
      "A ground-up commerce experience focused on editorial product discovery, fast navigation, and an accessible checkout journey.",
    year: "2026",
    role: "Design engineering & frontend",
    stack: ["Next.js", "TypeScript", "Sanity", "Stripe"],
    outcome:
      "Improved mobile conversion and gave the content team a flexible publishing workflow.",
    accent: "cobalt",
    featured: true,
  },
  {
    slug: "roam-planner",
    title: "Roam Planner",
    summary:
      "A collaborative trip planner for turning saved places into an actual itinerary.",
    description:
      "A map-led planning tool that helps small groups collect recommendations, make decisions, and build a shared daily itinerary.",
    year: "2025",
    role: "Product design & full-stack development",
    stack: ["React", "Node.js", "PostgreSQL", "Mapbox"],
    outcome:
      "Reduced planning friction by bringing scattered links, notes, and votes into one clear workspace.",
    accent: "coral",
    featured: true,
  },
  {
    slug: "field-notes",
    title: "Field Notes",
    summary:
      "A calm publishing system for visual essays, interviews, and field research.",
    description:
      "An image-forward editorial platform with flexible story blocks and a carefully tuned reading experience across devices.",
    year: "2025",
    role: "Frontend development",
    stack: ["Next.js", "Sanity", "Tailwind CSS"],
    outcome:
      "Cut publishing time while maintaining a distinct visual system for every story format.",
    accent: "lime",
    featured: true,
  },
];

export function getProject(slug: string) {
  return projects.find((project) => project.slug === slug);
}
