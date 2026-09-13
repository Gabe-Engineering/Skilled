import { useCallback, useEffect, useState } from 'react'
import type { AppInfo } from '@shared/ipc'
import { useUiStore } from '@renderer/store/ui-store'
import { useModal } from '@renderer/hooks/useModal'

export function AboutDialog(): React.JSX.Element | null {
  const open = useUiStore((s) => s.aboutOpen)
  const setOpen = useUiStore((s) => s.setAboutOpen)
  const [info, setInfo] = useState<AppInfo | null>(null)

  const close = useCallback(() => setOpen(false), [setOpen])
  const ref = useModal(open, close)

  useEffect(() => {
    if (!open) return
    void window.skilled.getAppInfo().then(setInfo)
  }, [open])

  if (!open) return null
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div
        className="modal small"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        ref={ref}
      >
        <h2 id="about-title">Skilled</h2>
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
          <button type="button" className="btn primary" onClick={close}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
