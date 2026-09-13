import { useEffect } from 'react'
import { useDocStore } from '@renderer/store/document-store'
import { useUiStore } from '@renderer/store/ui-store'
import { exportAs, handleCloseRequest, openSkill, save, showInFolder, startNew, toggleSpell } from '@renderer/lib/actions'

/** Wires main-process menu actions, close requests, spell changes, and persisted state. */
export function useAppEvents(): void {
  useEffect(() => {
    const api = window.skilled
    const ui = useUiStore.getState()

    void api.getState().then((s) => {
      ui.hydrate({
        panelOpen: s.panelOpen,
        previewOpen: s.previewOpen,
        spellOn: s.spellcheckOn,
        spellLang: s.spellLang,
        recentFiles: s.recentFiles
      })
    })

    const offMenu = api.onMenu(({ action, arg }) => {
      const u = useUiStore.getState()
      switch (action) {
        case 'new':
          void startNew()
          break
        case 'open':
          void openSkill()
          break
        case 'open-recent':
          if (arg) void openSkill(arg)
          break
        case 'save':
          void save()
          break
        case 'export-as':
          void exportAs()
          break
        case 'show-in-folder':
          showInFolder()
          break
        case 'toggle-panel':
          u.setPanelOpen(!u.panelOpen)
          break
        case 'toggle-preview':
          u.setPreviewOpen(!u.previewOpen)
          break
        case 'toggle-spell':
          void toggleSpell()
          break
        case 'about':
          u.setAboutOpen(true)
          break
      }
    })

    const offClose = api.onRequestClose(() => {
      void handleCloseRequest()
    })

    const offSpell = api.onSpellChanged(({ lang, enabled }) => {
      useUiStore.getState().setSpell(enabled, lang)
    })

    return () => {
      offMenu()
      offClose()
      offSpell()
    }
  }, [])

  // Keep the native window title in sync with the document.
  const name = useDocStore((s) => s.doc.frontmatter.name)
  const dirty = useDocStore((s) => s.dirty)
  useEffect(() => {
    void window.skilled.setDirty(dirty, name || 'Untitled')
  }, [name, dirty])
}
