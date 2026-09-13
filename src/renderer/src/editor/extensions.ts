import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { OrderedList } from '@tiptap/extension-list'
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table'
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import Underline from '@tiptap/extension-underline'
import { Placeholder, CharacterCount } from '@tiptap/extensions'
import { createLowlight } from 'lowlight'
import bash from 'highlight.js/lib/languages/bash'
import diff from 'highlight.js/lib/languages/diff'
import ini from 'highlight.js/lib/languages/ini'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import markdown from 'highlight.js/lib/languages/markdown'
import plaintext from 'highlight.js/lib/languages/plaintext'
import powershell from 'highlight.js/lib/languages/powershell'
import python from 'highlight.js/lib/languages/python'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'
import type { AnyExtension } from '@tiptap/core'

/**
 * `lowlight`'s `common` set pulls in 35 grammars (most of the renderer bundle).
 * Skills only ever fence these, so register them by hand and keep startup quick.
 */
const lowlight = createLowlight({
  bash,
  diff,
  ini,
  javascript,
  json,
  markdown,
  plaintext,
  powershell,
  python,
  typescript,
  xml,
  yaml
})

/** Underline has no Markdown syntax; emit inline HTML so it survives a round trip. */
const UnderlineHtml = Underline.extend({
  renderMarkdown: (node, h) => `<u>${h.renderChildren(node)}</u>`
})

/**
 * The stock ordered-list tokenizer computes the content column as
 * `indent + digits + 1`, forgetting the "." or ")" separator. Continuation
 * lines (code fences, paragraphs) therefore keep one stray space, and every
 * save pushes nested content one column to the right. Shift those lines left
 * by one before handing them to the original tokenizer, then restore the raw
 * span so marked consumes the right number of characters.
 */
const ORDERED_ITEM_RE = /^\s*(\d{1,9}|[A-Za-z])[.)]\s/
type Tokenizer = {
  name: string
  level: 'block' | 'inline'
  tokenize: (src: string, tokens: unknown, lexer: unknown) => { raw: string } | undefined
} & Record<string, unknown>

const originalTokenizer = (OrderedList.config as { markdownTokenizer?: Tokenizer })
  .markdownTokenizer

const OrderedListFixed = originalTokenizer
  ? OrderedList.extend({
      markdownTokenizer: {
        ...originalTokenizer,
        tokenize(src: string, tokens: unknown, lexer: unknown) {
          const first = originalTokenizer.tokenize(src, tokens, lexer)
          if (!first) return first
          const lines = src.split('\n')
          const n = first.raw.split('\n').length
          const shifted = lines.map((l, i) => {
            if (i >= n) return l
            if (!l.trim() || ORDERED_ITEM_RE.test(l) || !/^\s/.test(l)) return l
            return l.slice(1)
          })
          const fixed = originalTokenizer.tokenize(shifted.join('\n'), tokens, lexer)
          if (!fixed) return first
          const consumed = fixed.raw.split('\n').length
          fixed.raw = lines.slice(0, consumed).join('\n')
          return fixed
        }
      }
    })
  : OrderedList

export function buildExtensions(
  placeholder = 'Start writing your skill instructions…'
): AnyExtension[] {
  return [
    StarterKit.configure({
      codeBlock: false,
      underline: false,
      orderedList: false,
      link: { openOnClick: false, autolink: true, linkOnPaste: true }
    }),
    OrderedListFixed,
    UnderlineHtml,
    CodeBlockLowlight.configure({ lowlight, defaultLanguage: null }),
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    Placeholder.configure({ placeholder }),
    CharacterCount,
    Markdown.configure({ indentation: { style: 'space', size: 2 } })
  ]
}
