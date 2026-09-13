import { useEffect, useRef, useState } from 'react'
import { AlertCircle, AlertTriangle, RotateCcw, X, FilePlus, Lock, ChevronDown, ChevronRight } from 'lucide-react'
import type { AttachmentSubdir, IssueField, ValidationIssue } from '@shared/skill-types'
import { useDocStore } from '@renderer/store/document-store'
import { useUiStore } from '@renderer/store/ui-store'

const TOOL_SUGGESTIONS = ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebFetch', 'WebSearch', 'Task', 'Agent']
const MODEL_SUGGESTIONS = ['haiku', 'sonnet', 'opus']

function fieldIssues(issues: ValidationIssue[], field: IssueField): ValidationIssue[] {
  return issues.filter((i) => i.field === field)
}

function IssueLine({ issue, onFix }: { issue: ValidationIssue; onFix?: (fix: string) => void }): React.JSX.Element {
  return (
    <div className={'issue ' + issue.level}>
      {issue.level === 'error' ? <AlertCircle size={14} /> : <AlertTriangle size={14} />}
      <span>{issue.message}</span>
      {issue.fix && onFix && (
        <button type="button" className="link-btn" onClick={() => onFix(issue.fix!)}>
          Use “{issue.fix}”
        </button>
      )}
    </div>
  )
}

function AutoBadge({ auto, onReset }: { auto: boolean; onReset: () => void }): React.JSX.Element {
  return auto ? (
    <span className="badge auto" title="Derived from the document. Edit to take over.">
      auto
    </span>
  ) : (
    <button type="button" className="badge reset" title="Derive from the document again" onClick={onReset}>
      <RotateCcw size={11} /> auto
    </button>
  )
}

function TriState({
  label,
  value,
  onChange,
  hint
}: {
  label: string
  value: boolean | undefined
  onChange: (v: boolean | undefined) => void
  hint: string
}): React.JSX.Element {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <select
        value={value === undefined ? '' : value ? 'true' : 'false'}
        onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value === 'true')}
      >
        <option value="">(not set)</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
      <span className="field-hint">{hint}</span>
    </label>
  )
}

function TagInput({ values, onChange }: { values: string[]; onChange: (v: string[]) => void }): React.JSX.Element {
  const [text, setText] = useState('')
  const add = (raw: string): void => {
    const items = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (!items.length) return
    const next = [...values]
    for (const it of items) if (!next.includes(it)) next.push(it)
    onChange(next)
    setText('')
  }
  return (
    <div className="tags">
      <div className="tag-list">
        {values.map((v) => (
          <span key={v} className="tag">
            {v}
            <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((x) => x !== v))}>
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          type="text"
          list="tool-suggestions"
          placeholder={values.length ? 'Add tool…' : 'e.g. Read, Bash(git *)'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              add(text)
            } else if (e.key === 'Backspace' && !text && values.length) {
              onChange(values.slice(0, -1))
            }
          }}
          onBlur={() => add(text)}
        />
        <datalist id="tool-suggestions">
          {TOOL_SUGGESTIONS.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </div>
    </div>
  )
}

function formatSize(n?: number): string {
  if (n == null) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function PropertiesPanel(): React.JSX.Element {
  const doc = useDocStore((s) => s.doc)
  const issues = useDocStore((s) => s.issues)
  const overrides = useDocStore((s) => s.overrides)
  const setField = useDocStore((s) => s.setField)
  const resetOverride = useDocStore((s) => s.resetOverride)
  const setExtraYaml = useDocStore((s) => s.setExtraYaml)
  const addAttachments = useDocStore((s) => s.addAttachments)
  const removeAttachment = useDocStore((s) => s.removeAttachment)
  const setAttachmentSubdir = useDocStore((s) => s.setAttachmentSubdir)
  const setPanelOpen = useUiStore((s) => s.setPanelOpen)

  const [extra, setExtra] = useState(doc.extraYaml)
  const [advancedOpen, setAdvancedOpen] = useState(!!doc.extraYaml)
  const lastExtra = useRef(doc.extraYaml)
  useEffect(() => {
    if (doc.extraYaml !== lastExtra.current) {
      lastExtra.current = doc.extraYaml
      setExtra(doc.extraYaml)
      if (doc.extraYaml) setAdvancedOpen(true)
    }
  }, [doc.extraYaml])

  const descRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = descRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 220) + 'px'
  }, [doc.frontmatter.description])

  const f = doc.frontmatter
  const errors = issues.filter((i) => i.level === 'error').length
  const warnings = issues.filter((i) => i.level === 'warning').length

  const pick = async (kind: 'references' | 'scripts' | 'other'): Promise<void> => {
    const files = await window.skilled.pickAttachments(kind)
    if (!files.length) return
    const subdir: AttachmentSubdir = kind === 'other' ? '' : kind
    addAttachments(files, subdir)
  }

  return (
    <aside className="panel">
      <div className="panel-header">
        <span>Skill properties</span>
        <button type="button" className="icon-btn" aria-label="Close panel" onClick={() => setPanelOpen(false)}>
          <X size={16} />
        </button>
      </div>
      <div className="panel-body">
        <label className="field">
          <span className="field-label">
            Name <AutoBadge auto={!overrides.name} onReset={() => resetOverride('name')} />
          </span>
          <input
            type="text"
            className="mono"
            spellCheck={false}
            value={f.name}
            placeholder="my-skill"
            onChange={(e) => setField('name', e.target.value)}
          />
          {fieldIssues(issues, 'name').map((i) => (
            <IssueLine key={i.id} issue={i} onFix={(fix) => setField('name', fix)} />
          ))}
          <span className="field-hint">Folder name and /slash-command. Lowercase words joined by hyphens.</span>
        </label>

        <label className="field">
          <span className="field-label">
            Description <AutoBadge auto={!overrides.description} onReset={() => resetOverride('description')} />
            <span className="counter">{f.description.length}</span>
          </span>
          <textarea
            ref={descRef}
            rows={3}
            value={f.description}
            placeholder="What it does and when Claude should use it…"
            onChange={(e) => setField('description', e.target.value)}
          />
          {fieldIssues(issues, 'description').map((i) => (
            <IssueLine key={i.id} issue={i} />
          ))}
        </label>

        <label className="field">
          <span className="field-label">Argument hint</span>
          <input
            type="text"
            className="mono"
            spellCheck={false}
            value={f['argument-hint'] ?? ''}
            placeholder="[file] [--flag]"
            onChange={(e) => setField('argument-hint', e.target.value)}
          />
          {fieldIssues(issues, 'argument-hint').map((i) => (
            <IssueLine key={i.id} issue={i} />
          ))}
          <span className="field-hint">Shown after the command name. Use $ARGUMENTS in the body.</span>
        </label>

        <TriState
          label="User invocable"
          value={f['user-invocable']}
          onChange={(v) => setField('user-invocable', v)}
          hint="Can the user run it by typing /name?"
        />
        <TriState
          label="Disable model invocation"
          value={f['disable-model-invocation']}
          onChange={(v) => setField('disable-model-invocation', v)}
          hint="Stop Claude from loading it on its own."
        />

        <label className="field">
          <span className="field-label">Model</span>
          <input
            type="text"
            list="model-suggestions"
            className="mono"
            spellCheck={false}
            value={f.model ?? ''}
            placeholder="(default)"
            onChange={(e) => setField('model', e.target.value)}
          />
          <datalist id="model-suggestions">
            {MODEL_SUGGESTIONS.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </label>

        <div className="field">
          <span className="field-label">Allowed tools</span>
          <TagInput values={f['allowed-tools'] ?? []} onChange={(v) => setField('allowed-tools', v)} />
          <span className="field-hint">Leave empty to allow everything. Press Enter to add.</span>
        </div>

        <div className="field">
          <span className="field-label">
            Attachments
            <span className="counter">{doc.attachments.length}</span>
          </span>
          <div className="attach-actions">
            <button type="button" className="btn small" onClick={() => void pick('references')}>
              <FilePlus size={14} /> Reference
            </button>
            <button type="button" className="btn small" onClick={() => void pick('scripts')}>
              <FilePlus size={14} /> Script
            </button>
            <button type="button" className="btn small" onClick={() => void pick('other')}>
              <FilePlus size={14} /> Other
            </button>
          </div>
          {doc.attachments.length > 0 && (
            <ul className="attach-list">
              {doc.attachments.map((a) => (
                <li key={a.id} title={a.sourcePath}>
                  {a.origin === 'existing' ? <Lock size={13} className="muted" /> : null}
                  <span className="attach-name">{a.fileName}</span>
                  <select
                    value={a.subdir}
                    disabled={a.origin === 'existing'}
                    onChange={(e) => setAttachmentSubdir(a.id, e.target.value as AttachmentSubdir)}
                    aria-label="Folder"
                  >
                    <option value="references">references/</option>
                    <option value="scripts">scripts/</option>
                    <option value="assets">assets/</option>
                    <option value="">(root)</option>
                  </select>
                  <span className="attach-size">{formatSize(a.size)}</span>
                  {a.origin === 'new' && (
                    <button type="button" className="icon-btn" aria-label="Remove" onClick={() => removeAttachment(a.id)}>
                      <X size={14} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {fieldIssues(issues, 'attachments').map((i) => (
            <IssueLine key={i.id} issue={i} />
          ))}
          <span className="field-hint">Copied into the skill folder on save. Files already there are kept.</span>
        </div>

        <div className="field">
          <button type="button" className="disclosure" onClick={() => setAdvancedOpen((v) => !v)}>
            {advancedOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Additional YAML
          </button>
          {advancedOpen && (
            <>
              <textarea
                className="mono"
                rows={4}
                spellCheck={false}
                value={extra}
                placeholder={'version: "1.0"\nlicense: MIT'}
                onChange={(e) => setExtra(e.target.value)}
                onBlur={() => {
                  if (extra !== doc.extraYaml) setExtraYaml(extra)
                }}
              />
              {fieldIssues(issues, 'extraYaml').map((i) => (
                <IssueLine key={i.id} issue={i} />
              ))}
              <span className="field-hint">Extra frontmatter keys, written after the ones above.</span>
            </>
          )}
        </div>

        <div className="field">
          <span className="field-label">
            Checks
            {errors > 0 && <span className="counter err">{errors}</span>}
            {warnings > 0 && <span className="counter warn">{warnings}</span>}
          </span>
          {issues.length === 0 ? (
            <div className="issue ok">Looks good. Ready to save.</div>
          ) : (
            issues
              .filter((i) => i.field === 'body' || i.field === undefined)
              .map((i) => <IssueLine key={i.id} issue={i} />)
          )}
          {issues.length > 0 && issues.every((i) => i.field !== 'body' && i.field !== undefined) && (
            <div className="field-hint">See the notes under each field above.</div>
          )}
        </div>
      </div>
    </aside>
  )
}
