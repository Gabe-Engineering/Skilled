import { useMemo } from 'react'
import { useDocStore } from '@renderer/store/document-store'
import { useUiStore } from '@renderer/store/ui-store'
import { toggleSpell } from '@renderer/lib/actions'

export function StatusBar(): React.JSX.Element {
  const words = useUiStore((s) => s.wordCount)
  const spellOn = useUiStore((s) => s.spellOn)
  const spellLang = useUiStore((s) => s.spellLang)
  const dirty = useDocStore((s) => s.dirty)
  const filePath = useDocStore((s) => s.filePath)
  const issues = useDocStore((s) => s.issues)
  const touched = useDocStore((s) => s.touched)
  const setPanelOpen = useUiStore((s) => s.setPanelOpen)

  const check = useMemo(() => {
    if (!touched) return { label: 'Ready', tone: '' }
    const errors = issues.filter((i) => i.level === 'error').length
    if (errors) return { label: `${errors} error${errors === 1 ? '' : 's'}`, tone: 'err' }
    const warnings = issues.filter((i) => i.level === 'warning').length
    if (warnings) return { label: `${warnings} warning${warnings === 1 ? '' : 's'}`, tone: 'warn' }
    return { label: 'No issues', tone: 'ok' }
  }, [issues, touched])

  return (
    <div className="statusbar">
      <span>
        {words} {words === 1 ? 'word' : 'words'}
      </span>
      <button
        type="button"
        className="status-btn"
        onClick={() => void toggleSpell()}
        title="Toggle spell check (F7)"
      >
        Spelling: {spellOn ? spellLang : 'Off'}
      </button>
      <button
        type="button"
        className={'status-btn ' + check.tone}
        onClick={() => setPanelOpen(true)}
        title="Open properties"
      >
        {check.label}
      </button>
      <span className="spacer" />
      <span className={dirty ? 'status-dirty' : ''}>
        {!filePath ? 'Not saved yet' : dirty ? 'Unsaved changes' : 'Saved'}
      </span>
    </div>
  )
}
