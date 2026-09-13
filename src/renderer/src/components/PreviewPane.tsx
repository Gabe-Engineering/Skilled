import { useEffect, useRef, useState } from 'react'
import { Copy, X, Check } from 'lucide-react'
import { serializeSkillMd } from '@shared/frontmatter'
import { useDocStore } from '@renderer/store/document-store'
import { useUiStore } from '@renderer/store/ui-store'

const RENDER_DELAY_MS = 200

export function PreviewPane(): React.JSX.Element {
  const doc = useDocStore((s) => s.doc)
  const setPreviewOpen = useUiStore((s) => s.setPreviewOpen)
  const [copied, setCopied] = useState(false)
  // Re-serializing the whole SKILL.md (YAML dump + markdown normalize) on every
  // keystroke is wasted work when the pane is just sitting there; coalesce it.
  const [text, setText] = useState(() => serializeSkillMd(doc))
  const timer = useRef<number | null>(null)

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      timer.current = null
      setText(serializeSkillMd(doc))
    }, RENDER_DELAY_MS)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [doc])

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(serializeSkillMd(useDocStore.getState().doc))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable
    }
  }

  return (
    <aside className="preview">
      <div className="panel-header">
        <span>SKILL.md preview</span>
        <div className="row">
          <button
            type="button"
            className="icon-btn"
            aria-label="Copy"
            title="Copy to clipboard"
            onClick={() => void copy()}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="Close preview"
            onClick={() => setPreviewOpen(false)}
          >
            <X size={16} />
          </button>
        </div>
      </div>
      <pre className="preview-body" spellCheck={false}>
        {text}
      </pre>
    </aside>
  )
}
