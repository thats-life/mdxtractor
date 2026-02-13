# mdxtractor

Parse Markdown/MDX into structured sections and extract component metadata — imports, code examples, props, and sub-components. Zero npm runtime dependencies, powered by Bun built-ins (`Bun.markdown`, `HTMLRewriter`, `Bun.file`).

## Install

```bash
bun install
```

## Usage

```ts
import { parseMarkdown, extractComponents, generateTypes } from "mdxtractor";

// Parse markdown into structured sections
const doc = await parseMarkdown(`
# Button

## Usage

\`\`\`tsx
import { Button } from "@ui/button";
export default () => <Button>Click</Button>;
\`\`\`

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| variant | string | primary | The button style |
| size | string | md | The button size |
`);

doc.title; // "Button"
doc.headings; // HeadingSection[]
doc.codeBlocks; // CodeSection[]
doc.tables; // TableSection[]
doc.byType("code"); // filter sections by type
doc.byLang("tsx"); // filter code blocks by language
doc.search("variant"); // full-text search across sections

// Extract component metadata from parsed doc
const [component] = extractComponents(doc);
component.name; // "Button"
component.imports; // ['import { Button } from "@ui/button";']
component.examples; // [{ title: "Usage", lang: "tsx", code: "..." }]
component.props; // [{ name: "variant", type: "string", default: "primary", ... }]

// Generate TypeScript interface from extracted props
generateTypes(component);
// export interface ButtonProps {
//   /** The button style */
//   variant?: string;
//   /** The button size */
//   size?: string;
// }
```

### Parse from file or URL

```ts
import { parseFile, fetchDocs } from "mdxtractor";

const doc = await parseFile("./docs/button.md");
const doc = await fetchDocs("https://raw.githubusercontent.com/.../button.md");
```

### Extract snippets

```ts
import { extractSnippets } from "mdxtractor";

const snippets = extractSnippets(doc); // Map<string, string>
// key = filename (from comment) or "HeadingTitle.lang"
```

## API

| Function                          | Description                                      |
| --------------------------------- | ------------------------------------------------ |
| `parseMarkdown(content, source?)` | Parse markdown string into `ParsedDoc`           |
| `parseFile(path)`                 | Parse a local `.md` file                         |
| `fetchDocs(url)`                  | Fetch and parse a remote markdown URL            |
| `extractComponents(doc)`          | Extract component metadata from a parsed doc     |
| `extractSnippets(doc)`            | Extract code snippets as a `Map<string, string>` |
| `extractCodeByLang(doc, lang)`    | Get code blocks filtered by language             |
| `generateTypes(component)`        | Generate a TypeScript interface from props       |

## Section Types

Parsed documents contain a discriminated union of section types:

- **`heading`** — level, text, slug
- **`code`** — lang, code, optional filename (from `// file.ts` comments)
- **`table`** — headers, rows as `Record<string, string>[]`
- **`list`** — ordered/unordered, items
- **`content`** — paragraph text

## Development

```bash
bun install          # install dependencies
bun test             # run tests
bun run check        # fmt + lint + test (pre-commit)
bun bunup            # build to dist/
```

## License

MIT
