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

/** Non-CDN client for webhook handlers that need to read just-written data
 *  without CDN propagation delay. Requires SANITY_API_READ_TOKEN in env. */
export const sanityWebhookClient =
  sanityEnv.projectId && process.env.SANITY_API_READ_TOKEN
    ? createClient({
        projectId: sanityEnv.projectId,
        dataset: sanityEnv.dataset,
        apiVersion: "2026-07-01",
        useCdn: false,
        token: process.env.SANITY_API_READ_TOKEN,
        perspective: "published",
      })
    : null;
