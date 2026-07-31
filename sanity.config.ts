"use client";

import { documentInternationalization } from "@sanity/document-internationalization";
import { visionTool } from "@sanity/vision";
import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { sanityEnv } from "./src/sanity/env";
import { schemaTypes } from "./src/sanity/schemaTypes";

const projectId = sanityEnv.projectId ?? "missing-project-id";
const dataset = sanityEnv.dataset;

export default defineConfig({
  name: "default",
  title: "Portfolio Journal",
  projectId,
  dataset,
  basePath: "/studio",
  plugins: [
    structureTool(),
    visionTool(),
    documentInternationalization({
      supportedLanguages: [
        { id: "en", title: "English" },
        { id: "id", title: "Bahasa Indonesia" },
      ],
      schemaTypes: ["post"],
      languageField: "language",
    }),
  ],
  schema: { types: schemaTypes },
});
