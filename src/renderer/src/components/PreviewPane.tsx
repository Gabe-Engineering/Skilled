import { useMemo, useState } from 'react'
import { Copy, X, Check } from 'lucide-react'
import { serializeSkillMd } from '@shared/frontmatter'
import { useDocStore } from '@renderer/store/document-store'
import { useUiStore } from '@renderer/store/ui-store'

export function PreviewPane(): React.JSX.Element {
  const doc = useDocStore((s) => s.doc)
  const setPreviewOpen = useUiStore((s) => s.setPreviewOpen)
  const [copied, setCopied] = useState(false)
  const text = useMemo(() => serializeSkillMd(doc), [doc])

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text)
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
          <button type="button" className="icon-btn" aria-label="Copy" title="Copy to clipboard" onClick={() => void copy()}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
          <button type="button" className="icon-btn" aria-label="Close preview" onClick={() => setPreviewOpen(false)}>
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
