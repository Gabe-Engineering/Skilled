import { isKebabCase, toKebabCase } from './kebab'
import { parseExtraYaml } from './frontmatter'
import { KNOWN_KEYS, type SkillDocument, type ValidationIssue } from './skill-types'

const TRIGGER_RES = [
  /\buse (this|it|when|for)\b/i,
  /\bwhen (the )?user\b/i,
  /\bshould be used when\b/i,
  /\btrigger/i,
  /\binvoke\b/i,
  /\bwhenever\b/i
]

export function hasTriggerPhrasing(description: string): boolean {
  return TRIGGER_RES.some((re) => re.test(description))
}

export function validateSkill(doc: SkillDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const f = doc.frontmatter
  const name = f.name.trim()
  const desc = f.description.trim()

  if (!name) {
    issues.push({ id: 'name-required', level: 'error', field: 'name', message: 'Name is required.' })
  } else if (!isKebabCase(name)) {
    const fix = toKebabCase(name)
    issues.push({
      id: 'name-kebab',
      level: 'error',
      field: 'name',
      message: fix
        ? `Name must be kebab-case (lowercase letters, digits, hyphens). Try "${fix}".`
        : 'Name must be kebab-case (lowercase letters, digits, hyphens).',
      fix: fix || undefined
    })
  } else if (name.length > 64) {
    issues.push({
      id: 'name-length',
      level: 'warning',
      field: 'name',
      message: 'Name is longer than 64 characters.'
    })
  }

  if (!desc) {
    issues.push({
      id: 'description-required',
      level: 'error',
      field: 'description',
      message: 'Description is required. Claude uses it to decide when to load the skill.'
    })
  } else {
    if (!hasTriggerPhrasing(desc)) {
      issues.push({
        id: 'description-trigger',
        level: 'warning',
        field: 'description',
        message:
          'Add trigger guidance so Claude knows when to use it, e.g. "Use when the user asks to …".'
      })
    }
    if (desc.length > 1024) {
      issues.push({
        id: 'description-length',
        level: 'warning',
        field: 'description',
        message:
          'Description is over 1024 characters. It is always loaded into context, so keep it short.'
      })
    }
    if (/\n/.test(desc)) {
      issues.push({
        id: 'description-newline',
        level: 'warning',
        field: 'description',
        message: 'Description contains line breaks. A single line is recommended.'
      })
    }
  }

  if (doc.extraYaml.trim()) {
    try {
      const extra = parseExtraYaml(doc.extraYaml)
      const collisions = Object.keys(extra).filter((k) =>
        (KNOWN_KEYS as readonly string[]).includes(k)
      )
      if (collisions.length) {
        issues.push({
          id: 'extra-yaml-collision',
          level: 'error',
          field: 'extraYaml',
          message: `Additional YAML redefines ${collisions
            .map((c) => `"${c}"`)
            .join(', ')}. Use the fields above instead.`
        })
      }
    } catch (e) {
      issues.push({
        id: 'extra-yaml-parse',
        level: 'error',
        field: 'extraYaml',
        message: `Additional YAML does not parse: ${(e as Error).message.split('\n')[0]}`
      })
    }
  }

  const body = doc.bodyMarkdown
  if (!body.trim()) {
    issues.push({
      id: 'body-empty',
      level: 'warning',
      field: 'body',
      message: 'The skill body is empty.'
    })
  } else if (!/^#\s+\S/m.test(body)) {
    issues.push({
      id: 'body-no-h1',
      level: 'warning',
      field: 'body',
      message: 'No top-level heading. Start the document with a title so the name can be derived.'
    })
  }

  if (f['argument-hint']?.trim() && !/\$ARGUMENTS\b/.test(body)) {
    issues.push({
      id: 'argument-hint-unused',
      level: 'warning',
      field: 'argument-hint',
      message: 'An argument hint is set but the body never uses $ARGUMENTS.'
    })
  }

  const seen = new Set<string>()
  for (const a of doc.attachments) {
    const key = `${a.subdir}/${a.fileName}`.toLowerCase()
    if (seen.has(key)) {
      issues.push({
        id: `attachment-duplicate:${key}`,
        level: 'warning',
        field: 'attachments',
        message: `Two attachments would be written to ${a.subdir ? a.subdir + '/' : ''}${a.fileName}.`
      })
    }
    seen.add(key)
  }

  return issues
}
