import { useEffect, useState } from 'react'
import type { AppInfo } from '@shared/ipc'
import { useUiStore } from '@renderer/store/ui-store'

export function AboutDialog(): React.JSX.Element | null {
  const open = useUiStore((s) => s.aboutOpen)
  const setOpen = useUiStore((s) => s.setAboutOpen)
  const [info, setInfo] = useState<AppInfo | null>(null)

  useEffect(() => {
    if (!open) return
    void window.skilled.getAppInfo().then(setInfo)
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  if (!open) return null
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="modal small" role="dialog" aria-modal="true">
        <h2>Skilled</h2>
        <p className="muted">A Word-like editor for Claude Code skills.</p>
        {info && (
          <dl className="about-list">
            <dt>Version</dt>
            <dd>{info.version}</dd>
            <dt>Electron</dt>
            <dd>{info.electron}</dd>
            <dt>Settings</dt>
            <dd className="mono">{info.userDataPath}</dd>
          </dl>
        )}
        <div className="modal-actions">
          <button type="button" className="btn primary" onClick={() => setOpen(false)}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
