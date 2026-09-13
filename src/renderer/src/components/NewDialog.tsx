import { useCallback } from 'react'
import { FileText, TerminalSquare, BookOpen, ListChecks } from 'lucide-react'
import { TEMPLATES } from '@shared/templates'
import { useDocStore } from '@renderer/store/document-store'
import { useUiStore } from '@renderer/store/ui-store'
import { useModal } from '@renderer/hooks/useModal'

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

  const close = useCallback(() => setOpen(false), [setOpen])
  const ref = useModal(open, close)

  if (!open) return null

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="new-title" ref={ref}>
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
          <button type="button" className="btn" onClick={close}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
