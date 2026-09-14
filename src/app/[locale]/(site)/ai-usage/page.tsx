import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";

// Body content mirrors AI-USAGE.md at the repo root (the single source of
// truth for repository visitors). The page keeps the body in English; move
// the sections into the id dictionary if a fully localized version is wanted.

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/ai-usage">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = (await getDictionary(locale)).aiUsage;
  return { title: t.metaTitle, description: t.metaDescription };
}

export default async function AiUsagePage({
  params,
}: PageProps<"/[locale]/ai-usage">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = (await getDictionary(locale)).aiUsage;

  return (
    <div className="shell page-wrap">
      <header className="page-intro">
        <p className="eyebrow">{t.eyebrow}</p>
        <h1>{t.title}</h1>
        <p>{t.description}</p>
      </header>

      <div className="long-copy ai-usage-copy">
        <h2>Tools</h2>
        <ul className="ai-usage-list">
          <li>
            <strong>pi.dev</strong> — an AI coding agent that writes, edits, and
            verifies code in this repository.
          </li>
          <li>
            <strong>OpenRouter</strong> — the provider that routes the models
            pi.dev uses.
          </li>
          <li>
            <strong>OmniRoute</strong> — a self-hosted, OpenAI-compatible
            gateway. The Lab&apos;s Daily Questions tool calls it at runtime to
            write each day&apos;s question; it is not involved in building this
            site.
          </li>
        </ul>

        <h2>What the AI did</h2>
        <ul className="ai-usage-list">
          <li>
            Scaffolded the project and implemented most of the application code
            (Next.js App Router pages, components, styling).
          </li>
          <li>
            Built the Sanity CMS integration: content schema, GROQ queries,
            fetch layer, and the ISR revalidation webhook — including the
            document-level en/id internationalization migration.
          </li>
          <li>
            Wrote engineering planning documents and internal analysis (kept out
            of this repository by design).
          </li>
          <li>
            Debugged issues and ran verification (typecheck, lint, production
            build).
          </li>
        </ul>

        <h2>What stayed human</h2>
        <ul className="ai-usage-list">
          <li>
            <strong>Design direction</strong> — the visual system, layout, and
            typography decisions.
          </li>
          <li>
            <strong>
              All published writing outside the Daily Questions tool
            </strong>{" "}
            — page copy, journal posts, and this disclosure.
          </li>
          <li>
            <strong>Final review</strong> — every change was reviewed before it
            was committed and deployed.
          </li>
        </ul>

        <h2>Generated content</h2>
        <p>
          There is exactly one place on this site where an AI writes published
          content rather than code:{" "}
          <strong>
            the daily question in the Lab&apos;s Daily Questions tool
          </strong>
          .
        </p>
        <ul className="ai-usage-list">
          <li>
            The question is generated once per UTC day by the model behind
            OmniRoute, then stored and served to everyone. It is not regenerated
            per visitor.
          </li>
          <li>
            It appears publicly on the question-of-the-day page and in the
            question archive, and those pages say so.
          </li>
          <li>
            Knowledge questions carry a model-written answer and explanation.
            These are checked by hand when read, but not edited before
            publication, so treat them as machine output that may occasionally
            be wrong.
          </li>
          <li>
            Everything a person writes inside the tool — everyone&apos;s answers
            — is private and is never published.
          </li>
        </ul>

        <h2>Verification</h2>
        <ul className="ai-usage-list">
          <li>
            Git history (<code>git log</code>) shows the full evolution of the
            codebase.
          </li>
          <li>
            Planning notes are intentionally not committed, so this repository
            shows finished, reviewed work rather than raw agent logs.
          </li>
          <li>
            No AI-generated prose is presented as human-written content. The
            single machine-written surface, the daily question, is labelled as
            machine-written.
          </li>
        </ul>

        <p className="ai-usage-updated">Last updated: 2026-09-10</p>
      </div>
    </div>
  );
}
