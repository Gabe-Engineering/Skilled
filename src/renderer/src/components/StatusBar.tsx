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
  const setPanelOpen = useUiStore((s) => s.setPanelOpen)
  const errors = issues.filter((i) => i.level === 'error').length
  const warnings = issues.filter((i) => i.level === 'warning').length

  return (
    <div className="statusbar">
      <span>{words} {words === 1 ? 'word' : 'words'}</span>
      <button type="button" className="status-btn" onClick={() => void toggleSpell()} title="Toggle spell check (F7)">
        Spelling: {spellOn ? spellLang : 'Off'}
      </button>
      <button type="button" className="status-btn" onClick={() => setPanelOpen(true)} title="Open properties">
        {errors ? `${errors} error${errors === 1 ? '' : 's'}` : warnings ? `${warnings} warning${warnings === 1 ? '' : 's'}` : 'No issues'}
      </button>
      <span className="spacer" />
      <span className={dirty ? 'status-dirty' : ''}>{!filePath ? 'Not saved yet' : dirty ? 'Unsaved changes' : 'Saved'}</span>
    </div>
  )
}
