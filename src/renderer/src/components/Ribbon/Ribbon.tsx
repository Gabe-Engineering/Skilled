import { useEffect, useRef, useState } from 'react'
import { useEditorState, type Editor } from '@tiptap/react'
import { redoDepth, undoDepth } from '@tiptap/pm/history'
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  Quote,
  SquareCode,
  Minus,
  Link as LinkIcon,
  Table as TableIcon,
  Undo2,
  Redo2,
  PanelRight,
  FileCode2,
  SpellCheck,
  Rows3,
  Columns3,
  Trash2,
  Save,
  RemoveFormatting
} from 'lucide-react'
import { useUiStore } from '@renderer/store/ui-store'
import { save, toggleSpell } from '@renderer/lib/actions'

interface RibbonProps {
  editor: Editor | null
}

function RibbonButton({
  label,
  active,
  disabled,
  onClick,
  children,
  wide
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
  wide?: boolean
}): React.JSX.Element {
  return (
    <button
      type="button"
      className={'rb' + (active ? ' active' : '') + (wide ? ' wide' : '')}
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function Group({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="ribbon-group">
      <div className="ribbon-group-body">{children}</div>
      <div className="ribbon-group-title">{title}</div>
    </div>
  )
}

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

// All six levels: a skill opened with `##### Notes` must not leave the select blank.
const HEADING_OPTIONS = [
  { value: 0, label: 'Normal' },
  ...([1, 2, 3, 4, 5, 6] as HeadingLevel[]).map((n) => ({ value: n, label: `Heading ${n}` }))
]

export function Ribbon({ editor }: RibbonProps): React.JSX.Element {
  const panelOpen = useUiStore((s) => s.panelOpen)
  const previewOpen = useUiStore((s) => s.previewOpen)
  const spellOn = useUiStore((s) => s.spellOn)
  const setPanelOpen = useUiStore((s) => s.setPanelOpen)
  const setPreviewOpen = useUiStore((s) => s.setPreviewOpen)

  const state = useEditorState({
    editor,
    selector: ({ editor: ed }) => {
      if (!ed) return null
      const heading = [1, 2, 3, 4, 5, 6].find((l) => ed.isActive('heading', { level: l })) ?? 0
      return {
        bold: ed.isActive('bold'),
        italic: ed.isActive('italic'),
        underline: ed.isActive('underline'),
        strike: ed.isActive('strike'),
        code: ed.isActive('code'),
        bullet: ed.isActive('bulletList'),
        ordered: ed.isActive('orderedList'),
        quote: ed.isActive('blockquote'),
        codeBlock: ed.isActive('codeBlock'),
        link: ed.isActive('link'),
        table: ed.isActive('table'),
        heading,
        // `ed.can().undo()` builds a throwaway command manager and chainable state on
        // every transaction; the history plugin already tracks the depths for free.
        canUndo: undoDepth(ed.state) > 0,
        canRedo: redoDepth(ed.state) > 0
      }
    }
  })

  const [linkOpen, setLinkOpen] = useState(false)
  const [linkHref, setLinkHref] = useState('')
  const linkInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editor) return
    const openLink = (): void => {
      setLinkHref((editor.getAttributes('link').href as string) || '')
      setLinkOpen(true)
    }
    const handler = (e: Event): void => {
      e.preventDefault()
      openLink()
    }
    window.addEventListener('skilled:link', handler)
    return () => window.removeEventListener('skilled:link', handler)
  }, [editor])

  useEffect(() => {
    if (linkOpen) linkInput.current?.focus()
  }, [linkOpen])

  if (!editor || !state) return <div className="ribbon" />

  const chain = (): ReturnType<Editor['chain']> => editor.chain().focus()

  const applyLink = (): void => {
    const href = linkHref.trim()
    if (!href) {
      chain().extendMarkRange('link').unsetLink().run()
    } else {
      const url = /^[a-z][a-z0-9+.-]*:/i.test(href) ? href : `https://${href}`
      if (editor.state.selection.empty && !editor.isActive('link')) {
        chain()
          .insertContent({
            type: 'text',
            text: url,
            marks: [{ type: 'link', attrs: { href: url } }]
          })
          .run()
      } else {
        chain().extendMarkRange('link').setLink({ href: url }).run()
      }
    }
    setLinkOpen(false)
  }

  return (
    <div className="ribbon">
      <Group title="File">
        <RibbonButton label="Save (Ctrl+S)" onClick={() => void save()}>
          <Save size={18} />
        </RibbonButton>
      </Group>
      <Group title="History">
        <RibbonButton
          label="Undo (Ctrl+Z)"
          disabled={!state.canUndo}
          onClick={() => chain().undo().run()}
        >
          <Undo2 size={18} />
        </RibbonButton>
        <RibbonButton
          label="Redo (Ctrl+Y)"
          disabled={!state.canRedo}
          onClick={() => chain().redo().run()}
        >
          <Redo2 size={18} />
        </RibbonButton>
      </Group>
      <Group title="Font">
        <RibbonButton
          label="Bold (Ctrl+B)"
          active={state.bold}
          onClick={() => chain().toggleBold().run()}
        >
          <Bold size={18} />
        </RibbonButton>
        <RibbonButton
          label="Italic (Ctrl+I)"
          active={state.italic}
          onClick={() => chain().toggleItalic().run()}
        >
          <Italic size={18} />
        </RibbonButton>
        <RibbonButton
          label="Underline (Ctrl+U)"
          active={state.underline}
          onClick={() => chain().toggleUnderline().run()}
        >
          <Underline size={18} />
        </RibbonButton>
        <RibbonButton
          label="Strikethrough"
          active={state.strike}
          onClick={() => chain().toggleStrike().run()}
        >
          <Strikethrough size={18} />
        </RibbonButton>
        <RibbonButton
          label="Inline code (Ctrl+E)"
          active={state.code}
          onClick={() => chain().toggleCode().run()}
        >
          <Code size={18} />
        </RibbonButton>
        <RibbonButton
          label="Clear formatting"
          onClick={() => chain().unsetAllMarks().clearNodes().run()}
        >
          <RemoveFormatting size={18} />
        </RibbonButton>
      </Group>
      <Group title="Styles">
        <select
          className="heading-select"
          aria-label="Paragraph style"
          value={state.heading}
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => {
            const level = Number(e.target.value)
            if (level === 0) chain().setParagraph().run()
            else
              chain()
                .setHeading({ level: level as HeadingLevel })
                .run()
          }}
        >
          {HEADING_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Group>
      <Group title="Paragraph">
        <RibbonButton
          label="Bullets"
          active={state.bullet}
          onClick={() => chain().toggleBulletList().run()}
        >
          <List size={18} />
        </RibbonButton>
        <RibbonButton
          label="Numbering"
          active={state.ordered}
          onClick={() => chain().toggleOrderedList().run()}
        >
          <ListOrdered size={18} />
        </RibbonButton>
        <RibbonButton
          label="Quote"
          active={state.quote}
          onClick={() => chain().toggleBlockquote().run()}
        >
          <Quote size={18} />
        </RibbonButton>
        <RibbonButton
          label="Code block"
          active={state.codeBlock}
          onClick={() => chain().toggleCodeBlock().run()}
        >
          <SquareCode size={18} />
        </RibbonButton>
        <RibbonButton label="Horizontal rule" onClick={() => chain().setHorizontalRule().run()}>
          <Minus size={18} />
        </RibbonButton>
      </Group>
      <Group title="Insert">
        <div className="link-anchor">
          <RibbonButton
            label="Link (Ctrl+K)"
            active={state.link}
            onClick={() => {
              setLinkHref((editor.getAttributes('link').href as string) || '')
              setLinkOpen((v) => !v)
            }}
          >
            <LinkIcon size={18} />
          </RibbonButton>
          {linkOpen && (
            <div className="link-popover" onMouseDown={(e) => e.stopPropagation()}>
              <input
                ref={linkInput}
                type="text"
                placeholder="https://…"
                value={linkHref}
                onChange={(e) => setLinkHref(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyLink()
                  if (e.key === 'Escape') setLinkOpen(false)
                }}
              />
              <button type="button" className="btn primary" onClick={applyLink}>
                {linkHref.trim() ? 'Apply' : 'Remove'}
              </button>
              <button type="button" className="btn" onClick={() => setLinkOpen(false)}>
                Cancel
              </button>
            </div>
          )}
        </div>
        <RibbonButton
          label="Table"
          active={state.table}
          onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        >
          <TableIcon size={18} />
        </RibbonButton>
        {state.table && (
          <>
            <RibbonButton label="Add row below" onClick={() => chain().addRowAfter().run()}>
              <Rows3 size={18} />
            </RibbonButton>
            <RibbonButton label="Add column after" onClick={() => chain().addColumnAfter().run()}>
              <Columns3 size={18} />
            </RibbonButton>
            <RibbonButton label="Delete row" onClick={() => chain().deleteRow().run()}>
              <span className="rb-text">−row</span>
            </RibbonButton>
            <RibbonButton label="Delete column" onClick={() => chain().deleteColumn().run()}>
              <span className="rb-text">−col</span>
            </RibbonButton>
            <RibbonButton label="Delete table" onClick={() => chain().deleteTable().run()}>
              <Trash2 size={18} />
            </RibbonButton>
          </>
        )}
      </Group>
      <Group title="View">
        <RibbonButton
          label="Properties (Ctrl+Shift+E)"
          active={panelOpen}
          onClick={() => setPanelOpen(!panelOpen)}
        >
          <PanelRight size={18} />
        </RibbonButton>
        <RibbonButton
          label="Preview SKILL.md (Ctrl+Shift+P)"
          active={previewOpen}
          onClick={() => setPreviewOpen(!previewOpen)}
        >
          <FileCode2 size={18} />
        </RibbonButton>
        <RibbonButton label="Spelling (F7)" active={spellOn} onClick={() => void toggleSpell()}>
          <SpellCheck size={18} />
        </RibbonButton>
      </Group>
    </div>
  )
}
