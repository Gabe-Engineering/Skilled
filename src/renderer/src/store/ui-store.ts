import { create } from 'zustand'
import type { RecentEntry } from '@shared/ipc'

export interface Toast {
  id: number
  kind: 'info' | 'success' | 'error'
  message: string
  detail?: string
}

interface UiState {
  panelOpen: boolean
  previewOpen: boolean
  spellOn: boolean
  spellLang: string
  wordCount: number
  recentFiles: RecentEntry[]
  newDialogOpen: boolean
  aboutOpen: boolean
  toasts: Toast[]
  hydrated: boolean

  setPanelOpen: (v: boolean) => void
  setPreviewOpen: (v: boolean) => void
  setSpell: (on: boolean, lang?: string) => void
  setWordCount: (n: number) => void
  setRecentFiles: (r: RecentEntry[]) => void
  setNewDialogOpen: (v: boolean) => void
  setAboutOpen: (v: boolean) => void
  toast: (kind: Toast['kind'], message: string, detail?: string) => void
  dismissToast: (id: number) => void
  hydrate: (p: {
    panelOpen: boolean
    previewOpen: boolean
    spellOn: boolean
    spellLang: string
    recentFiles: RecentEntry[]
  }) => void
}

let toastSeq = 0

const MAX_TOASTS = 4
const timers = new Map<number, number>()

function clearTimer(id: number): void {
  const t = timers.get(id)
  if (t !== undefined) {
    window.clearTimeout(t)
    timers.delete(id)
  }
}

export const useUiStore = create<UiState>((set, get) => ({
  panelOpen: true,
  previewOpen: false,
  spellOn: true,
  spellLang: 'en-US',
  wordCount: 0,
  recentFiles: [],
  newDialogOpen: false,
  aboutOpen: false,
  toasts: [],
  hydrated: false,

  setPanelOpen: (v) => {
    set({ panelOpen: v })
    void window.skilled.setState({ panelOpen: v })
  },
  setPreviewOpen: (v) => {
    set({ previewOpen: v })
    void window.skilled.setState({ previewOpen: v })
  },
  setSpell: (on, lang) => set({ spellOn: on, spellLang: lang ?? get().spellLang }),
  setWordCount: (n) => {
    if (n !== get().wordCount) set({ wordCount: n })
  },
  setRecentFiles: (r) => set({ recentFiles: r }),
  setNewDialogOpen: (v) => set({ newDialogOpen: v }),
  setAboutOpen: (v) => set({ aboutOpen: v }),
  toast: (kind, message, detail) => {
    const id = ++toastSeq
    // A burst of export warnings should not bury the window.
    const kept = get().toasts.slice(-(MAX_TOASTS - 1))
    for (const t of get().toasts.slice(0, Math.max(0, get().toasts.length - (MAX_TOASTS - 1)))) {
      clearTimer(t.id)
    }
    set({ toasts: [...kept, { id, kind, message, detail }] })
    timers.set(
      id,
      window.setTimeout(() => get().dismissToast(id), kind === 'error' ? 8000 : 4000)
    )
  },
  dismissToast: (id) => {
    clearTimer(id)
    set({ toasts: get().toasts.filter((t) => t.id !== id) })
  },
  hydrate: (p) =>
    set({
      panelOpen: p.panelOpen,
      previewOpen: p.previewOpen,
      spellOn: p.spellOn,
      spellLang: p.spellLang,
      recentFiles: p.recentFiles,
      hydrated: true
    })
}))
