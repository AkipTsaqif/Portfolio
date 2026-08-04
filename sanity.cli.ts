import { defineCliConfig } from "sanity/cli";

export default defineCliConfig({
  api: {
    // Hardcoded — standalone `sanity deploy` / `sanity build` must always
    // target this project + production.  The embedded Next.js Studio at
    // /studio reads NEXT_PUBLIC_SANITY_* via @next/env so dev still
    // resolves "development" from .env.development.local.
    projectId: "d4k85v13",
    dataset: "production",
  },
  deployment: {
    appId: "v6vbo3bn2dlddgbrvcp58fpr",
  },
});
