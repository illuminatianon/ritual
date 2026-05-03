# TODO

## Minor issues

- [ ] Don't show meter count for empty lines

## ui

### statusbar

- [ ] move version & dirty indicator into the header.
- [ ] remove song title from status bar

### editor header

- [ ] remove text: "EDITOR"
- [ ] put version & dirty indicator under title

### library panel

- [ ] should show the latest version and last updated date (if we have it, if we don't we should)
- [ ] separate LIBRARY from app title, something like

  ```
  Ritual
  -------------
  LIBRARY   [+]
  ```

## workflow

- [ ] new song flow: default to "Untitled Song", no popup to collect name. move that to first save
- [ ] dirty check when creating a new song/restoring is possibly broken. getting unsaved changes popup even if the buffer is new
  - steps were:
    1. Delete test song, this loaded the previous song into editor
    2. Restore test song, get "Unsaved changes popup"
  - confirmed: a freshly loaded song is considered dirty
  - undo state management
  - find/replace (as fluent an interface as possible, ideally similar to how vs code works but it doesn't need to be as complicated, can be case insensitive doesn't need regex etc)

## diffing

- [ ] The diff panel should compare the current editor buffer against the version selected in the dropdown. The “Against previous” label can be removed because the dropdown itself defines the baseline. The dropdown should default to the previous version of the current editor state, and after saving a new version it should update to that new previous version. Right now it appears to stay pointed at the old baseline after save, so the diff panel continues showing the old v2-v1 diff instead of the current buffer’s changes against the latest saved baseline.
