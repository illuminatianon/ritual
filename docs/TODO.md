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
- [ ] find/replace (as fluent an interface as possible, ideally similar to how vs code works but it doesn't need to be as complicated, can be case insensitive doesn't need regex etc)

## diffing

- [x] The diff panel should compare the current editor buffer against the version selected in the custom baseline picker. The picker defaults to the latest saved version and lists older versions newest-first.
- [x] brief flash in diff against the empty buffer when loading a song, sometimes it sticks diffing against honestly idk what it's diffing against, the whole diff is red so it thinks something is deleted

## architecture / spec debt

- [ ] Split the inline SQLite v1 migration into numbered migration files once the next schema change lands.
- [ ] Add a real native SQLite integration test strategy separate from the pure unit test suite.
- [ ] Decide whether shared API types should stay in `packages/backend/src/api.ts` or move to a small shared-types package as the IPC surface grows.
- [ ] Expand seeded CMUdict data or add a generation/import step for the full dictionary.
- [ ] Persist and expose global/song/line pronunciation overrides.
- [ ] Add word-click pronunciation/override popover.
- [ ] Add stress display modes.
- [ ] Add visible syllable split display.
- [ ] Add optional line numbers toggle.
- [ ] Add tabs/multiple open songs when the single-song workflow starts feeling cramped.
