/**
 * Markdown Parser - Extrai seções estruturadas de documentação
 * 100% Bun - usa Bun.markdown + HTMLRewriter
 */

export type SectionType = 'heading' | 'code' | 'table' | 'content' | 'list'

interface BaseSection {
  idx: number
  type: SectionType
  raw: string
}

export interface HeadingSection extends BaseSection {
  type: 'heading'
  level: number
  text: string
  slug: string
}

export interface CodeSection extends BaseSection {
  type: 'code'
  lang: string
  code: string
  filename?: string
}

export interface TableSection extends BaseSection {
  type: 'table'
  headers: string[]
  rows: Record<string, string>[]
}

export interface ListSection extends BaseSection {
  type: 'list'
  ordered: boolean
  items: string[]
}

export interface ContentSection extends BaseSection {
  type: 'content'
  text: string
}

export type Section = HeadingSection | CodeSection | TableSection | ListSection | ContentSection

export interface ParsedDoc {
  source: string
  title: string
  sections: Section[]
  headings: HeadingSection[]
  codeBlocks: CodeSection[]
  tables: TableSection[]
  total: number
  byType: <T extends SectionType>(type: T) => Extract<Section, { type: T }>[]
  byLang: (lang: string) => CodeSection[]
  search: (query: string) => Section[]
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function parseMarkdown(content: string, source = 'unknown'): Promise<ParsedDoc> {
  const html = Bun.markdown.html(content)
  const sections: Section[] = []
  let idx = 0

  // State
  let currentHeading: { level: number; text: string } | null = null
  let currentCode: { lang: string; code: string } | null = null
  let currentTable: { headers: string[]; rows: string[][] } | null = null
  let currentList: { ordered: boolean; items: string[] } | null = null
  let currentRow: string[] = []
  let currentListItem = ''
  let inThead = false
  let cellIndex = 0

  const rewriter = new HTMLRewriter()
    // Headings
    .on('h1, h2, h3, h4, h5, h6', {
      element(el) {
        const level = parseInt(el.tagName[1] ?? '1')
        currentHeading = { level, text: '' }
        el.onEndTag(() => {
          if (currentHeading) {
            const text = currentHeading.text.trim()
            sections.push({
              idx: idx++,
              type: 'heading',
              level: currentHeading.level,
              text,
              slug: slugify(text),
              raw: `${'#'.repeat(currentHeading.level)} ${text}`,
            })
            currentHeading = null
          }
        })
      },
      text(chunk) {
        if (currentHeading) {
          currentHeading.text += chunk.text
        }
      },
    })
    // Code blocks
    .on('pre > code', {
      element(el) {
        const className = el.getAttribute('class') ?? ''
        const match = className.match(/language-(\w+)/)
        currentCode = { lang: match?.[1] ?? 'text', code: '' }
      },
      text(chunk) {
        if (currentCode) {
          currentCode.code += chunk.text
        }
      },
    })
    .on('pre', {
      element(el) {
        el.onEndTag(() => {
          if (currentCode) {
            const code = currentCode.code.trim()
            // Detect filename from first line comment
            const filenameMatch = code.match(/^\/\/\s*(.+\.\w+)\s*\n|^#\s*(.+\.\w+)\s*\n/)
            sections.push({
              idx: idx++,
              type: 'code',
              lang: currentCode.lang,
              code,
              filename: filenameMatch?.[1] ?? filenameMatch?.[2],
              raw: '```' + currentCode.lang + '\n' + code + '\n```',
            })
            currentCode = null
          }
        })
      },
    })
    // Tables
    .on('table', {
      element(el) {
        currentTable = { headers: [], rows: [] }
        inThead = false
        el.onEndTag(() => {
          if (currentTable) {
            const rows = currentTable.rows.map((row) => {
              const obj: Record<string, string> = {}
              currentTable!.headers.forEach((h, i) => {
                obj[h] = row[i]?.trim() ?? ''
              })
              return obj
            })
            sections.push({
              idx: idx++,
              type: 'table',
              headers: currentTable.headers,
              rows,
              raw: formatTableMd(currentTable.headers, currentTable.rows),
            })
            currentTable = null
          }
        })
      },
    })
    .on('thead', {
      element() {
        inThead = true
      },
    })
    .on('tbody', {
      element() {
        inThead = false
      },
    })
    .on('tr', {
      element(el) {
        currentRow = []
        cellIndex = 0
        el.onEndTag(() => {
          if (currentTable) {
            if (inThead || currentTable.headers.length === 0) {
              currentTable.headers = [...currentRow]
            } else {
              currentTable.rows.push([...currentRow])
            }
          }
        })
      },
    })
    .on('th, td', {
      text(chunk) {
        if (!currentRow[cellIndex]) currentRow[cellIndex] = ''
        currentRow[cellIndex] += chunk.text
        if (chunk.lastInTextNode) cellIndex++
      },
    })
    // Lists
    .on('ul, ol', {
      element(el) {
        currentList = { ordered: el.tagName === 'ol', items: [] }
        el.onEndTag(() => {
          if (currentList && currentList.items.length > 0) {
            sections.push({
              idx: idx++,
              type: 'list',
              ordered: currentList.ordered,
              items: currentList.items,
              raw: currentList.items
                .map((item, i) => (currentList!.ordered ? `${i + 1}. ${item}` : `- ${item}`))
                .join('\n'),
            })
            currentList = null
          }
        })
      },
    })
    .on('li', {
      element(el) {
        currentListItem = ''
        el.onEndTag(() => {
          if (currentList) {
            currentList.items.push(currentListItem.trim())
          }
        })
      },
      text(chunk) {
        currentListItem += chunk.text
      },
    })
    // Paragraphs
    .on('p', {
      element(el) {
        let text = ''
        el.onEndTag(() => {
          if (text.trim()) {
            sections.push({
              idx: idx++,
              type: 'content',
              text: text.trim(),
              raw: text.trim(),
            })
          }
        })
      },
      text(chunk) {
        // Handled in element
      },
    })

  await rewriter.transform(new Response(html)).text()

  // Extract typed sections
  const headings = sections.filter((s): s is HeadingSection => s.type === 'heading')
  const codeBlocks = sections.filter((s): s is CodeSection => s.type === 'code')
  const tables = sections.filter((s): s is TableSection => s.type === 'table')
  const title = headings.find((h) => h.level === 1)?.text ?? source

  return {
    source,
    title,
    sections,
    headings,
    codeBlocks,
    tables,
    total: sections.length,
    byType: <T extends SectionType>(type: T) =>
      sections.filter((s): s is Extract<Section, { type: T }> => s.type === type),
    byLang: (lang: string) => codeBlocks.filter((c) => c.lang === lang || c.lang.startsWith(lang)),
    search: (query: string) => {
      const q = query.toLowerCase()
      return sections.filter((s) => s.raw.toLowerCase().includes(q))
    },
  }
}

function formatTableMd(headers: string[], rows: string[][]): string {
  const header = `| ${headers.join(' | ')} |`
  const separator = `| ${headers.map(() => '---').join(' | ')} |`
  const body = rows.map((row) => `| ${row.join(' | ')} |`).join('\n')
  return [header, separator, body].join('\n')
}

// Fetch and parse from URL
export async function fetchDocs(url: string): Promise<ParsedDoc> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`)
  }
  const content = await res.text()
  return parseMarkdown(content, url)
}

// Parse local file
export async function parseFile(path: string): Promise<ParsedDoc> {
  const file = Bun.file(path)
  if (!(await file.exists())) {
    throw new Error(`File not found: ${path}`)
  }
  const content = await file.text()
  return parseMarkdown(content, path)
}
