import { BrowserWindow, Menu, MenuItem } from 'electron'
import { IPC } from '@shared/ipc'
import { store } from './store'

/** A short, familiar list. Chromium supports far more; these are the common ones. */
const LANGUAGE_CHOICES: Array<[string, string]> = [
  ['en-US', 'English (United States)'],
  ['en-GB', 'English (United Kingdom)'],
  ['en-CA', 'English (Canada)'],
  ['en-AU', 'English (Australia)'],
  ['es', 'Spanish'],
  ['fr', 'French'],
  ['de', 'German'],
  ['pt-BR', 'Portuguese (Brazil)'],
  ['pt-PT', 'Portuguese (Portugal)'],
  ['it', 'Italian'],
  ['nl', 'Dutch']
]

export function setSpellLanguage(win: BrowserWindow, lang: string): string[] {
  const ses = win.webContents.session
  const available = ses.availableSpellCheckerLanguages
  const chosen = available.includes(lang) ? lang : 'en-US'
  ses.setSpellCheckerLanguages([chosen])
  store.set({ spellLang: chosen })
  win.webContents.send(IPC.spellChanged, { lang: chosen, enabled: store.get().spellcheckOn })
  return available
}

export function setSpellEnabled(win: BrowserWindow, enabled: boolean): void {
  win.webContents.session.setSpellCheckerEnabled(enabled)
  store.set({ spellcheckOn: enabled })
  win.webContents.send(IPC.spellChanged, { lang: store.get().spellLang, enabled })
}

function languageSubmenu(win: BrowserWindow): Menu {
  const ses = win.webContents.session
  const available = new Set(ses.availableSpellCheckerLanguages)
  const current = store.get().spellLang
  const menu = new Menu()
  for (const [code, label] of LANGUAGE_CHOICES) {
    if (!available.has(code)) continue
    menu.append(
      new MenuItem({
        label,
        type: 'radio',
        checked: code === current,
        click: () => setSpellLanguage(win, code)
      })
    )
  }
  return menu
}

/** Word-style right-click: spelling suggestions first, then clipboard actions. */
export function installContextMenu(win: BrowserWindow): void {
  win.webContents.on('context-menu', (_event, params) => {
    const menu = new Menu()
    const ses = win.webContents.session

    if (params.misspelledWord) {
      const suggestions = params.dictionarySuggestions.slice(0, 6)
      if (suggestions.length) {
        for (const s of suggestions) {
          menu.append(
            new MenuItem({ label: s, click: () => win.webContents.replaceMisspelling(s) })
          )
        }
      } else {
        menu.append(new MenuItem({ label: 'No spelling suggestions', enabled: false }))
      }
      menu.append(new MenuItem({ type: 'separator' }))
      menu.append(
        new MenuItem({
          label: 'Add to Dictionary',
          click: () => ses.addWordToSpellCheckerDictionary(params.misspelledWord)
        })
      )
      menu.append(new MenuItem({ type: 'separator' }))
    }

    if (params.isEditable) {
      menu.append(new MenuItem({ role: 'undo' }))
      menu.append(new MenuItem({ role: 'redo' }))
      menu.append(new MenuItem({ type: 'separator' }))
      menu.append(new MenuItem({ role: 'cut' }))
      menu.append(new MenuItem({ role: 'copy' }))
      menu.append(new MenuItem({ role: 'paste' }))
      menu.append(new MenuItem({ role: 'selectAll' }))
      menu.append(new MenuItem({ type: 'separator' }))
      const spellOn = store.get().spellcheckOn
      menu.append(
        new MenuItem({
          label: 'Check Spelling',
          type: 'checkbox',
          checked: spellOn,
          click: () => setSpellEnabled(win, !spellOn)
        })
      )
      menu.append(new MenuItem({ label: 'Spelling Language', submenu: languageSubmenu(win) }))
    } else if (params.selectionText) {
      menu.append(new MenuItem({ role: 'copy' }))
    }

    if (menu.items.length) menu.popup({ window: win })
  })
}
