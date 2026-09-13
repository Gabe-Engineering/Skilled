import { useEffect, useRef } from 'react'
import { useEditor, type Editor } from '@tiptap/react'
import { buildExtensions } from './extensions'
import { loadMarkdown, patchMarkdownManager, toMarkdown } from './markdown'
import { useDocStore } from '@renderer/store/document-store'
import { useUiStore } from '@renderer/store/ui-store'

const SYNC_DELAY_MS = 150

interface CharacterCountStorage {
  words?: () => number
}

/**
 * Owns the TipTap editor. Body changes flow editor -> store (debounced);
 * the store -> editor direction happens only when a document is (re)loaded,
 * signalled by `loadToken`.
 */
export function useSkillEditor(): Editor | null {
  const loadToken = useDocStore((s) => s.loadToken)
  const spellOn = useUiStore((s) => s.spellOn)
  const timer = useRef<number | null>(null)
  const loading = useRef(false)

  const editor = useEditor({
    extensions: buildExtensions(),
    editorProps: {
      attributes: {
        class: 'page-content',
        spellcheck: 'true',
        autocorrect: 'off',
        autocapitalize: 'off'
      }
    },
    onCreate: ({ editor: ed }) => {
      patchMarkdownManager(ed)
      loading.current = true
      loadMarkdown(ed, useDocStore.getState().doc.bodyMarkdown)
      loading.current = false
      syncWordCount(ed)
    },
    onUpdate: ({ editor: ed }) => {
      if (loading.current) return
      if (timer.current) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => {
        timer.current = null
        useDocStore.getState().setBody(toMarkdown(ed))
        syncWordCount(ed)
      }, SYNC_DELAY_MS)
    }
  })

  // Reload content when a new document is loaded or created.
  useEffect(() => {
    if (!editor) return
    if (timer.current) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
    loading.current = true
    loadMarkdown(editor, useDocStore.getState().doc.bodyMarkdown)
    loading.current = false
    syncWordCount(editor)
    editor.commands.focus('start')
  }, [editor, loadToken])

  // Mirror the spellcheck toggle on the contenteditable element.
  useEffect(() => {
    if (!editor) return
    editor.setOptions({
      editorProps: {
        attributes: {
          class: 'page-content',
          spellcheck: spellOn ? 'true' : 'false',
          autocorrect: 'off',
          autocapitalize: 'off'
        }
      }
    })
  }, [editor, spellOn])

  return editor
}

function syncWordCount(editor: Editor): void {
  const storage = (editor.storage as unknown as { characterCount?: CharacterCountStorage }).characterCount
  const words = storage?.words ? storage.words() : editor.getText().split(/\s+/).filter(Boolean).length
  useUiStore.getState().setWordCount(words)
}
