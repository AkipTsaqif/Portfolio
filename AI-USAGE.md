# AI Usage

This site and its repository were built with AI assistance. I'm keeping this
note public because I believe tooling transparency is part of doing good work.
Here's exactly how AI was — and wasn't — used.

## Tools

- **pi.dev** — an AI coding agent that writes, edits, and verifies code in this
  repository.
- **OpenRouter** — the provider that routes the models pi.dev uses.

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
- **All published writing** — page copy, journal posts, and this disclosure.
- **Final review** — every change was reviewed before it was committed and
  deployed. I take responsibility for everything in this repository.

## Verification

- Git history (`git log`) shows the full evolution of the codebase.
- Planning notes are intentionally not committed, so this repository shows
  finished, reviewed work rather than raw agent logs.
- No AI-generated prose is presented as human-written content.

*Last updated: 2026-07-31*
