import type { Editor, JSONContent } from '@tiptap/core'
import {
  KNOWN_INLINE_HTML,
  escapeMarkdownText,
  normalizeMarkdown,
  unwrapSoftBreaks
} from '@shared/markdown-text'

interface JsonNode {
  type?: string
  text?: string
  marks?: Array<{ type: string } | string>
  content?: JsonNode[]
}

/** The parts of the MarkdownManager we reach into. All exist on the instance. */
interface ManagerInternals {
  codeTypes: Set<string>
  isUnrecognizedHtml: (html: string) => boolean
  encodeTextForMarkdown: (text: string, node: JsonNode, parent?: JsonNode) => string
  parse: (markdown: string) => JSONContent
  tokenizeInline: (text: string) => unknown[]
  parseInlineTokens: (tokens: unknown[]) => JsonNode[]
}

function manager(editor: Editor): ManagerInternals | undefined {
  return editor.markdown as unknown as ManagerInternals | undefined
}

/**
 * The official Markdown extension escapes aggressively and entity-encodes
 * angle brackets, which makes exported SKILL.md files ugly (`Bash(git \*)`)
 * and drops `<placeholder>` text. Override two manager methods on the
 * instance so parsing keeps unknown tags as literal text and serializing
 * escapes only what would change meaning.
 */
export function patchMarkdownManager(editor: Editor): void {
  const m = manager(editor)
  if (!m) return

  m.isUnrecognizedHtml = (html: string): boolean => {
    const tags = [...html.matchAll(/<\/?\s*([A-Za-z][\w-]*)/g)].map((x) => x[1].toLowerCase())
    if (!tags.length) return true
    return tags.some((t) => !KNOWN_INLINE_HTML.has(t))
  }

  m.encodeTextForMarkdown = (text: string, node: JsonNode, parent?: JsonNode): string => {
    const inCodeParent = parent?.type != null && m.codeTypes.has(parent.type)
    const inCodeMark = (node.marks || []).some((mk) =>
      m.codeTypes.has(typeof mk === 'string' ? mk : mk.type)
    )
    if (inCodeParent || inCodeMark) return text
    const atStart = !!parent?.content && parent.content[0] === node
    return escapeMarkdownText(text, atStart)
  }
}

const INLINE_TYPES = new Set(['text', 'hardBreak'])
const TEXTBLOCK_TYPES = new Set(['paragraph', 'heading', 'codeBlock'])

/**
 * Repair quirks in the parsed document:
 * - After a code block or nested list inside a list item, the parser leaves
 *   the following text as a raw text node directly inside the item. Wrap it
 *   in a paragraph and run the inline tokenizer so escapes and code spans work.
 * - Text nodes outside code that still contain newlines are soft-wrapped
 *   source lines; collapse them to spaces so the page shows real paragraphs.
 */
function repairParsed(node: JsonNode, m: ManagerInternals, inCode: boolean): void {
  if (!node.content) return
  const isCode = inCode || node.type === 'codeBlock'
  const isTextblock = TEXTBLOCK_TYPES.has(node.type || '')

  if (!isTextblock && node.type !== 'doc' && node.content.some((c) => INLINE_TYPES.has(c.type || ''))) {
    const fixed: JsonNode[] = []
    for (const child of node.content) {
      if (child.type === 'text') {
        const raw = child.text || ''
        let inline: JsonNode[]
        try {
          inline = m.parseInlineTokens(m.tokenizeInline(raw))
        } catch {
          inline = [{ type: 'text', text: raw }]
        }
        fixed.push({ type: 'paragraph', content: inline })
      } else if (child.type === 'hardBreak') {
        // drop stray breaks between blocks
      } else {
        fixed.push(child)
      }
    }
    node.content = fixed
  }

  for (const child of node.content) {
    if (child.type === 'text' && !isCode && child.text && child.text.includes('\n')) {
      child.text = child.text.replace(/\n[ \t]*/g, ' ')
    }
    repairParsed(child, m, isCode)
  }
}

/** Load Markdown into the editor without marking the document dirty. */
export function loadMarkdown(editor: Editor, markdown: string): void {
  const m = manager(editor)
  const prepared = unwrapSoftBreaks(markdown)
  if (!m) {
    editor.commands.setContent(prepared, { contentType: 'markdown', emitUpdate: false })
    return
  }
  const json = m.parse(prepared) as JsonNode
  repairParsed(json, m, false)
  editor.commands.setContent(json as JSONContent, { emitUpdate: false })
}

/** Serialize the editor to clean Markdown for SKILL.md. */
export function toMarkdown(editor: Editor): string {
  return normalizeMarkdown(editor.getMarkdown())
}
