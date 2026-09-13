import { useEffect, useRef, useState } from 'react'
import { ChevronDown, FilePlus2, FolderOpen, Save, Download, FolderSearch, Clock } from 'lucide-react'
import { useDocStore } from '@renderer/store/document-store'
import { useUiStore } from '@renderer/store/ui-store'
import { exportAs, openSkill, save, showInFolder, startNew } from '@renderer/lib/actions'

export function TitleBar(): React.JSX.Element {
  const name = useDocStore((s) => s.doc.frontmatter.name)
  const dirty = useDocStore((s) => s.dirty)
  const filePath = useDocStore((s) => s.filePath)
  const recents = useUiStore((s) => s.recentFiles)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const run = (fn: () => unknown): void => {
    setOpen(false)
    void fn()
  }

  return (
    <div className="titlebar">
      <div className="file-menu" ref={ref}>
        <button className={'file-button' + (open ? ' open' : '')} onClick={() => setOpen((v) => !v)}>
          File <ChevronDown size={14} />
        </button>
        {open && (
          <div className="file-dropdown" role="menu">
            <button role="menuitem" onClick={() => run(startNew)}>
              <FilePlus2 size={16} /> New… <span className="kbd">Ctrl+N</span>
            </button>
            <button role="menuitem" onClick={() => run(() => openSkill())}>
              <FolderOpen size={16} /> Open… <span className="kbd">Ctrl+O</span>
            </button>
            <div className="file-section">
              <div className="file-section-title">
                <Clock size={13} /> Recent
              </div>
              {recents.length === 0 && <div className="file-empty">No recent skills</div>}
              {recents.map((r) => (
                <button key={r.path} role="menuitem" className="recent" title={r.path} onClick={() => run(() => openSkill(r.path))}>
                  <span className="recent-name">{r.name}</span>
                  <span className="recent-path">{r.path}</span>
                </button>
              ))}
            </div>
            <div className="file-divider" />
            <button role="menuitem" onClick={() => run(save)}>
              <Save size={16} /> Save <span className="kbd">Ctrl+S</span>
            </button>
            <button role="menuitem" onClick={() => run(exportAs)}>
              <Download size={16} /> Export As… <span className="kbd">Ctrl+Shift+S</span>
            </button>
            <button role="menuitem" onClick={() => run(showInFolder)} disabled={!filePath}>
              <FolderSearch size={16} /> Show in Explorer
            </button>
          </div>
        )}
      </div>
      <div className="title-center">
        <span className="doc-title">{name || 'Untitled'}</span>
        {dirty && <span className="dirty-dot" title="Unsaved changes">●</span>}
        <span className="app-name">Skilled</span>
      </div>
      <div className="title-right" title={filePath ?? 'Not exported yet'}>
        {filePath ? filePath : 'Not exported yet'}
      </div>
    </div>
  )
}
