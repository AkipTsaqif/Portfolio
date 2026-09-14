# AI Usage

This site and its repository were built with AI assistance. I'm keeping this
note public because I believe tooling transparency is part of doing good work.
Here's exactly how AI was — and wasn't — used.

## Tools

- **pi.dev** — an AI coding agent that writes, edits, and verifies code in this
  repository.
- **OpenRouter** — the provider that routes the models pi.dev uses.
- **OmniRoute** — a self-hosted, OpenAI-compatible gateway. The Lab's Daily
  Questions tool calls it at runtime to write each day's question; it is not
  involved in building this site.

## What the AI did

- Scaffolded the project and implemented most of the application code
  (Next.js App Router pages, components, styling).
- Built the Sanity CMS integration: content schema, GROQ queries, fetch layer,
  and the ISR revalidation webhook — including the document-level en/id
  internationalization migration.
- Wrote engineering planning documents and internal analysis (these are kept
  out of the repository by design).
- Debugged issues and ran verification (typecheck, lint, production build).

## What stayed human

- **Design direction** — the visual system, layout, and typography decisions.
- **All published writing outside the Daily Questions tool** — page copy,
  journal posts, and this disclosure.
- **Final review** — every change was reviewed before it was committed and
  deployed. I take responsibility for everything in this repository.

## Generated content

There is exactly one place on this site where an AI writes published content
rather than code: **the daily question in the Lab's Daily Questions tool**.

- The question is generated once per UTC day by the model behind OmniRoute, then
  stored and served to everyone. It is not regenerated per visitor.
- It appears publicly on the question-of-the-day page and in the question
  archive, and those pages say so — the tool is described as machine-generated
  wherever it surfaces.
- Knowledge questions carry a model-written answer and explanation. These are
  checked by hand when I read them, but they are not edited before publication,
  so **treat them as machine output that may occasionally be wrong.**
- Everything a person writes inside the tool — everyone's answers — is private
  and is never published.

## Verification

- Git history (`git log`) shows the full evolution of the codebase.
- Planning notes are intentionally not committed, so this repository shows
  finished, reviewed work rather than raw agent logs.
- No AI-generated prose is presented as human-written content. The single
  machine-written surface, the daily question, is labelled as machine-written.

_Last updated: 2026-09-10_
