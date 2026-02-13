# Project Guidelines

## Overview

`mdxtractor` is a Bun-native library that parses Markdown/MDX into structured sections and extracts component metadata (imports, code examples, props). It has zero npm runtime dependencies — it relies on Bun built-ins (`Bun.markdown`, `HTMLRewriter`, `Bun.file`).

## Code Style

- **Runtime**: Bun only — never use Node.js APIs when Bun equivalents exist (see `CLAUDE.md`)
- **TypeScript strict mode** enabled with `noUncheckedIndexedAccess` and `noImplicitOverride`
- Use `verbatimModuleSyntax` — always use `import type` for type-only imports
- ESM only (`"type": "module"`)
- Discriminated unions for section types — see `Section` in `src/parser.ts`

## Architecture

Two modules in `src/`, re-exported via `src/index.ts`:

- **`parser.ts`** — Converts raw Markdown to structured `Section[]` using `Bun.markdown.html()` + `HTMLRewriter`. Supports headings, code blocks, tables, lists, and paragraphs. Provides `parseMarkdown()`, `fetchDocs()`, and `parseFile()`.
- **`extractor.ts`** — Consumes `ParsedDoc` from the parser to extract component metadata: imports, code examples, prop definitions (from tables), and sub-components. Key functions: `extractComponents()`, `extractSnippets()`, `generateTypes()`.

Data flows: raw markdown → `Bun.markdown.html()` → HTML → `HTMLRewriter` handlers → `Section[]` → extractor functions.

## Build and Test

```sh
bun install          # install dependencies
bun bunup            # build to dist/ (ESM + .d.ts via tsgo)
bun test             # run tests (no tests exist yet — use bun:test)
```

Build config is in `bunup.config.ts` — outputs ESM targeting Bun with the `exports()` plugin for auto-syncing package.json exports.

## Project Conventions

- Section types use a discriminated union on `type` field — always narrow with type guards (see `s.type === "heading"` pattern in `parser.ts`)
- `idx` field on sections tracks document ordering and is used by the extractor to associate code blocks with their nearest preceding heading
- `raw` field on every section contains a Markdown-reconstructed representation
- Comments and some JSDoc are in Portuguese (Brazilian) — maintain this if already present in a file
- The `slugify()` helper in `parser.ts` is intentionally simple (ASCII-only) — match this style
