import { createImageUrlBuilder } from "@sanity/image-url";
import type { SanityImage } from "./types";
import { sanityEnv } from "@/sanity/env";

const builder = sanityEnv.projectId
  ? createImageUrlBuilder({
      projectId: sanityEnv.projectId,
      dataset: sanityEnv.dataset,
    })
  : null;

export function urlForImage(source: SanityImage) {
  if (!builder) throw new Error("Sanity image URL builder is not configured.");
  return builder.image(source);
}
