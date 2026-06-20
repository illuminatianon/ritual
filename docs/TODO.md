# TODO

## Minor issues

- [x] Don't show meter count for empty lines

## ui

### statusbar

- [x] move version & dirty indicator into the header.
- [x] remove song title from status bar

### editor header

- [x] remove text: "EDITOR"
- [x] put version & dirty indicator under title

### library panel

- [x] should show the latest version and last updated date (if we have it, if we don't we should)
- [x] separate LIBRARY from app title, something like

  ```
  Ritual
  -------------
  LIBRARY   [+]
  ```

## workflow

- [x] new song flow: default to "Untitled Song", no popup to collect name. move that to first save
- [x] dirty check when creating a new song/restoring is possibly broken. getting unsaved changes popup even if the buffer is new
  - steps were:
    1. Delete test song, this loaded the previous song into editor
    2. Restore test song, get "Unsaved changes popup"
  - confirmed: a freshly loaded song is considered dirty
  - undo state management
- [x] find/replace (as fluent an interface as possible, ideally similar to how vs code works but it doesn't need to be as complicated, can be case insensitive doesn't need regex etc)

## diffing

- [x] The diff panel should compare the current editor buffer against the version selected in the custom baseline picker. The picker defaults to the latest saved version and lists older versions newest-first.
- [x] brief flash in diff against the empty buffer when loading a song, sometimes it sticks diffing against honestly idk what it's diffing against, the whole diff is red so it thinks something is deleted

## ui overhaul — phase 1 (VSCode-like shell)

Design decisions:
- Sidebar collapses to a slim ~42px strip (click strip to expand; `‹` chevron inside sidebar to collapse)
- Toolbar + song-header merge into a single **editor header row** inside the workspace
- Buttons live inside the editor area (tab-ready for future multi-song tabs)
- Button labels tightened: `Save v{n}`, `↑ v{n}` / `↑ draft`, `Suno`, `Chat`, `Words`
- Status bar stays; diff panel unchanged; dialogs unchanged

Layout sketch:
```
┌──────────────┬────────────────────────────────────────────┬──────────────────┐
│ Ritual    [‹]│  i see you · v6 (unsaved)                  │  v6: refine      │
│ ──────────── │  [Save v7] [↑v6] [Suno] [Chat] [□Words]   │  ─────────────── │
│ LIBRARY   [+]│              [Rename] [Archive]             │  diff output     │
│ ────────────  │ ──────────────────────────────────────────│                  │
│ i see you    │         editor                             │  [Delete v6]     │
│ v6 · 5/16    │                                            │                  │
│              │                                            │                  │
│ familiar     │                                            │                  │
│ [Archived ▸] │                                            │                  │
└──────────────┴────────────────────────────────────────────┴──────────────────┘

Sidebar collapsed (~42px strip):
┌──┬──────────────────────────────────────────────────────┬──────────────────┐
│R │  i see you · v6   [Save v7] [↑v6] [Suno] [Chat] ... │  diff panel      │
│+ │         editor                                       │                  │
└──┴──────────────────────────────────────────────────────┴──────────────────┘
```

Tasks:
- [ ] Add `sidebarOpen` state to `App.vue`; drive `grid-template-columns` (260px vs 42px)
- [ ] Update `Sidebar.vue`: add `‹` collapse button (emits `collapse`); slim-strip mode when collapsed prop is passed
- [ ] Delete `Toolbar.vue`; merge its button logic into a new `.editor-header` bar in `App.vue`
- [ ] Replace `.toolbar` + `.song-header` CSS with `.editor-header` (single row, flex)
- [ ] Shorten all button labels as above
- [ ] Update `workspace` grid rows: `auto auto 1fr auto` → `auto 1fr auto` (header, editor, statusbar)

## architecture / spec debt

All previously-listed items are now reflected in the spec docs — see `architecture.md` (migrations, native integration tests, shared types) and `syllable-engine.md` (CMUdict dictionary data, overrides, popover, stress, splits) and `lyrics-editor-design.md` (line numbers toggle, tabs).
