import { useEffect } from 'react'
import { FileText, TerminalSquare, BookOpen, ListChecks } from 'lucide-react'
import { TEMPLATES } from '@shared/templates'
import { useDocStore } from '@renderer/store/document-store'
import { useUiStore } from '@renderer/store/ui-store'

const ICONS: Record<string, React.ReactNode> = {
  blank: <FileText size={28} />,
  'slash-command': <TerminalSquare size={28} />,
  reference: <BookOpen size={28} />,
  workflow: <ListChecks size={28} />
}

export function NewDialog(): React.JSX.Element | null {
  const open = useUiStore((s) => s.newDialogOpen)
  const setOpen = useUiStore((s) => s.setNewDialogOpen)
  const newFromTemplate = useDocStore((s) => s.newFromTemplate)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  if (!open) return null

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="new-title">
        <h2 id="new-title">New skill</h2>
        <p className="muted">Pick a starting point. You can change everything afterwards.</p>
        <div className="template-grid">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              className="template-card"
              onClick={() => {
                newFromTemplate(t.id)
                setOpen(false)
              }}
            >
              <div className="template-icon">{ICONS[t.id]}</div>
              <div className="template-title">{t.title}</div>
              <div className="template-blurb">{t.blurb}</div>
            </button>
          ))}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
