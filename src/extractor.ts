/**
 * Code Extractor - Extrai e organiza código de documentação
 */

import { type ParsedDoc, type CodeSection, type HeadingSection } from './parser'

export interface ExtractedComponent {
  name: string
  slug: string
  imports: string[]
  examples: CodeExample[]
  props: PropDefinition[]
  subComponents: string[]
}

export interface CodeExample {
  title: string
  lang: string
  code: string
  filename?: string
}

export interface PropDefinition {
  name: string
  type: string
  description: string
  default?: string
}

/**
 * Extrai componentes de uma doc parseada
 */
export function extractComponents(doc: ParsedDoc): ExtractedComponent[] {
  const components: ExtractedComponent[] = []
  const { headings, codeBlocks, tables } = doc

  // Encontra o componente principal (primeiro H1)
  const mainHeading = headings.find((h) => h.level === 1)
  if (!mainHeading) return components

  const componentName = mainHeading.text.replace(/\s+/g, '')

  // Extrai imports dos code blocks
  const imports = extractImports(codeBlocks)

  // Extrai exemplos agrupados por heading
  const examples = extractExamples(headings, codeBlocks)

  // Extrai props de tabelas
  const props = extractProps(tables)

  // Detecta sub-componentes nos imports
  const subComponents = detectSubComponents(imports, componentName)

  components.push({
    name: componentName,
    slug: mainHeading.slug,
    imports,
    examples,
    props,
    subComponents,
  })

  return components
}

function extractImports(codeBlocks: CodeSection[]): string[] {
  const imports = new Set<string>()

  for (const block of codeBlocks) {
    if (block.lang === 'tsx' || block.lang === 'ts' || block.lang === 'jsx') {
      const importMatches = block.code.matchAll(/import\s+\{([^}]+)\}\s+from\s+["']([^"']+)["']/g)
      for (const match of importMatches) {
        imports.add(`import { ${match[1]!.trim()} } from "${match[2]}";`)
      }
    }
  }

  return [...imports]
}

function extractExamples(headings: HeadingSection[], codeBlocks: CodeSection[]): CodeExample[] {
  const examples: CodeExample[] = []
  let currentHeading = 'Example'

  // Mapeia headings por índice
  const headingMap = new Map<number, string>()
  for (const h of headings) {
    headingMap.set(h.idx, h.text)
  }

  for (const block of codeBlocks) {
    // Encontra o heading mais próximo anterior
    for (let i = block.idx - 1; i >= 0; i--) {
      if (headingMap.has(i)) {
        currentHeading = headingMap.get(i)!
        break
      }
    }

    // Só inclui TypeScript/JavaScript
    if (['tsx', 'ts', 'jsx', 'js'].includes(block.lang)) {
      examples.push({
        title: currentHeading,
        lang: block.lang,
        code: block.code,
        filename: block.filename,
      })
    }
  }

  return examples
}

function extractProps(
  tables: { headers: string[]; rows: Record<string, string>[] }[],
): PropDefinition[] {
  const props: PropDefinition[] = []

  for (const table of tables) {
    // Detecta tabela de props (tem colunas como "Prop", "Type", "Default")
    const hasName = table.headers.some((h) =>
      ['prop', 'name', 'property'].includes(h.toLowerCase()),
    )
    const hasType = table.headers.some((h) => ['type'].includes(h.toLowerCase()))

    if (hasName && hasType) {
      for (const row of table.rows) {
        const name = row['Prop'] || row['Name'] || row['Property'] || row['prop'] || ''
        const type = row['Type'] || row['type'] || ''
        const description = row['Description'] || row['description'] || row['Desc'] || ''
        const defaultVal = row['Default'] || row['default'] || ''

        if (name) {
          props.push({
            name: name.replace(/`/g, ''),
            type: type.replace(/`/g, ''),
            description,
            default: defaultVal || undefined,
          })
        }
      }
    }
  }

  return props
}

function detectSubComponents(imports: string[], mainComponent: string): string[] {
  const subs = new Set<string>()

  for (const imp of imports) {
    // Match: Component.SubComponent pattern
    const pattern = new RegExp(`${mainComponent}\\.(\\w+)`, 'g')
    const matches = imp.matchAll(pattern)
    for (const match of matches) {
      subs.add(match[1]!)
    }
  }

  return [...subs]
}

/**
 * Extrai todos os code blocks de uma linguagem específica
 */
export function extractCodeByLang(doc: ParsedDoc, lang: string): CodeSection[] {
  return doc.byLang(lang)
}

/**
 * Extrai snippets prontos pra uso
 */
export function extractSnippets(doc: ParsedDoc): Map<string, string> {
  const snippets = new Map<string, string>()
  const examples = extractExamples(doc.headings, doc.codeBlocks)

  for (const example of examples) {
    const key = example.filename || `${example.title}.${example.lang}`
    snippets.set(key, example.code)
  }

  return snippets
}

/**
 * Gera arquivo de tipos a partir das props extraídas
 */
export function generateTypes(component: ExtractedComponent): string {
  const lines: string[] = [`// Auto-generated types for ${component.name}`, '']

  if (component.props.length > 0) {
    lines.push(`export interface ${component.name}Props {`)
    for (const prop of component.props) {
      const optional = prop.default !== undefined ? '?' : ''
      const comment = prop.description ? `  /** ${prop.description} */` : ''
      if (comment) lines.push(comment)
      lines.push(`  ${prop.name}${optional}: ${prop.type};`)
    }
    lines.push('}')
  }

  return lines.join('\n')
}
