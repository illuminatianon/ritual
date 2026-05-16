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

## architecture / spec debt

All previously-listed items are now reflected in the spec docs — see `architecture.md` (migrations, native integration tests, shared types) and `syllable-engine.md` (CMUdict dictionary data, overrides, popover, stress, splits) and `lyrics-editor-design.md` (line numbers toggle, tabs).
