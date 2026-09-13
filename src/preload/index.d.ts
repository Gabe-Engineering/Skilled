import type { SkilledApi } from '../shared/ipc'

declare global {
  interface Window {
    skilled: SkilledApi
  }
}

export {}
