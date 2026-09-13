import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { Editor } from '@tiptap/core'
import { describe, expect, it } from 'vitest'
import { buildExtensions } from '../src/renderer/src/editor/extensions'
import { loadMarkdown, patchMarkdownManager, toMarkdown } from '../src/renderer/src/editor/markdown'
import { parseSkillMd } from '../src/shared/frontmatter'
import { escapeMarkdownText, unwrapSoftBreaks } from '../src/shared/markdown-text'

function makeEditor(markdown: string): Editor {
  const editor = new Editor({
    element: document.createElement('div'),
    extensions: buildExtensions()
  })
  patchMarkdownManager(editor)
  loadMarkdown(editor, markdown)
  return editor
}

function roundTrip(md: string): string {
  const editor = makeEditor(md)
  const out = toMarkdown(editor)
  editor.destroy()
  return out
}

function plainText(md: string): string {
  const editor = makeEditor(md)
  const t = editor.getText()
  editor.destroy()
  return t
}

describe('unwrapSoftBreaks', () => {
  it('joins wrapped paragraph lines', () => {
    expect(unwrapSoftBreaks('one\ntwo\nthree')).toBe('one two three')
  })
  it('keeps block structure', () => {
    const src = '# H\n\n- a\n  cont\n- b\n\n> q1\n> q2\n\n```\nx\ny\n```\n\n| a |\n| - |\n| b |\n'
    expect(unwrapSoftBreaks(src)).toBe(
      '# H\n\n- a cont\n- b\n\n> q1 q2\n\n```\nx\ny\n```\n\n| a |\n| - |\n| b |\n'
    )
  })
  it('keeps explicit hard breaks and setext headings', () => {
    expect(unwrapSoftBreaks('a  \nb')).toBe('a  \nb')
    expect(unwrapSoftBreaks('Title\n---')).toBe('Title\n---')
  })
})

describe('escapeMarkdownText', () => {
  it('leaves harmless characters alone', () => {
    expect(escapeMarkdownText('Bash(git *)', false)).toBe('Bash(git *)')
    expect(escapeMarkdownText('C:\\Users\\me', false)).toBe('C:\\Users\\me')
    expect(escapeMarkdownText('snake_case_name', false)).toBe('snake_case_name')
    expect(escapeMarkdownText('[arg] and <required-arg>', false)).toBe('[arg] and <required-arg>')
    expect(escapeMarkdownText('5 * 3 = 15', false)).toBe('5 * 3 = 15')
  })
  it('escapes what would change meaning', () => {
    expect(escapeMarkdownText('a *b* c', false)).toBe('a \\*b\\* c')
    expect(escapeMarkdownText('`x`', false)).toBe('\\`x\\`')
    expect(escapeMarkdownText('[t](u)', false)).toBe('\\[t\\](u)')
    expect(escapeMarkdownText('<b>x</b>', false)).toBe('&lt;b>x&lt;/b>')
    expect(escapeMarkdownText('# not heading', true)).toBe('\\# not heading')
    expect(escapeMarkdownText('# not heading', false)).toBe('# not heading')
    expect(escapeMarkdownText('1. not list', true)).toBe('1\\. not list')
    expect(escapeMarkdownText('a \\* b', false)).toBe('a \\\\* b')
  })
})

describe('markdown round trip (features fixture)', () => {
  const src = readFileSync(join(__dirname, 'fixtures', 'features.md'), 'utf8')
  const out = roundTrip(src)

  it('keeps headings', () => {
    expect(out).toMatch(/^# Feature Coverage$/m)
    expect(out).toMatch(/^## Lists$/m)
  })
  it('keeps inline marks', () => {
    expect(out).toContain('**bold**')
    expect(out).toMatch(/[*_]italic[*_]/)
    expect(out).toContain('<u>underline</u>')
    expect(out).toContain('~~strike~~')
    expect(out).toContain('`inline code`')
  })
  it('keeps $ARGUMENTS and angle placeholders verbatim', () => {
    expect(out).toContain('`$ARGUMENTS`')
    expect(out).toContain('$ARGUMENTS again')
    expect(out).toContain('<required-arg>')
    expect(out).not.toContain('\\$ARGUMENTS')
    expect(out).not.toContain('&lt;')
  })
  it('keeps nested lists', () => {
    expect(out).toMatch(/^- First item$/m)
    expect(out).toMatch(/^ {2}- Nested item$/m)
    expect(out).toMatch(/^ {4}- Deep nested$/m)
    expect(out).toMatch(/^1\. Step one$/m)
    expect(out).toMatch(/^ {2,3}1\. Sub step$/m)
  })
  it('keeps fenced code with language', () => {
    expect(out).toContain('```python\ndef hello(name: str) -> str:\n    return f"hi {name}"\n```')
    expect(out).toContain('```\nplain fence\n```')
  })
  it('keeps tables without over-escaping', () => {
    expect(out).toMatch(/^\| Tool\s+\| Purpose\s+\|$/m)
    expect(out).toMatch(/^\|\s*-+\s*\|\s*-+\s*\|$/m)
    expect(out).toMatch(/^\| Bash\(git \*\)\s+\| Run git\s+\|$/m)
  })
  it('keeps blockquote, rule, link', () => {
    expect(out).toMatch(/^> A quoted line\. Second quoted line\.$/m)
    expect(out).toMatch(/^---$/m)
    expect(out).toContain('[the docs](https://example.com/docs)')
  })
  it('has no double blank lines', () => {
    expect(out).not.toContain('\n\n\n')
  })
  it('is idempotent', () => {
    expect(roundTrip(out)).toBe(out)
  })
})

describe('markdown round trip (real skills)', () => {
  const dir = join(__dirname, 'fixtures', 'real')
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.md'))) {
    it(`is stable and lossless for ${f}`, () => {
      const body = parseSkillMd(readFileSync(join(dir, f), 'utf8')).bodyMarkdown
      const once = roundTrip(body)
      const twice = roundTrip(once)
      expect(twice).toBe(once)
      const words = (s: string): string => plainText(s).replace(/\s+/g, ' ').trim()
      expect(words(once)).toBe(words(body))
    })
  }
})
