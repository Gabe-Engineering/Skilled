import { EditorContent, type Editor } from '@tiptap/react'

export function Canvas({ editor }: { editor: Editor | null }): React.JSX.Element {
  return (
    <div className="canvas" onMouseDown={(e) => {
      // Clicking the gray area below the page keeps the caret in the document.
      if (e.target === e.currentTarget && editor) {
        e.preventDefault()
        editor.commands.focus('end')
      }
    }}>
      <div className="page">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
