"use client";

import { NextStudio } from "next-sanity/studio";
import config from "../../../../sanity.config";
import { sanityEnv } from "@/sanity/env";

export default function StudioPage() {
  if (!sanityEnv.isConfigured) {
    return (
      <main className="studio-setup">
        <h1>Connect Sanity Studio</h1>
        <p>
          Add your Sanity project ID to <code>.env.local</code>, then restart
          the development server.
        </p>
        <pre>NEXT_PUBLIC_SANITY_PROJECT_ID=your_project_id</pre>
      </main>
    );
  }

  return <NextStudio config={config} />;
}
