# Skilled

A Word-like editor for Claude Code skills. Type the instructions like a document, fill in a few properties on the side, and Skilled writes a ready-to-use skill folder:

```
<folder you pick>/
  <skill-name>/
    SKILL.md          # YAML frontmatter + your document as Markdown
    references/…      # optional attachments
    scripts/…
```

## What it does

- **Word feel**: ribbon, white page on a gray canvas, status bar, red-squiggle spell check with right-click suggestions (F7 toggles it). Follows the OS light/dark setting.
- **YAML figured out for you**: the properties panel derives `name` from your title and `description` from your first paragraph. Edit either to take over; the ↻ badge derives it again.
- **All the known frontmatter keys**: name, description, argument-hint, user-invocable, disable-model-invocation, model, allowed-tools. Anything else goes in the "Additional YAML" box.
- **Live checks**: kebab-case name, missing description, no "use when…" trigger phrasing, unused `$ARGUMENTS`, broken YAML.
- **Round-trips real skills**: open any existing SKILL.md, edit it visually, save it back. Tested against every skill in the official plugin marketplace.
- **Templates**: blank, slash command, reference/knowledge, workflow.
- **Preview**: see the exact SKILL.md text before saving (Ctrl+Shift+P).

Saving is export-only. Skilled never writes into `~/.claude` on its own; copy the exported folder into `~/.claude/skills/` (or a project's `.claude/skills/`) when you are happy with it.

## Shortcuts

| Action | Keys |
| --- | --- |
| New / Open / Save / Export As | Ctrl+N / Ctrl+O / Ctrl+S / Ctrl+Shift+S |
| Bold / Italic / Underline / Code | Ctrl+B / Ctrl+I / Ctrl+U / Ctrl+E |
| Headings | Ctrl+Alt+1 … 6 |
| Link | Ctrl+K |
| Properties panel / Preview | Ctrl+Shift+E / Ctrl+Shift+P |
| Spell check | F7 |

Press Alt to reveal the native menu bar.

## Development

Requires Node.js 22+.

```powershell
npm install
npm run dev          # run with hot reload
npm test             # vitest: frontmatter + markdown round-trip suites
npm run typecheck
npm run build:win    # NSIS installer + portable exe in dist/
```

### Layout

- `src/shared/` — pure TypeScript shared by main and renderer: SKILL.md parsing/serialization, validation, templates, Markdown text helpers, IPC contracts.
- `src/main/` — Electron main process: window, native menu, spell-check context menu, JSON settings store, file dialogs, skill read/export.
- `src/preload/` — the `window.skilled` bridge (contextIsolation on, no Node in the renderer).
- `src/renderer/` — React UI: TipTap editor with the official Markdown extension (plus fixes for list nesting, escaping, and unknown HTML tags), ribbon, properties panel, preview, status bar.
- `test/` — vitest suites; `test/fixtures/real/` holds copies of real marketplace skills used as round-trip fixtures.

Known limitations and the reasoning behind them live in [`issues.md`](issues.md).
