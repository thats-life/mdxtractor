# Changelog

## 0.1.0 — 2026-02-13

### Added

- **Parser** (`parseMarkdown`, `parseFile`, `fetchDocs`) — converts Markdown/MDX into structured `Section[]` using `Bun.markdown` + `HTMLRewriter`
  - Supports headings, code blocks, tables, lists, and paragraphs
  - Query helpers: `byType()`, `byLang()`, `search()`
- **Extractor** (`extractComponents`, `extractSnippets`, `extractCodeByLang`, `generateTypes`) — extracts component metadata from parsed docs
  - Import detection, code examples, prop definitions (from tables), sub-component detection
  - TypeScript interface generation from extracted props
- Test suite — 68 tests covering parser and extractor
- Pre-commit hook with format (oxfmt), lint (oxlint), and test checks
- Build via bunup (ESM + `.d.ts` via tsgo)
