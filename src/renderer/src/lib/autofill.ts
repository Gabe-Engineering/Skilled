import { toKebabCase } from '@shared/kebab'

const FENCE_RE = /^\s{0,3}(`{3,}|~{3,})/

/** First H1 text, else first heading of any level, else first non-empty line. */
export function deriveTitle(body: string): string {
  const lines = body.split('\n')
  let fence = false
  let firstHeading = ''
  let firstLine = ''
  for (const raw of lines) {
    if (FENCE_RE.test(raw)) {
      fence = !fence
      continue
    }
    if (fence) continue
    const line = raw.trim()
    if (!line) continue
    const h1 = line.match(/^#\s+(.+?)\s*#*$/)
    if (h1) return h1[1]
    const h = line.match(/^#{2,6}\s+(.+?)\s*#*$/)
    if (h && !firstHeading) firstHeading = h[1]
    if (!firstLine && !h) firstLine = line
  }
  return firstHeading || firstLine
}

const MAX_DERIVED_WORDS = 5

export function deriveName(body: string): string {
  const title = deriveTitle(body)
  const isHeading = /^\s{0,3}#{1,6}\s/m.test(body)
  let source = stripInlineMarkdown(title)
  if (!isHeading) {
    // A plain first line is a sentence, not a title: keep it short.
    source = source.split(/[.!?:;,]/)[0].split(/\s+/).slice(0, MAX_DERIVED_WORDS).join(' ')
  }
  const name = toKebabCase(source)
  return name || 'untitled-skill'
}

function stripInlineMarkdown(s: string): string {
  return s
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]*)\*\*/g, '$1')
    .replace(/\*([^*]*)\*/g, '$1')
    .replace(/__([^_]*)__/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .trim()
}

/** First plain paragraph (not heading, list, quote, code, table), cut at a sentence end near 300 chars. */
export function deriveDescription(body: string): string {
  const lines = body.split('\n')
  let fence = false
  for (const raw of lines) {
    if (FENCE_RE.test(raw)) {
      fence = !fence
      continue
    }
    if (fence) continue
    const line = raw.trim()
    if (!line) continue
    if (/^(#{1,6}\s|[-+*]\s|\d+[.)]\s|>|\||---|\*\*\*|___)/.test(line)) continue
    const text = stripInlineMarkdown(line).replace(/\s+/g, ' ')
    if (!text) continue
    if (text.length <= 300) return text
    const cut = text.slice(0, 300)
    const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '))
    return end > 80 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, '') + '…'
  }
  return ''
}
