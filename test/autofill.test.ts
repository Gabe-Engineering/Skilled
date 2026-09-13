import { describe, expect, it } from 'vitest'
import { deriveDescription, deriveName, deriveTitle } from '../src/renderer/src/lib/autofill'

describe('autofill', () => {
  it('derives the name from the H1', () => {
    expect(deriveName('# Hello Skill\n\nBody.')).toBe('hello-skill')
    expect(deriveName('# /discord:configure — Discord Channel Setup\n')).toBe('configure')
    expect(deriveName('intro line\n\n## Only H2 here\n')).toBe('only-h2-here')
  })
  it('keeps plain first lines short', () => {
    expect(deriveName('This sentance has a mispelled word in it. Anothr wrod here.')).toBe(
      'this-sentance-has-a-mispelled'
    )
    expect(deriveName('')).toBe('untitled-skill')
  })
  it('skips code fences when looking for a title', () => {
    expect(deriveTitle('```\n# not a title\n```\n# Real Title\n')).toBe('Real Title')
  })
  it('derives the description from the first plain paragraph', () => {
    const body = '# Title\n\n- a list first\n\nUse when the user asks for **things**. Second sentence.\n'
    expect(deriveDescription(body)).toBe('Use when the user asks for things. Second sentence.')
  })
  it('cuts long descriptions at a sentence end', () => {
    const long = 'First sentence is here. ' + 'word '.repeat(80) + 'end.'
    const d = deriveDescription('# T\n\n' + long)
    expect(d.length).toBeLessThanOrEqual(300)
    expect(d.endsWith('.') || d.endsWith('…')).toBe(true)
  })
})
