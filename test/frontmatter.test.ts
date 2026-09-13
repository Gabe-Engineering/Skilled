import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { load } from 'js-yaml'
import { describe, expect, it } from 'vitest'
import {
  buildFrontmatterObject,
  parseSkillMd,
  serializeSkillMd,
  splitFrontmatter
} from '../src/shared/frontmatter'
import { toKebabCase, isKebabCase } from '../src/shared/kebab'
import { validateSkill } from '../src/shared/validation'
import type { SkillDocument } from '../src/shared/skill-types'

const REAL_DIR = join(__dirname, 'fixtures', 'real')
const realFiles = readdirSync(REAL_DIR).filter((f) => f.endsWith('.md'))

function toDoc(text: string): SkillDocument {
  const p = parseSkillMd(text)
  return {
    frontmatter: p.frontmatter,
    extraYaml: p.extraYaml,
    bodyMarkdown: p.bodyMarkdown,
    attachments: []
  }
}

describe('kebab', () => {
  it('derives names from titles', () => {
    expect(toKebabCase('My Cool Skill!')).toBe('my-cool-skill')
    expect(toKebabCase('/discord:configure — Discord Channel Setup')).toBe('configure')
    expect(toKebabCase('/simplify')).toBe('simplify')
    expect(toKebabCase('Café Résumé')).toBe('cafe-resume')
    expect(toKebabCase('  --weird--  ')).toBe('weird')
    expect(isKebabCase('a-b-1')).toBe(true)
    expect(isKebabCase('A-b')).toBe(false)
    expect(isKebabCase('a--b')).toBe(false)
  })
})

describe('splitFrontmatter', () => {
  it('splits fenced yaml from body', () => {
    const r = splitFrontmatter('---\nname: x\n---\n\n# Hi\n')
    expect(r.yaml).toBe('name: x')
    expect(r.body).toBe('\n# Hi\n')
  })
  it('handles CRLF and BOM', () => {
    const r = splitFrontmatter('﻿---\r\nname: x\r\n---\r\nbody\r\n')
    expect(r.yaml).toBe('name: x')
    expect(r.body).toBe('body\n')
  })
  it('returns null yaml when absent', () => {
    expect(splitFrontmatter('# Just body').yaml).toBeNull()
  })
})

describe('real skill corpus', () => {
  it('has fixtures', () => {
    expect(realFiles.length).toBeGreaterThan(10)
  })

  for (const f of realFiles) {
    it(`round-trips frontmatter of ${f}`, () => {
      const text = readFileSync(join(REAL_DIR, f), 'utf8')
      const doc = toDoc(text)
      const out = serializeSkillMd(doc)

      // Serialized frontmatter must be strict YAML and parse back to the same object.
      const { yaml } = splitFrontmatter(out)
      expect(yaml).not.toBeNull()
      const reloaded = load(yaml!) as Record<string, unknown>
      expect(reloaded).toEqual(buildFrontmatterObject(doc))

      // A second pass must be stable.
      const doc2 = toDoc(out)
      expect(serializeSkillMd(doc2)).toBe(out)

      // Name and description are never lost.
      expect(doc.frontmatter.name.length).toBeGreaterThan(0)
      expect(doc.frontmatter.description.length).toBeGreaterThan(0)
      expect(doc2.frontmatter).toEqual(doc.frontmatter)
    })
  }
})

describe('serializeSkillMd', () => {
  it('orders keys and quotes tricky scalars', () => {
    const doc: SkillDocument = {
      frontmatter: {
        name: 'demo',
        description: 'Does things: with colons. Use when the user says "go" # not a comment',
        'allowed-tools': ['Read', 'Bash(git *)'],
        'argument-hint': '[arg1] [arg2]',
        'user-invocable': true,
        model: 'sonnet'
      },
      extraYaml: 'version: "1.0"\nlicense: MIT',
      bodyMarkdown: '# Demo\n\nBody.\n',
      attachments: []
    }
    const out = serializeSkillMd(doc)
    const lines = out.split('\n')
    expect(lines[0]).toBe('---')
    expect(lines[1]).toBe('name: demo')
    expect(lines[2]).toMatch(/^description: '/)
    expect(lines[3]).toBe("argument-hint: '[arg1] [arg2]'")
    expect(lines[4]).toBe('user-invocable: true')
    expect(lines[5]).toBe('model: sonnet')
    expect(lines[6]).toBe('allowed-tools:')
    expect(lines[7]).toBe('  - Read')
    expect(lines[8]).toBe('  - Bash(git *)')
    expect(lines[9]).toBe("version: '1.0'")
    expect(lines[10]).toBe('license: MIT')
    expect(lines[11]).toBe('---')
    expect(lines[12]).toBe('')
    expect(lines[13]).toBe('# Demo')
    expect(out.endsWith('Body.\n')).toBe(true)
    const reloaded = load(splitFrontmatter(out).yaml!) as Record<string, unknown>
    expect(reloaded['argument-hint']).toBe('[arg1] [arg2]')
    expect(reloaded.description).toBe(doc.frontmatter.description)
  })

  it('loads invalid yaml leniently', () => {
    const p = parseSkillMd('---\nname: x\nargument-hint: [a] [b]\ndescription: d\n---\nbody')
    expect(p.warnings.length).toBe(1)
    expect(p.frontmatter['argument-hint']).toBe('[a] [b]')
    expect(p.frontmatter.name).toBe('x')
  })

  it('normalizes allowed-tools shapes', () => {
    expect(
      parseSkillMd('---\nallowed-tools: Read, Write\n---\n').frontmatter['allowed-tools']
    ).toEqual(['Read', 'Write'])
    expect(
      parseSkillMd('---\nallowed-tools: [Read, Glob]\n---\n').frontmatter['allowed-tools']
    ).toEqual(['Read', 'Glob'])
    expect(
      parseSkillMd('---\nallowed-tools:\n  - Read\n---\n').frontmatter['allowed-tools']
    ).toEqual(['Read'])
  })
})

describe('validateSkill', () => {
  it('flags the basics', () => {
    const ids = validateSkill({
      frontmatter: { name: 'My Skill', description: '' },
      extraYaml: 'name: dup',
      bodyMarkdown: 'no heading',
      attachments: []
    }).map((i) => i.id)
    expect(ids).toContain('name-kebab')
    expect(ids).toContain('description-required')
    expect(ids).toContain('extra-yaml-collision')
    expect(ids).toContain('body-no-h1')
  })
  it('is quiet for a good skill', () => {
    const issues = validateSkill({
      frontmatter: { name: 'good', description: 'Use when the user asks for good.' },
      extraYaml: '',
      bodyMarkdown: '# Good\n\nBody.\n',
      attachments: []
    })
    expect(issues).toEqual([])
  })
})
