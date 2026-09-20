// Minimal wikitext template parser for this wiki's flat `{{Name|key=value|...}}` style.
// Not a general MediaWiki parser: no conditionals or loops, just nested templates as param values.

export interface Template { name: string; params: Record<string, string> }
export interface TemplateBlock extends Template { start: number; end: number }

function splitTopLevel(str: string, sep: string): string[] {
  const parts: string[] = []
  let brace = 0
  let bracket = 0
  let cur = ''
  for (let i = 0; i < str.length; i++) {
    const two = str.slice(i, i + 2)
    if (two === '{{') { brace++; cur += two; i++; continue }
    if (two === '}}') { brace--; cur += two; i++; continue }
    if (two === '[[') { bracket++; cur += two; i++; continue }
    if (two === ']]') { bracket--; cur += two; i++; continue }
    if (str[i] === sep && brace === 0 && bracket === 0) { parts.push(cur); cur = ''; continue }
    cur += str[i]
  }
  parts.push(cur)
  return parts
}

function findTopLevelEquals(str: string): number {
  let brace = 0
  let bracket = 0
  for (let i = 0; i < str.length; i++) {
    const two = str.slice(i, i + 2)
    if (two === '{{') { brace++; i++; continue }
    if (two === '}}') { brace--; i++; continue }
    if (two === '[[') { bracket++; i++; continue }
    if (two === ']]') { bracket--; i++; continue }
    if (str[i] === '=' && brace === 0 && bracket === 0) return i
  }
  return -1
}

/** End index (exclusive) of the balanced `{{...}}` starting at `start`, or -1. */
function findTemplateEnd(str: string, start: number): number {
  let depth = 0
  for (let i = start; i < str.length - 1; i++) {
    const two = str.slice(i, i + 2)
    if (two === '{{') { depth++; i++; continue }
    if (two === '}}') { depth--; i++; if (depth === 0) return i + 1; continue }
  }
  return -1
}

function parseInner(inner: string): Template {
  const parts = splitTopLevel(inner, '|')
  const name = parts[0].trim()
  const params: Record<string, string> = {}
  let positional = 1
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]
    const eq = findTopLevelEquals(part)
    if (eq === -1) params[String(positional++)] = part.trim()
    else params[part.slice(0, eq).trim()] = part.slice(eq + 1).trim()
  }
  return { name, params }
}

/** Parses one `{{Name|k=v|...}}` block. Trailing text after the closing braces is ignored. */
export function parseTemplate(wikitext: string): Template | null {
  const trimmed = wikitext.trim()
  if (!trimmed.startsWith('{{')) return null
  const end = findTemplateEnd(trimmed, 0)
  if (end === -1) return null
  return parseInner(trimmed.slice(2, end - 2))
}

/** Every block named one of `names` (exact, or `name/...`), in document order, skipping each block's interior. */
export function findTemplateBlocks(wikitext: string, names: string[]): TemplateBlock[] {
  const blocks: TemplateBlock[] = []
  let i = 0
  while (i < wikitext.length - 1) {
    if (wikitext.slice(i, i + 2) !== '{{') { i++; continue }
    const nameMatch = /^\{\{([^|{}\n]+)/.exec(wikitext.slice(i, i + 80))
    const name = nameMatch ? nameMatch[1].trim() : ''
    const wanted = names.some(n => name === n || name.startsWith(n + '/'))
    if (!wanted) { i += 2; continue }
    const end = findTemplateEnd(wikitext, i)
    if (end === -1) break
    const t = parseInner(wikitext.slice(i + 2, end - 2))
    // Use the pre-matched name, not t.name: a comment between the template name and its
    // first `|` (e.g. `{{ABPage\n<!--General Info-->\n|...}}`) would otherwise leak into it.
    blocks.push({ ...t, name, start: i, end })
    i = end
  }
  return blocks
}

/** Flattens inline templates, links, bold markup, and html down to readable text. */
export function cleanText(text: string | undefined): string {
  if (text == null) return ''
  let out = text
  out = out.replace(/\{\{SkillCon\|([^}|]+)\}\}/g, '[$1]')
  out = out.replace(/\{\{StatusEffect\|([^}|]+)(\|[^}]*)?\}\}/g, '$1')
  out = out.replace(/\{\{Keyword\|([^}|]+)(\|[^}]*)?\}\}/g, '$1')
  out = out.replace(/\{\{Icons\|[^}]*\}\}/g, '')
  out = out.replace(/\{\{SkillHint\|([^}]*)\}\}/g, '$1')
  out = out.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
  out = out.replace(/\[\[([^\]]+)\]\]/g, '$1')
  out = out.replace(/'''/g, '').replace(/''/g, '')
  out = out.replace(/<br\s*\/?>/gi, '\n')
  out = out.replace(/<\/?[a-zA-Z][^>]*>/g, '')
  out = out.replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n').replace(/[ \t]{2,}/g, ' ')
  return out.trim()
}
