/**
 * Pure string helpers for Markdown that both main and renderer can use.
 * No DOM, no Node APIs.
 */

const FENCE_RE = /^\s{0,3}(`{3,}|~{3,})/
const HEADING_RE = /^\s{0,3}#{1,6}(\s|$)/
const HR_RE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/
const SETEXT_RE = /^\s{0,3}(=+|-+)\s*$/
const LIST_RE = /^\s*([-+*]|\d{1,9}[.)])\s/
const QUOTE_RE = /^\s*>/
const TABLE_RE = /^\s*\|/
const HTML_BLOCK_RE = /^\s{0,3}<\/?[A-Za-z][\w-]*[\s>/]/
const HARD_BREAK_END_RE = /( {2,}|\\)$/

function isBlockStart(line: string): boolean {
  return (
    HEADING_RE.test(line) ||
    HR_RE.test(line) ||
    SETEXT_RE.test(line) ||
    LIST_RE.test(line) ||
    QUOTE_RE.test(line) ||
    TABLE_RE.test(line) ||
    FENCE_RE.test(line) ||
    HTML_BLOCK_RE.test(line)
  )
}

function cannotAbsorb(line: string): boolean {
  return (
    HEADING_RE.test(line) ||
    HR_RE.test(line) ||
    TABLE_RE.test(line) ||
    FENCE_RE.test(line) ||
    HTML_BLOCK_RE.test(line)
  )
}

/**
 * Join hard-wrapped source lines into single-line paragraphs, so a WYSIWYG
 * editor shows real paragraphs instead of ragged line breaks. Fenced code,
 * tables, headings and list/quote markers are left alone. Lines ending in two
 * spaces or a backslash (explicit hard breaks) are kept.
 */
export function unwrapSoftBreaks(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  let fence: string | null = null

  for (const raw of lines) {
    const fenceMatch = raw.match(FENCE_RE)
    if (fence) {
      out.push(raw)
      if (fenceMatch && fenceMatch[1][0] === fence[0] && fenceMatch[1].length >= fence.length)
        fence = null
      continue
    }
    if (fenceMatch) {
      fence = fenceMatch[1]
      out.push(raw)
      continue
    }

    const prev = out.length ? out[out.length - 1] : null
    const canJoin =
      prev !== null &&
      prev.trim() !== '' &&
      raw.trim() !== '' &&
      !cannotAbsorb(prev) &&
      !isBlockStart(raw) &&
      !HARD_BREAK_END_RE.test(prev) &&
      !(prev.trim().endsWith('|') && TABLE_RE.test(prev))

    if (canJoin) {
      const isQuote = QUOTE_RE.test(prev)
      const next = isQuote ? raw.replace(/^\s*>\s?/, '').trim() : raw.trim()
      out[out.length - 1] = prev.replace(/\s+$/, '') + ' ' + next
      continue
    }
    // Two adjacent quote lines: join them too (lazy continuation is handled above).
    if (
      prev !== null &&
      QUOTE_RE.test(prev) &&
      QUOTE_RE.test(raw) &&
      prev.replace(/^\s*>\s?/, '').trim() !== '' &&
      raw.replace(/^\s*>\s?/, '').trim() !== '' &&
      !HARD_BREAK_END_RE.test(prev) &&
      !isBlockStart(raw.replace(/^\s*>\s?/, ''))
    ) {
      out[out.length - 1] = prev.replace(/\s+$/, '') + ' ' + raw.replace(/^\s*>\s?/, '').trim()
      continue
    }
    out.push(raw)
  }
  return out.join('\n')
}

/**
 * Trim trailing whitespace, collapse runs of blank lines to one (outside
 * fenced code), and end with exactly one newline. Empty input stays empty.
 */
export function normalizeMarkdown(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  let fence: string | null = null
  let blank = 0
  for (const raw of lines) {
    const fenceMatch = raw.match(FENCE_RE)
    if (fence) {
      out.push(raw.replace(/[ \t]+$/, ''))
      if (fenceMatch && fenceMatch[1][0] === fence[0] && fenceMatch[1].length >= fence.length)
        fence = null
      continue
    }
    const line = raw.replace(/[ \t]+$/, '')
    if (fenceMatch) {
      fence = fenceMatch[1]
      blank = 0
      out.push(line)
      continue
    }
    if (line === '') {
      blank++
      if (blank > 1) continue
    } else {
      blank = 0
    }
    out.push(line)
  }
  const joined = out.join('\n').replace(/^\n+/, '').replace(/\n+$/, '')
  return joined ? joined + '\n' : ''
}

/** Inline HTML tags the editor understands. Anything else is literal text. */
export const KNOWN_INLINE_HTML = new Set([
  'b',
  'strong',
  'i',
  'em',
  'u',
  's',
  'del',
  'strike',
  'code',
  'a',
  'br',
  'span',
  'sub',
  'sup',
  'kbd',
  'mark',
  'p',
  'div',
  'pre',
  'ul',
  'ol',
  'li',
  'blockquote',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'table',
  'thead',
  'tbody',
  'tr',
  'td',
  'th',
  'img'
])

const KNOWN_TAG_RE = new RegExp(`^<\\/?(${[...KNOWN_INLINE_HTML].join('|')})(\\s|>|/)`, 'i')

function isLeftFlanking(text: string, i: number): boolean {
  const next = text[i + 1]
  return next !== undefined && !/\s/.test(next)
}
function isRightFlanking(text: string, i: number): boolean {
  const prev = text[i - 1]
  return prev !== undefined && !/\s/.test(prev)
}

function escapeDelimiter(text: string, ch: '*' | '_'): string {
  const positions: number[] = []
  for (let i = 0; i < text.length; i++) if (text[i] === ch) positions.push(i)
  if (positions.length < 2) return text
  const candidates = positions.filter((i) => {
    if (ch === '_') {
      const prev = text[i - 1]
      const next = text[i + 1]
      const intraword =
        prev !== undefined &&
        next !== undefined &&
        /[\p{L}\p{N}]/u.test(prev) &&
        /[\p{L}\p{N}]/u.test(next)
      if (intraword) return false
    }
    return isLeftFlanking(text, i) || isRightFlanking(text, i)
  })
  const hasOpener = candidates.some((i) => isLeftFlanking(text, i))
  const hasCloser = candidates.some((i) => isRightFlanking(text, i))
  if (!hasOpener || !hasCloser) return text
  const set = new Set(candidates)
  let out = ''
  for (let i = 0; i < text.length; i++) out += set.has(i) ? '\\' + text[i] : text[i]
  return out
}

/**
 * Backslash-escape only what would change meaning when the Markdown is
 * parsed again. Far lighter than escaping every special character, so the
 * exported SKILL.md stays readable: `Bash(git *)` and `C:\Users` survive.
 */
export function escapeMarkdownText(text: string, atParagraphStart: boolean): string {
  let t = text
  // Backslash only matters before ASCII punctuation.
  t = t.replace(/\\(?=[!-/:-@[-`{-~])/g, '\\\\')
  // Backticks always open code.
  t = t.replace(/`/g, '\\`')
  // Emphasis delimiters only when they could pair up.
  t = escapeDelimiter(t, '*')
  t = escapeDelimiter(t, '_')
  // Strikethrough.
  t = t.replace(/~~/g, '\\~\\~')
  // Links: [text](url) or [text][ref].
  t = t.replace(/\[([^\]\n]*)\](?=\s*[([])/g, '\\[$1\\]')
  // Entities: keep a literal ampersand from being decoded.
  t = t.replace(/&(?=#?\w+;)/g, '&amp;')
  // Real HTML tags must not be re-parsed as HTML; placeholders like <arg> stay literal.
  t = t.replace(/<(?=\/?[A-Za-z])/g, (m, offset: number) =>
    KNOWN_TAG_RE.test(t.slice(offset)) ? '&lt;' : m
  )
  if (atParagraphStart) {
    t = t
      .replace(/^(\s{0,3})(#{1,6})(?=\s|$)/, '$1\\$2')
      .replace(/^(\s{0,3})>/, '$1\\>')
      .replace(/^(\s{0,3})([-+*])(?=\s)/, '$1\\$2')
      .replace(/^(\s{0,3})(\d{1,9})([.)])(?=\s)/, '$1$2\\$3')
      .replace(/^(\s{0,3})([-*_])(\s*\2){2,}\s*$/, (m: string) =>
        m.replace(/[-*_]/, (c) => '\\' + c)
      )
      .replace(/^(\s{0,3})\|/, '$1\\|')
  }
  return t
}
