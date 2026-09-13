import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  RotateCcw,
  X,
  FilePlus,
  Lock,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import type { AttachmentSubdir, IssueField, ValidationIssue } from '@shared/skill-types'
import { useDocStore } from '@renderer/store/document-store'
import { useUiStore } from '@renderer/store/ui-store'

const TOOL_SUGGESTIONS = [
  'Read',
  'Write',
  'Edit',
  'Bash',
  'Glob',
  'Grep',
  'WebFetch',
  'WebSearch',
  'Task',
  'Agent'
]
const MODEL_SUGGESTIONS = ['haiku', 'sonnet', 'opus']

function fieldIssues(issues: ValidationIssue[], field: IssueField): ValidationIssue[] {
  return issues.filter((i) => i.field === field)
}

function IssueLine({
  issue,
  onFix
}: {
  issue: ValidationIssue
  onFix?: (fix: string) => void
}): React.JSX.Element {
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
    <button
      type="button"
      className="badge reset"
      title="Derive from the document again"
      onClick={onReset}
    >
      <RotateCcw size={11} /> auto
    </button>
  )
}

function TriState({
  id,
  label,
  value,
  onChange,
  hint
}: {
  id: string
  label: string
  value: boolean | undefined
  onChange: (v: boolean | undefined) => void
  hint: string
}): React.JSX.Element {
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        value={value === undefined ? '' : value ? 'true' : 'false'}
        onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value === 'true')}
      >
        <option value="">(not set)</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
      <span className="field-hint">{hint}</span>
    </div>
  )
}

function TagInput({
  values,
  onChange
}: {
  values: string[]
  onChange: (v: string[]) => void
}): React.JSX.Element {
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
            <button
              type="button"
              aria-label={`Remove ${v}`}
              onClick={() => onChange(values.filter((x) => x !== v))}
            >
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
  // Subscribe to slices, not the whole document: typing in the body changes
  // `doc` on every sync tick but rarely touches attachments or extra YAML.
  const f = useDocStore((s) => s.doc.frontmatter)
  const attachments = useDocStore((s) => s.doc.attachments)
  const docExtraYaml = useDocStore((s) => s.doc.extraYaml)
  const issues = useDocStore((s) => s.issues)
  const touched = useDocStore((s) => s.touched)
  const overrides = useDocStore((s) => s.overrides)
  const setField = useDocStore((s) => s.setField)
  const resetOverride = useDocStore((s) => s.resetOverride)
  const setExtraYaml = useDocStore((s) => s.setExtraYaml)
  const addAttachments = useDocStore((s) => s.addAttachments)
  const removeAttachment = useDocStore((s) => s.removeAttachment)
  const setAttachmentSubdir = useDocStore((s) => s.setAttachmentSubdir)
  const setPanelOpen = useUiStore((s) => s.setPanelOpen)

  // The YAML box keeps a local draft and commits on blur. When a different
  // document is loaded, reset the draft during render rather than in an effect,
  // so there is no extra pass with the previous skill's YAML on screen.
  const [extra, setExtra] = useState(docExtraYaml)
  const [advancedOpen, setAdvancedOpen] = useState(!!docExtraYaml)
  const [syncedExtra, setSyncedExtra] = useState(docExtraYaml)
  if (docExtraYaml !== syncedExtra) {
    setSyncedExtra(docExtraYaml)
    setExtra(docExtraYaml)
    if (docExtraYaml) setAdvancedOpen(true)
  }

  const descRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = descRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 220) + 'px'
  }, [f.description])

  // Shown issues stay quiet until the user has actually done something; `issues`
  // itself still blocks saving.
  const shown = useMemo(() => (touched ? issues : []), [touched, issues])
  const { errors, warnings } = useMemo(
    () => ({
      errors: shown.filter((i) => i.level === 'error').length,
      warnings: shown.filter((i) => i.level === 'warning').length
    }),
    [shown]
  )

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
        <button
          type="button"
          className="icon-btn"
          aria-label="Close panel"
          onClick={() => setPanelOpen(false)}
        >
          <X size={16} />
        </button>
      </div>
      <div className="panel-body">
        <div className="field">
          <span className="field-label">
            <label htmlFor="skill-name">Name</label>
            <AutoBadge auto={!overrides.name} onReset={() => resetOverride('name')} />
          </span>
          <input
            id="skill-name"
            type="text"
            className="mono"
            spellCheck={false}
            value={f.name}
            placeholder="my-skill"
            onChange={(e) => setField('name', e.target.value)}
          />
          {fieldIssues(shown, 'name').map((i) => (
            <IssueLine key={i.id} issue={i} onFix={(fix) => setField('name', fix)} />
          ))}
          <span className="field-hint">
            Folder name and /slash-command. Lowercase words joined by hyphens.
          </span>
        </div>

        <div className="field">
          <span className="field-label">
            <label htmlFor="skill-description">Description</label>
            <AutoBadge auto={!overrides.description} onReset={() => resetOverride('description')} />
            <span className="counter">{f.description.length}</span>
          </span>
          <textarea
            id="skill-description"
            ref={descRef}
            rows={3}
            value={f.description}
            placeholder="What it does and when Claude should use it…"
            onChange={(e) => setField('description', e.target.value)}
          />
          {fieldIssues(shown, 'description').map((i) => (
            <IssueLine key={i.id} issue={i} />
          ))}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="skill-argument-hint">
            Argument hint
          </label>
          <input
            id="skill-argument-hint"
            type="text"
            className="mono"
            spellCheck={false}
            value={f['argument-hint'] ?? ''}
            placeholder="[file] [--flag]"
            onChange={(e) => setField('argument-hint', e.target.value)}
          />
          {fieldIssues(shown, 'argument-hint').map((i) => (
            <IssueLine key={i.id} issue={i} />
          ))}
          <span className="field-hint">
            Shown after the command name. Use $ARGUMENTS in the body.
          </span>
        </div>

        <TriState
          id="skill-user-invocable"
          label="User invocable"
          value={f['user-invocable']}
          onChange={(v) => setField('user-invocable', v)}
          hint="Can the user run it by typing /name?"
        />
        <TriState
          id="skill-disable-model-invocation"
          label="Disable model invocation"
          value={f['disable-model-invocation']}
          onChange={(v) => setField('disable-model-invocation', v)}
          hint="Stop Claude from loading it on its own."
        />

        <div className="field">
          <label className="field-label" htmlFor="skill-model">
            Model
          </label>
          <input
            id="skill-model"
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
        </div>

        <div className="field">
          <span className="field-label">Allowed tools</span>
          <TagInput
            values={f['allowed-tools'] ?? []}
            onChange={(v) => setField('allowed-tools', v)}
          />
          <span className="field-hint">Leave empty to allow everything. Press Enter to add.</span>
        </div>

        <div className="field">
          <span className="field-label">
            Attachments
            <span className="counter">{attachments.length}</span>
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
          {attachments.length > 0 && (
            <ul className="attach-list">
              {attachments.map((a) => (
                <li key={a.id} title={a.sourcePath}>
                  {a.origin === 'existing' ? (
                    <Lock size={13} className="muted" aria-label="Already in the skill folder" />
                  ) : null}
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
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Remove ${a.fileName} from the list`}
                    title={
                      a.origin === 'existing'
                        ? 'Stop listing this file. The file itself stays in the skill folder.'
                        : 'Remove'
                    }
                    onClick={() => removeAttachment(a.id)}
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {fieldIssues(shown, 'attachments').map((i) => (
            <IssueLine key={i.id} issue={i} />
          ))}
          <span className="field-hint">
            Copied into the skill folder on save. Files already there are kept.
          </span>
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
                aria-label="Additional YAML"
                value={extra}
                placeholder={'version: "1.0"\nlicense: MIT'}
                onChange={(e) => setExtra(e.target.value)}
                onBlur={() => {
                  if (extra !== docExtraYaml) setExtraYaml(extra)
                }}
              />
              {fieldIssues(shown, 'extraYaml').map((i) => (
                <IssueLine key={i.id} issue={i} />
              ))}
              <span className="field-hint">
                Extra frontmatter keys, written after the ones above.
              </span>
            </>
          )}
        </div>

        <div className="field">
          <span className="field-label">
            Checks
            {errors > 0 && <span className="counter err">{errors}</span>}
            {warnings > 0 && <span className="counter warn">{warnings}</span>}
          </span>
          {!touched ? (
            <div className="field-hint">Checks appear as you write.</div>
          ) : shown.length === 0 ? (
            <div className="issue ok">Looks good. Ready to save.</div>
          ) : (
            shown
              .filter((i) => i.field === 'body' || i.field === undefined)
              .map((i) => <IssueLine key={i.id} issue={i} />)
          )}
          {touched &&
            shown.length > 0 &&
            shown.every((i) => i.field !== 'body' && i.field !== undefined) && (
              <div className="field-hint">See the notes under each field above.</div>
            )}
        </div>
      </div>
    </aside>
  )
}
