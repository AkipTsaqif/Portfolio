import { createClient } from "next-sanity";
import { sanityEnv } from "@/sanity/env";

export const sanityClient = sanityEnv.projectId
  ? createClient({
      projectId: sanityEnv.projectId,
      dataset: sanityEnv.dataset,
      apiVersion: "2026-07-01",
      useCdn: true,
      perspective: "published",
    })
  : null;
