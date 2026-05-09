# Editor — CodeMirror Setup & Diff Recompute

Covers the CodeMirror 6 editor, its custom extensions, how it connects to the syllable engine and the song store, and how the diff panel updates.

## Editor Responsibilities

1. Render lyrics text. Line wrapping **off** — long lines stay on one line.
2. Style section tags (`[Verse]`, `[Chorus]`, etc.) distinctly.
3. Show line syllable count in the gutter (always on).
4. Show section total next to each section tag (small chip).
5. Show per-word syllable chips (toggleable via toolbar).
6. Report dirty state to the song store.
7. Expose read/reset hooks so the store can save and load text.

Not in scope: code-style syntax highlighting, autocomplete, folding, line numbers (deferred).

## Theme

Dark only. CM6's `@codemirror/theme-one-dark` is a reasonable starting point; override via CSS for the bits the app cares about (section tag styling, syllable chips, gutter). If a light theme is ever needed for users-other-than-self, it's a CSS-only addition; nothing in the editor architecture forces dark.

## Extension Composition

Six custom extensions, each with one job. Plus stock CM6 extensions: keymap, history, dark theme.

```
sectionRangesField        StateField  → list of detected sections, derived from doc
syllableField             StateField  → per-line + per-word counts, reads sectionRangesField
lineSyllableGutter        Gutter      → reads syllableField, renders line totals
sectionDecorations        ViewPlugin  → styles tag lines, renders section total chips
wordChipDecorations       ViewPlugin  → renders per-word chips (toggleable via Compartment)
dirtyReporter             ViewPlugin  → fires callbacks on doc change (store + diff panel)
```

### Why this split

Section detection and syllable counting are derived from the doc and used by multiple consumers. Putting them in `StateField`s means the work happens **once per doc change**, and gutter/decoration code reads cached results at render time. CM6 calls `lineMarker` and decoration builders frequently; cheap reads keep them snappy.

Rule of thumb: **heavy work in StateFields, cheap reads in render-time code.**

## Section Detection

```ts
type SectionRange = {
  tag: string;        // "Verse 1", "Chorus", etc.
  tagLine: number;    // 0-indexed line number of the [tag] line
  fromLine: number;   // first content line (tagLine + 1)
  toLine: number;     // last content line (exclusive of next tag)
};

const sectionRangesField = StateField.define<SectionRange[]>({
  create(state) { return computeSections(state.doc); },
  update(value, tr) {
    if (!tr.docChanged) return value;
    return computeSections(tr.state.doc);
  },
});
```

`computeSections` scans the doc with a regex (starting point: `/^\[(.+)\]$/` — bracketed content alone on a line). Tightening this is an open question (see below).

Recomputing the entire doc on every change is fine — even long songs are a few hundred lines.

## Syllable Counts

```ts
type LineCounts = {
  total: number;
  words: Array<{ from: number; to: number; count: number; source: 'cmu' | 'heuristic' }>;
  isSection: boolean;
};

const syllableField = StateField.define<LineCounts[]>({
  create(state) { return computeAllLines(state); },
  update(value, tr) {
    if (!tr.docChanged) return value;
    return computeAllLines(tr.state);
  },
});
```

`computeAllLines` calls `countLine` from `syllable-engine` for non-section lines, marks section lines with `isSection: true` and `total: 0`. Reads `sectionRangesField` to know which lines to skip.

## Gutter

```ts
class SyllableMarker extends GutterMarker {
  constructor(private count: number) { super(); }
  toDOM() {
    const el = document.createElement('span');
    el.className = 'cm-syllable-count';
    el.textContent = String(this.count);
    return el;
  }
}

const lineSyllableGutter = gutter({
  lineMarker(view, line) {
    const counts = view.state.field(syllableField);
    const lineNum = view.state.doc.lineAt(line.from).number - 1;
    const lc = counts[lineNum];
    return !lc || lc.isSection || lc.total === 0 ? null : new SyllableMarker(lc.total);
  },
});
```

## Section Tag Styling + Total Chip

A `ViewPlugin` produces decorations from `sectionRangesField` + `syllableField`:
- Mark decoration with class `cm-section-tag` on each tag line (CSS handles dimmer/italic).
- Widget decoration after the closing `]` rendering the section's total syllable count as a chip.

```ts
const sectionDecorations = ViewPlugin.fromClass(class {
  decorations: DecorationSet;
  constructor(view: EditorView) { this.decorations = build(view); }
  update(u: ViewUpdate) {
    if (u.docChanged || u.viewportChanged) this.decorations = build(u.view);
  }
}, { decorations: v => v.decorations });
```

`build()` reads both StateFields, returns a `DecorationSet`.

## Word Chips (Toggleable)

Same ViewPlugin pattern, gated on a `Compartment` so the toolbar can toggle without remounting the editor.

```ts
const wordChipsCompartment = new Compartment();

// initial extensions
[
  ...,
  wordChipsCompartment.of(prefs.showWordAnnotations ? wordChipDecorations : []),
];

// toggle from Vue
view.dispatch({
  effects: wordChipsCompartment.reconfigure(
    enabled ? wordChipDecorations : []
  ),
});
```

Chip rendering: small visually-quiet element after each word (e.g. `gently ⟨2⟩`). Exact styling is a CSS pass during build.

## Dirty Reporter

```ts
function dirtyReporter(opts: {
  onDirty: (dirty: boolean) => void;
  onActivity: () => void;
}) {
  return ViewPlugin.fromClass(class {
    update(u: ViewUpdate) {
      if (u.docChanged) {
        opts.onDirty(true);
        opts.onActivity();
      }
    }
  });
}
```

Fires on every doc change. Two callbacks because two consumers care:
- The song store (sets dirty flag).
- The diff panel (resets the activity timer — see below).

Save actions explicitly call `onDirty(false)` after a successful save.

## Store ↔ Editor Bridge

The store doesn't mirror text. It holds a reference to the live `EditorView` plus a reset callback that rebuilds CodeMirror state for app-driven document loads.

```ts
// useSongStore (additions)
type SongState = {
  // ...
  view: EditorView | null;       // set when editor mounts
  resetEditorDocument: ((lyrics: string) => void) | null;
};

actions: {
  registerView(songId: number, view: EditorView, resetEditorDocument: (lyrics: string) => void) {
    this.byId[songId].view = view;
    this.byId[songId].resetEditorDocument = resetEditorDocument;
  },
  unregisterView(songId: number) {
    this.byId[songId].view = null;
    this.byId[songId].resetEditorDocument = null;
  },

  getCurrentText(songId: number): string {
    return this.byId[songId].view?.state.doc.toString() ?? '';
  },

  loadVersion(songId: number, versionId: number) {
    const v = this.byId[songId].versions.find(x => x.id === versionId)!;
    this.byId[songId].resetEditorDocument?.(v.lyrics);
    this.byId[songId].loadedVersionId = versionId;
    this.byId[songId].dirty = false;
  },

  async saveBumpVersion(songId: number, label?: string) {
    const lyrics = this.getCurrentText(songId);
    const version = await window.api.versions.save({ songId, lyrics, label });
    this.byId[songId].versions.push(version);
    this.byId[songId].loadedVersionId = version.id;
    this.byId[songId].dirty = false;
  },
};
```

`EditorPane.vue` calls `registerView` on mount, `unregisterView` on unmount, and passes the dirty/activity callbacks into the extension list. Programmatic loads rebuild editor state; user edits still flow through the dirty reporter.

## Diff Recompute (Activity-Driven)

Diffing every keystroke is wasteful. Diffing only on save misses the "what am I changing right now" feeling. Compromise: refresh on a **2s interval while there's editing activity**, with a grace period after activity stops.

```ts
// In DiffPanel.vue or a composable
const REFRESH_MS = 2000;
const GRACE_MS = 15_000;

let intervalId: number | null = null;
let lastActivityAt = 0;

function onActivity() {
  lastActivityAt = Date.now();
  if (intervalId == null) {
    computeAndRender();                  // immediate first paint
    intervalId = window.setInterval(tick, REFRESH_MS);
  }
}

function tick() {
  if (Date.now() - lastActivityAt > GRACE_MS) {
    window.clearInterval(intervalId!);
    intervalId = null;
    return;
  }
  computeAndRender();
}
```

### Trigger Sources

```
explicit (immediate compute):
  - song opened
  - diff target version changed
  - save (bump or overwrite) completed
  - editor document becomes ready after a programmatic load

activity-driven (interval while typing):
  - dirtyReporter onActivity() callback
  - interval shuts off after GRACE_MS of no activity
```

### Tuning

- `REFRESH_MS` (2s) — fast enough to feel live, slow enough to not flicker.
- `GRACE_MS` (15s) — long enough that "user paused to think" doesn't cause stale diff. Cost of being too long is one extra timer fire.

Both values are knobs to tweak after real use.

## Open Questions

- **Section tag regex.** `/^\[(.+)\]$/` is the starting point. Should bracketed text mid-line ever count as a tag? Probably not — keeps things predictable. Decide while building.
- **Heuristic vs. CMU source visual cue.** Engine returns `source` per word; whether to surface this in the chip rendering is deferred until overrides exist.
- **Diff render style.** Inline unified diff is the current MVP choice.
- **Word boundary detection for chips.** Splitting on whitespace works for most cases but punctuation (`don't`, `rock'n'roll`) needs care. Engine's tokenizer should be the authority; the chip decoration walks the engine's word ranges, not its own regex.
