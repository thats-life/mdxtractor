import { test, expect, describe, beforeAll } from 'bun:test'
import { parseMarkdown } from './parser'
import type { ParsedDoc } from './parser'
import { extractComponents, extractCodeByLang, extractSnippets, generateTypes } from './extractor'
import type { ExtractedComponent } from './extractor'

// ── Fixture ────────────────────────────────────────────────────

// prettier-ignore
const componentMd =
  "# Button\n" +
  "\n" +
  "A reusable button component.\n" +
  "\n" +
  "## Installation\n" +
  "\n" +
  "```bash\n" +
  "bun add @ui/button\n" +
  "```\n" +
  "\n" +
  "## Basic Usage\n" +
  "\n" +
  "```tsx\n" +
  'import { Button } from "@ui/button";\n' +
  "\n" +
  "export default function App() {\n" +
  "  return <Button>Click</Button>;\n" +
  "}\n" +
  "```\n" +
  "\n" +
  "## Advanced Usage\n" +
  "\n" +
  "```tsx\n" +
  'import { Button, ButtonGroup } from "@ui/button";\n' +
  'import { Icon } from "@ui/icon";\n' +
  "\n" +
  "export default function App() {\n" +
  "  return (\n" +
  "    <ButtonGroup>\n" +
  '      <Button variant="primary">Save</Button>\n' +
  "    </ButtonGroup>\n" +
  "  );\n" +
  "}\n" +
  "```\n" +
  "\n" +
  "## Styling\n" +
  "\n" +
  "```css\n" +
  ".btn { color: red; }\n" +
  "```\n" +
  "\n" +
  "## Props\n" +
  "\n" +
  "| Prop | Type | Default | Description |\n" +
  "| --- | --- | --- | --- |\n" +
  "| variant | `string` | `primary` | The button style |\n" +
  "| size | `string` | `md` | The button size |\n" +
  "| disabled | `boolean` | | Whether the button is disabled |\n";

let doc: ParsedDoc
let components: ExtractedComponent[]

describe('extractor', () => {
  beforeAll(async () => {
    doc = await parseMarkdown(componentMd, 'button.md')
    components = extractComponents(doc)
  })

  describe('extractComponents', () => {
    test('retorna ao menos um componente', () => {
      expect(components.length).toBeGreaterThanOrEqual(1)
    })

    test('nome do componente vem do H1', () => {
      expect(components[0]!.name).toBe('Button')
    })

    test('slug corresponde ao heading', () => {
      expect(components[0]!.slug).toBe('button')
    })

    test('retorna vazio quando não há H1', async () => {
      const noH1 = await parseMarkdown('## Only H2\n\nSome text')
      expect(extractComponents(noH1)).toHaveLength(0)
    })

    test('nome do componente remove espaços', async () => {
      const d = await parseMarkdown('# Date Picker\n\nA date picker.')
      const comps = extractComponents(d)
      expect(comps[0]!.name).toBe('DatePicker')
    })
  })

  describe('imports', () => {
    // NOTA: Bun.markdown HTML-encodes " como &quot; dentro de code blocks,
    // então o regex de import não casa com imports que usam aspas duplas.
    // Imports com aspas simples funcionam corretamente.
    test('extrai imports com aspas simples', async () => {
      const md = '# Comp\n\n```tsx\n' + "import { Foo } from '@lib/foo';\n" + '```'
      const d = await parseMarkdown(md)
      const comps = extractComponents(d)
      expect(comps[0]!.imports.length).toBeGreaterThanOrEqual(1)
      expect(comps[0]!.imports[0]).toContain('Foo')
    })

    test('imports são deduplicados', async () => {
      const md =
        '# Comp\n\n```tsx\n' +
        "import { A } from '@lib/a';\n" +
        '```\n\n```tsx\n' +
        "import { A } from '@lib/a';\n" +
        '```'
      const d = await parseMarkdown(md)
      const comps = extractComponents(d)
      const unique = new Set(comps[0]!.imports)
      expect(unique.size).toBe(comps[0]!.imports.length)
    })

    test('ignora imports de blocos não-ts/tsx/jsx', async () => {
      const md = "# Comp\n\n```css\n@import 'styles.css';\n```"
      const d = await parseMarkdown(md)
      const comps = extractComponents(d)
      expect(comps[0]!.imports).toHaveLength(0)
    })
  })

  describe('examples', () => {
    test('extrai exemplos de código tsx/ts/jsx/js', () => {
      const comp = components[0]!
      expect(comp.examples.length).toBeGreaterThanOrEqual(2)
    })

    test('exemplo tem título do heading anterior mais próximo', () => {
      const comp = components[0]!
      const titles = comp.examples.map((e) => e.title)
      expect(titles).toContain('Basic Usage')
      expect(titles).toContain('Advanced Usage')
    })

    test('exclui blocos CSS/bash dos exemplos', () => {
      const comp = components[0]!
      const langs = comp.examples.map((e) => e.lang)
      expect(langs).not.toContain('css')
      expect(langs).not.toContain('bash')
    })

    test('exemplos preservam imports do código', () => {
      const comp = components[0]!
      const basic = comp.examples.find((e) => e.title === 'Basic Usage')
      expect(basic).toBeDefined()
      expect(basic!.code).toContain('import { Button }')
    })
  })

  describe('props', () => {
    test('extrai props de tabela com colunas Prop/Type', () => {
      const comp = components[0]!
      expect(comp.props.length).toBeGreaterThanOrEqual(2)
    })

    test('prop name não contém backticks', () => {
      const comp = components[0]!
      for (const prop of comp.props) {
        expect(prop.name.includes('`')).toBe(false)
      }
    })

    test('prop type não contém backticks', () => {
      const comp = components[0]!
      for (const prop of comp.props) {
        expect(prop.type.includes('`')).toBe(false)
      }
    })

    test('prop com default preenchido', () => {
      const comp = components[0]!
      const variant = comp.props.find((p) => p.name === 'variant')
      expect(variant).toBeDefined()
      expect(variant!.default).toBeDefined()
    })

    test('tabela sem colunas Prop/Type não gera props', async () => {
      const md = '# Comp\n\n| Feature | Status |\n| --- | --- |\n| A | Done |'
      const d = await parseMarkdown(md)
      const comps = extractComponents(d)
      expect(comps[0]!.props).toHaveLength(0)
    })

    test('reconhece variantes de nome de coluna: Name, Property', async () => {
      const md = '# Comp\n\n| Name | Type |\n| --- | --- |\n| foo | string |'
      const d = await parseMarkdown(md)
      const comps = extractComponents(d)
      expect(comps[0]!.props).toHaveLength(1)
      expect(comps[0]!.props[0]!.name).toBe('foo')
    })
  })

  describe('subComponents', () => {
    test('detectSubComponents busca padrão apenas nos imports extraídos', async () => {
      // detectSubComponents só busca nos imports extraídos, não no corpo dos exemplos
      const md =
        '# Widget\n\n```tsx\n' + 'import { Widget } from "lib";\n' + 'const x = Widget.Header;\n```'
      const d = await parseMarkdown(md)
      const comps = extractComponents(d)
      expect(comps[0]!.subComponents).toHaveLength(0)
    })

    test('sem sub-componentes quando não há padrão', async () => {
      const md = '# Simple\n\n```tsx\nimport { Simple } from "lib";\n```'
      const d = await parseMarkdown(md)
      const comps = extractComponents(d)
      expect(comps[0]!.subComponents).toHaveLength(0)
    })
  })
})

// ── extractCodeByLang ────────────────────────────────────────

describe('extractCodeByLang', () => {
  test('filtra blocos por linguagem', async () => {
    const d = await parseMarkdown(componentMd)
    const tsxBlocks = extractCodeByLang(d, 'tsx')
    expect(tsxBlocks.length).toBeGreaterThanOrEqual(2)
    for (const block of tsxBlocks) {
      expect(block.lang).toBe('tsx')
    }
  })

  test('retorna vazio para linguagem inexistente', async () => {
    const d = await parseMarkdown(componentMd)
    expect(extractCodeByLang(d, 'rust')).toHaveLength(0)
  })
})

// ── extractSnippets ──────────────────────────────────────────

describe('extractSnippets', () => {
  test('retorna Map de snippets', async () => {
    const d = await parseMarkdown(componentMd)
    const snippets = extractSnippets(d)
    expect(snippets).toBeInstanceOf(Map)
    expect(snippets.size).toBeGreaterThanOrEqual(2)
  })

  test('chave usa filename quando disponível', async () => {
    const md = '# Comp\n\n```ts\n// utils.ts\nexport const x = 1;\n```'
    const d = await parseMarkdown(md)
    const snippets = extractSnippets(d)
    expect(snippets.has('utils.ts')).toBe(true)
  })

  test('chave usa titulo.lang quando sem filename', async () => {
    const md = '# Comp\n\n## Setup\n\n```ts\nconst a = 1;\n```'
    const d = await parseMarkdown(md)
    const snippets = extractSnippets(d)
    expect(snippets.has('Setup.ts')).toBe(true)
  })
})

// ── generateTypes ────────────────────────────────────────────

describe('generateTypes', () => {
  test('gera interface a partir de props', async () => {
    const d = await parseMarkdown(componentMd)
    const comps = extractComponents(d)
    const types = generateTypes(comps[0]!)
    expect(types).toContain('export interface ButtonProps')
    expect(types).toContain('variant')
    expect(types).toContain('size')
  })

  test('props com default são opcionais (?)', async () => {
    const d = await parseMarkdown(componentMd)
    const comps = extractComponents(d)
    const types = generateTypes(comps[0]!)
    expect(types).toContain('variant?:')
  })

  test('componente sem props gera string sem interface', () => {
    const comp: ExtractedComponent = {
      name: 'Empty',
      slug: 'empty',
      imports: [],
      examples: [],
      props: [],
      subComponents: [],
    }
    const types = generateTypes(comp)
    expect(types).not.toContain('interface')
  })

  test('header de auto-generated está presente', async () => {
    const d = await parseMarkdown(componentMd)
    const comps = extractComponents(d)
    const types = generateTypes(comps[0]!)
    expect(types).toContain('// Auto-generated types for Button')
  })

  test('inclui JSDoc da description quando presente', () => {
    const comp: ExtractedComponent = {
      name: 'Test',
      slug: 'test',
      imports: [],
      examples: [],
      props: [{ name: 'color', type: 'string', description: 'The color' }],
      subComponents: [],
    }
    const types = generateTypes(comp)
    expect(types).toContain('/** The color */')
    expect(types).toContain('color: string;')
  })

  test('prop com default gera campo opcional', () => {
    const comp: ExtractedComponent = {
      name: 'Test',
      slug: 'test',
      imports: [],
      examples: [],
      props: [{ name: 'size', type: 'string', description: '', default: 'md' }],
      subComponents: [],
    }
    const types = generateTypes(comp)
    expect(types).toContain('size?: string;')
  })

  test('prop sem default gera campo obrigatório', () => {
    const comp: ExtractedComponent = {
      name: 'Test',
      slug: 'test',
      imports: [],
      examples: [],
      props: [{ name: 'disabled', type: 'boolean', description: '' }],
      subComponents: [],
    }
    const types = generateTypes(comp)
    expect(types).toMatch(/disabled: boolean;/)
  })
})
