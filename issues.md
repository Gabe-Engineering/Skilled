# Known issues

Problems found while end-to-end testing Skilled 0.1.0 that were **not** fixed in the
performance/UI pass, because each needs a design decision or a change too large to ride along
with it. Ordered roughly by how much they can hurt a user.

Everything here was reproduced against a real build (Electron 39, Windows 11, 1280×800 logical
at 150% scaling) and driven over the Chrome DevTools Protocol. Measurements are at the bottom.

---

## 1. Save can write the skill somewhere other than where it was opened

`src/renderer/src/lib/actions.ts:58-59`

```ts
const currentDir = dirname(filePath)
const destRoot = dirname(currentDir)
```

Save assumes the opened `SKILL.md` lives in `<parent>/<skill-name>/SKILL.md` and reconstructs the
export root by going up two levels. That holds for a skill folder, but not for these:

| Opened file | Where Save writes |
| --- | --- |
| `C:\skills\my-skill\SKILL.md` | `C:\skills\my-skill\SKILL.md` — correct |
| `C:\notes\SKILL.md` | `C:\my-skill\SKILL.md` — a sibling of `notes`, not `notes` |
| `C:\skills\old-name\SKILL.md` after renaming to `new-name` | `C:\skills\new-name\SKILL.md`, leaving `old-name` in place |

The collision check does warn before replacing an existing `SKILL.md`, so nothing is silently
destroyed — but the file lands in a folder the user never chose, and the title bar then points at
the new path as though that is where it always lived.

**Why it was left:** the fix is a product decision, not a patch. Options: remember the export root
that was actually picked as part of the document state; treat Save on a renamed skill as "rename
the folder" (moving the old one); or refuse and fall back to Export As when the folder name and the
skill name disagree. Any of them changes what Save means.

## 2. Renaming a skill leaves the old folder behind

A consequence of the above, but worth listing separately because it is the common case. Change
`name` from `foo` to `bar`, press Ctrl+S, and you now have two skill folders: `foo/` with the old
`SKILL.md` and `bar/` with the new one. Claude Code will load both.

**Why it was left:** deleting the old folder is destructive and export-only saving was a deliberate
product rule ("Skilled never writes into `~/.claude` on its own"). Moving a folder needs a
confirmation flow and an undo story.

## 3. A hung or crashed renderer makes the window impossible to close

`src/main/window.ts:134`

```ts
win.on('close', (e) => {
  if (forceClose) return
  e.preventDefault()
  win.webContents.send(IPC.appRequestClose, {})
})
```

Closing is always vetoed and then delegated to the renderer, which is supposed to ask about unsaved
changes and call back with `appCloseReply`. If the renderer never replies — a script error in the
close path, a wedged editor, a crashed renderer process — the reply never comes, the veto stands,
and the only way out is Task Manager. The same applies to Windows shutdown, which will report
Skilled as blocking it.

**Why it was left:** a timeout that force-closes is easy to write but picks a number that decides
whether a user loses unsaved work. It also wants pairing with `render-process-gone` handling and a
"Skilled is not responding — close anyway?" dialog, which is a feature rather than a fix.

## 4. Markdown fidelity depends on patching TipTap's private internals

`src/renderer/src/editor/markdown.ts:17-56`

`patchMarkdownManager` reaches into `editor.markdown` and replaces `isUnrecognizedHtml` and
`encodeTextForMarkdown`, and `repairParsed` re-implements part of the parser's list handling by
calling `tokenizeInline`/`parseInlineTokens`. `src/renderer/src/editor/extensions.ts` additionally
wraps the ordered-list tokenizer to correct a column-counting bug.

These are real fixes for real bugs — without them exports contain `Bash(git \*)` and lose
`<placeholder>` text, and nested list content drifts one column right on every save. But none of it
is public API. A `@tiptap/markdown` patch release can rename any of these and the failure mode is
silent: exports keep working but get subtly worse, and the round-trip suite is the only thing that
would catch it.

**Why it was left:** the durable fix is to stop using the extension's serializer and own the
Markdown layer outright (or upstream the fixes). Both are substantial.

**Mitigation that already exists:** `test/markdown-roundtrip.test.ts` round-trips every skill in
`test/fixtures/real/` and asserts idempotence plus plain-text equality. Keep it green on every
TipTap upgrade and treat a failure there as a release blocker.

## 5. No autosave and no crash recovery

Saving is export-only and entirely manual. Nothing is written anywhere until the user picks a
folder, so an Electron crash, a power loss, or "Don't Save" clicked by accident loses everything
typed so far. The window-state store (`skilled-state.json`) persists panel layout and recent files
but never document content.

**Why it was left:** it needs a scratch-file format, a recovery prompt at startup, and a decision
about where drafts live — none of which should be invented inside a performance pass. Note that the
obvious location (`~/.claude`) is ruled out by the project's export-only rule; `app.getPath('userData')`
is the right home.

## 6. Large documents degrade, and there is no ceiling

The whole document is a single ProseMirror tree with no virtualization. Measured on the largest
real marketplace skill available (`command-development.md`, 20 KB / 884 lines):

- `setContent(markdown)` on open: **84 ms**
- `editor.getMarkdown()` on each debounced sync: **3.4 ms**
- 745 DOM nodes

That is fine. But the cost is linear in document size with no relief valve, and skills that embed
large reference tables or long code listings will hit it. A 200 KB skill would spend roughly a
second parsing on open and ~35 ms per sync tick, which is past the point where typing feels
attached to the keyboard.

**Why it was left:** the fixes are architectural — incremental Markdown serialization (serialize
only changed blocks), or moving serialization to a worker. Both are worth doing before the app is
pointed at anything much larger than a marketplace skill.

## 7. Undo does not survive opening a document

`src/renderer/src/editor/useSkillEditor.ts:54-65`

Every `loadToken` bump calls `loadMarkdown`, which replaces the whole document via `setContent`.
ProseMirror's history plugin keeps its undo stack across that, so the replacement is just another
undoable step.

Reproduced by opening one skill, then another, then pressing Undo once:

```
undo button enabled right after Open : true
document text before undo            : "Beta Skill  Use when the user asks about beta."
document text after undo             : "Alpha Skill Use when the user asks about alpha."
Name field after undo                : ""          <- was "beta"
```

So a single Ctrl+Z after an Open pulls back the *previous* skill's text, and the app is left
genuinely inconsistent: the page shows `alpha`'s content, the Name field is empty, and `filePath`
still points at `beta`'s folder. Saving from that state would try to write alpha's text into beta's
directory (validation blocks it only because the name went blank).

**Why it was left:** clearing history on load is a one-liner but wrong on its own — it also throws
away undo for New-from-template, where users reasonably expect Ctrl+Z to undo their first edits.
Doing it properly means the editor has to know about document *identity*, not just text, so that
history is scoped per open document.

## 8. Attachments are tracked, never reconciled

`src/main/services/skill-io.ts:105-124`

- Export copies attachments into the skill folder but never deletes anything. Removing an attachment
  from the list (now possible — it was not before this pass) leaves the file on disk.
- An attachment that came from an opened skill (`origin: 'existing'`) cannot be moved between
  `references/`, `scripts/` and `assets/`; the folder select is disabled for it, because "move" would
  mean a real file operation rather than a copy.
- `SKILL.md` is written atomically (temp file + rename), but the attachment copies that follow are
  not part of that transaction. A failure partway through — a locked file, a full disk — leaves a
  skill folder with a new `SKILL.md` and a half-copied set of files, and the error surfaces as a
  toast after the fact.

**Why it was left:** deleting user files needs an explicit, confirmed gesture and a clear statement
of what is about to be removed. Making the whole export transactional means staging into a temp
directory and swapping, which changes the on-disk behaviour the overwrite dialog currently promises
("Other files in that folder are kept").

## 9. Spell-check offers 11 languages out of 56

`src/main/context-menu.ts:6-18`

`LANGUAGE_CHOICES` is a hardcoded list. Chromium reports 56 available dictionaries on this machine
(`availableSpellCheckerLanguages`), and the submenu filters the hardcoded list against it, so a user
whose language is installed but not listed — Polish, Swedish, Turkish, any of the other 45 — has no
way to select it. Spell check is a stated core requirement of the app, which makes this worse than
it looks.

**Why it was left:** trivial to widen the list, but the right fix is to build the menu from
`availableSpellCheckerLanguages` with proper display names (`Intl.DisplayNames`) and to decide how a
56-item menu should be presented — flat, grouped, or searchable.

## 10. Recent-file paths are compared case-insensitively

`src/main/store.ts:56,62,64`

```ts
normalize(r.path).toLowerCase() !== path.toLowerCase()
```

Correct on Windows. On a case-sensitive filesystem, `~/skills/Notes/SKILL.md` and
`~/skills/notes/SKILL.md` are different files that would collapse into one recent entry, and
removing one would remove the other. `electron-builder.yml` configures `mac` and `linux` targets, so
this is reachable.

**Why it was left:** it is only correct to fix together with a platform check, and there is no
macOS/Linux build to test against yet. Filed so it is not discovered by a user.

## 11. No tests cover the UI

`test/` covers `src/shared` (frontmatter parsing, Markdown round-trip, autofill) and, as of this
pass, the renderer document store. Nothing covers the main process, IPC, the editor wiring, or any
component. Every finding in this document was found by driving the running app over CDP by hand;
none of it would have been caught by `npm test`.

**Why it was left:** it needs a harness choice (Playwright's `_electron` is the obvious one) and CI
plumbing. Worth doing — the main process in particular has file-writing code paths that are
currently only exercised by hand.

## 12. The renderer bundle is still ~920 KB

Down from 2.29 MB in this pass (minification was off entirely; the syntax-highlighting grammar set
was trimmed from 35 languages to 12). What remains is TipTap + ProseMirror (520 KB) and the app
itself (325 KB), all evaluated before the first paint.

**Why it was left:** the next step is to render the chrome first and load the editor chunk behind
it, which means the app must have a sensible "editor not ready yet" state. That is a real UX change.

---

## Appendix: how the numbers above were measured

The app was launched with `--remote-debugging-port=9222` and driven over CDP (per
`skilled-dev-environment`: the window is DPI-scaled, so CDP `Page.captureScreenshot` is the reliable
way to see it). Two traps worth knowing for anyone repeating this:

- **`requestAnimationFrame` never fires** when the Electron window is occluded (`document.hidden`
  is `true`), so frame-time measurements silently return zero samples. Measure synchronous cost
  instead, or bring the window genuinely to the foreground.
- **`setTimeout` is clamped to 1 s** in a backgrounded renderer unless Electron is started with
  `--disable-background-timer-throttling --disable-renderer-backgrounding
  --disable-backgrounding-occluded-windows`. An early run of these benchmarks reported ~1 s per
  document update purely because of this.

Per-keystroke costs on the 20 KB document, from a V8 CPU profile (`Profiler.start`/`stop`,
100 µs sampling) over 300 insertions:

| Work | Cost | When it runs |
| --- | --- | --- |
| `editor.getMarkdown()` | 3.36 ms | every 150 ms sync tick while typing |
| `editor.can().undo()` + `.redo()` | 0.15 ms | **every ProseMirror transaction** — fixed in this pass |
| 12 × `editor.isActive(...)` | 0.02 ms | every transaction |
| `characterCount.words()` | 0.24 ms | every sync tick |
| `store.setBody` (autofill + validate) | 0.14 ms | every sync tick |

`createCan`, `createChainableState` and `get commands` together dominated the app's own profile
share, which is what `undoDepth`/`redoDepth` replaced.
