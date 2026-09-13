import { beforeEach, describe, expect, it } from 'vitest'
import { useDocStore } from '../src/renderer/src/store/document-store'
import { emptyDocument } from '../src/shared/skill-types'
import type { OpenResult } from '../src/shared/ipc'

function reset(): void {
  useDocStore.setState({
    doc: emptyDocument(),
    filePath: null,
    dirty: false,
    overrides: { name: false, description: false },
    issues: [],
    touched: false,
    warnings: []
  })
}

function opened(bodyMarkdown: string, name = 'my-skill'): OpenResult {
  return {
    path: `C:/skills/${name}/SKILL.md`,
    raw: '',
    doc: {
      frontmatter: { name, description: 'Use when the user asks for it.' },
      extraYaml: '',
      bodyMarkdown,
      attachments: []
    },
    warnings: []
  }
}

describe('document store', () => {
  beforeEach(reset)

  it('starts untouched so a blank document reports no problems to the user', () => {
    expect(useDocStore.getState().touched).toBe(false)
  })

  it('marks the document touched once the body changes', () => {
    useDocStore.getState().setBody('# Hello\n')
    expect(useDocStore.getState().touched).toBe(true)
    expect(useDocStore.getState().dirty).toBe(true)
  })

  it('treats an opened skill as touched', () => {
    useDocStore.getState().loadDocument(opened('# Hello\n'))
    expect(useDocStore.getState().touched).toBe(true)
    expect(useDocStore.getState().dirty).toBe(false)
  })

  it('still reports blocking issues on an untouched document', () => {
    // `touched` only gates what the UI shows; saving must stay blocked.
    useDocStore.setState({ issues: [] })
    useDocStore.getState().setBody('no heading here')
    const { issues } = useDocStore.getState()
    expect(issues.some((i) => i.level === 'warning')).toBe(true)
  })

  it('keeps the frontmatter object identity when autofill derives the same values', () => {
    useDocStore.getState().setBody('# Release Notes\n\nUse when the user asks for notes.\n')
    const first = useDocStore.getState().doc.frontmatter
    expect(first.name).toBe('release-notes')

    // Editing text that changes neither the H1 nor the first paragraph must not
    // hand subscribers a new frontmatter object, or the panel re-renders on
    // every keystroke.
    useDocStore
      .getState()
      .setBody('# Release Notes\n\nUse when the user asks for notes.\n\nMore.\n')
    expect(useDocStore.getState().doc.frontmatter).toBe(first)
  })

  it('hands back a new frontmatter object when a derived value really changes', () => {
    useDocStore.getState().setBody('# One\n')
    const first = useDocStore.getState().doc.frontmatter
    useDocStore.getState().setBody('# Two\n')
    const second = useDocStore.getState().doc.frontmatter
    expect(second).not.toBe(first)
    expect(second.name).toBe('two')
  })

  it('reuses the issues array while the issues are unchanged', () => {
    useDocStore.getState().setBody('# Notes\n\nUse when the user asks.\n')
    const first = useDocStore.getState().issues
    useDocStore.getState().setBody('# Notes\n\nUse when the user asks.\n\nExtra line.\n')
    expect(useDocStore.getState().issues).toBe(first)
  })

  it('replaces the issues array when an issue appears or clears', () => {
    useDocStore.getState().setBody('# Notes\n\nUse when the user asks.\n')
    const first = useDocStore.getState().issues
    useDocStore.getState().setField('argument-hint', '[file]')
    const second = useDocStore.getState().issues
    expect(second).not.toBe(first)
    expect(second.some((i) => i.id === 'argument-hint-unused')).toBe(true)
  })

  it('lets an attachment be removed after the skill has been saved once', () => {
    useDocStore
      .getState()
      .addAttachments(
        [{ sourcePath: 'C:/tmp/notes.md', fileName: 'notes.md', size: 10 }],
        'references'
      )
    const { id } = useDocStore.getState().doc.attachments[0]

    useDocStore.getState().markSaved('C:/skills/my-skill/SKILL.md', 'C:/skills/my-skill')
    expect(useDocStore.getState().doc.attachments[0].origin).toBe('existing')

    useDocStore.getState().removeAttachment(id)
    expect(useDocStore.getState().doc.attachments).toHaveLength(0)
  })

  it('points saved attachments at their copies inside the skill folder', () => {
    useDocStore
      .getState()
      .addAttachments([{ sourcePath: 'C:/tmp/run.ps1', fileName: 'run.ps1', size: 4 }], 'scripts')
    useDocStore.getState().markSaved('C:/skills/my-skill/SKILL.md', 'C:/skills/my-skill')
    expect(useDocStore.getState().doc.attachments[0].sourcePath).toBe(
      'C:/skills/my-skill/scripts/run.ps1'
    )
  })
})
