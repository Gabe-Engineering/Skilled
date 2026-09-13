import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import type { PersistedState, RecentEntry } from '@shared/ipc'

const DEFAULTS: PersistedState = {
  recentFiles: [],
  spellLang: 'en-US',
  spellcheckOn: true,
  panelOpen: true,
  previewOpen: false
}

const MAX_RECENTS = 10

/** Tiny JSON store in userData. Debounced writes, atomic rename. */
class Store {
  private state: PersistedState = { ...DEFAULTS }
  private file = ''
  private timer: NodeJS.Timeout | null = null
  private listeners = new Set<() => void>()

  init(): void {
    this.file = join(app.getPath('userData'), 'skilled-state.json')
    try {
      if (existsSync(this.file)) {
        const raw = JSON.parse(readFileSync(this.file, 'utf8')) as Partial<PersistedState>
        this.state = { ...DEFAULTS, ...raw, recentFiles: Array.isArray(raw.recentFiles) ? raw.recentFiles : [] }
      }
    } catch {
      this.state = { ...DEFAULTS }
    }
  }

  get(): PersistedState {
    return { ...this.state, recentFiles: [...this.state.recentFiles] }
  }

  set(patch: Partial<PersistedState>): void {
    this.state = { ...this.state, ...patch }
    this.scheduleWrite()
    this.listeners.forEach((l) => l())
  }

  addRecent(entry: RecentEntry): void {
    const rest = this.state.recentFiles.filter((r) => r.path.toLowerCase() !== entry.path.toLowerCase())
    this.set({ recentFiles: [entry, ...rest].slice(0, MAX_RECENTS) })
  }

  removeRecent(path: string): void {
    this.set({ recentFiles: this.state.recentFiles.filter((r) => r.path.toLowerCase() !== path.toLowerCase()) })
  }

  clearRecents(): void {
    this.set({ recentFiles: [] })
  }

  onChange(cb: () => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  private scheduleWrite(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => this.flush(), 300)
  }

  flush(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    if (!this.file) return
    try {
      mkdirSync(dirname(this.file), { recursive: true })
      const tmp = this.file + '.tmp'
      writeFileSync(tmp, JSON.stringify(this.state, null, 2), 'utf8')
      renameSync(tmp, this.file)
    } catch {
      // Losing window state is not worth crashing over.
    }
  }
}

export const store = new Store()
