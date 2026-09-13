import { TitleBar } from './components/TitleBar'
import { Ribbon } from './components/Ribbon/Ribbon'
import { Canvas } from './components/Canvas'
import { PropertiesPanel } from './components/PropertiesPanel/PropertiesPanel'
import { PreviewPane } from './components/PreviewPane'
import { StatusBar } from './components/StatusBar'
import { NewDialog } from './components/NewDialog'
import { AboutDialog } from './components/AboutDialog'
import { Toasts } from './components/Toast'
import { useSkillEditor } from './editor/useSkillEditor'
import { useAppEvents } from './hooks/useAppEvents'
import { useShortcuts } from './hooks/useShortcuts'
import { useUiStore } from './store/ui-store'
import { useDocStore } from './store/document-store'
import * as actions from './lib/actions'

// Handy for debugging from DevTools: window.__skilled.doc.getState()
;(window as unknown as { __skilled: unknown }).__skilled = { doc: useDocStore, ui: useUiStore, actions }

export default function App(): React.JSX.Element {
  const editor = useSkillEditor()
  const panelOpen = useUiStore((s) => s.panelOpen)
  const previewOpen = useUiStore((s) => s.previewOpen)
  useAppEvents()
  useShortcuts()

  return (
    <div className="app">
      <TitleBar />
      <Ribbon editor={editor} />
      <div className="workspace">
        <Canvas editor={editor} />
        {previewOpen && <PreviewPane />}
        {panelOpen && <PropertiesPanel />}
      </div>
      <StatusBar />
      <NewDialog />
      <AboutDialog />
      <Toasts />
    </div>
  )
}
