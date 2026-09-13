import { EditorContent, type Editor } from '@tiptap/react'

export function Canvas({ editor }: { editor: Editor | null }): React.JSX.Element {
  // Clicking the gray canvas or the page's own margins keeps the caret in the
  // document, the way clicking a Word margin does. Clicks that land on the text
  // itself fall through to ProseMirror untouched.
  const focusDocument = (e: React.MouseEvent): void => {
    if (!editor) return
    const target = e.target as HTMLElement
    if (target.closest('.page-content')) return
    e.preventDefault()
    editor.commands.focus('end')
  }

  return (
    <div className="canvas" onMouseDown={focusDocument}>
      <div className="page">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
