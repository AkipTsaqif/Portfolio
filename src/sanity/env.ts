const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";

export const sanityEnv = {
  projectId,
  dataset,
  isConfigured: Boolean(projectId),
} as const;

export function requireSanityEnv() {
  if (!projectId) {
    throw new Error(
      "Missing NEXT_PUBLIC_SANITY_PROJECT_ID. Copy .env.example to .env.local and add your Sanity project ID.",
    );
  }

  return { projectId, dataset };
}
