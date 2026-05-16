# Syllable Engine — Design Doc

## Purpose

Provides syllable, stress, and pronunciation information for the lyrics editor:

- Per-word syllable counts (toolbar-toggleable inline annotations).
- Per-line totals (always-on gutter).
- Per-section totals (next to section tags).
- Stress patterns for meter/rhythm guidance (later).
- Optional visible syllable splits inside words (later).

Section tag lines (`[Verse]`, `[Chorus]`, etc.) are excluded from counting.

## Package Shape

Lives at `packages/syllable-engine/`. Self-contained workspace package, imported by `frontend/` as `syllable-engine`. Bundled into the renderer at build time.

### Dependencies

- CMUdict data (bundled in `data/cmudict.json`).
- Optionally `syllable` (npm) for the heuristic fallback path.

### Dictionary Data

MVP ships a small seeded subset of CMUdict checked into `data/cmudict.json` — enough to exercise the lookup path during development. Before the engine is useful for real writing it needs the full dictionary, via one of:

- **Bundle the full CMUdict** as a generated JSON asset (~3–4 MB raw, smaller compressed). Add a build step that ingests the upstream CMUdict source and emits the JSON the engine loads.
- **Import on first run** from a packaged data file unpacked at app start.

Either way, the engine's public API doesn't change — `loadDict()` continues to be the single entry point. The generation/import step is what's missing.

### Does not depend on

- Electron, IPC, `window.api` — none of it. The engine has no awareness it runs in a renderer.
- Vue, CodeMirror, the DOM. The engine returns data; turning data into pixels is the UI's job.
- SQLite or the filesystem. The engine is pure: same input, same output.

### Public API (sketch)

```ts
// packages/syllable-engine/src/index.ts
export function loadDict(): Promise<void>;
export function setUserDictionary(entries: CustomWordEntry[]): void;
export function countLine(text: string, opts?: CountOptions): LineResult;
export function countWord(word: string, opts?: CountOptions): WordResult;
export function analyzeWord(word: string): WordAnalysis;  // for popover, later
```

Two pieces of internal state, both set-once-read-many: the loaded CMUdict and the user dictionary. Song-scoped and line-scoped overrides remain per-call via `CountOptions` since they vary frequently.

### Override Handling

The engine **applies** overrides but does not **store** them. Persistent overrides (song-scoped, line-scoped) live in the SQLite DB and are owned by the backend. Callers pass relevant overrides into `countLine` / `countWord` via `CountOptions`. This keeps the engine pure and stateless.

```ts
type CountOptions = {
  songOverrides?: CustomWordEntry[];
  lineOverrides?: CustomWordEntry[];
};
```

Global / user-dictionary overrides are loaded once via `setUserDictionary()` and applied internally; they don't appear in `CountOptions`.

## Accuracy Stance

This is a writing aid, not a strict validator. ~90–95% accuracy is fine. The user (a songwriter) will catch and correct edge cases via overrides. The app should be **helpful, not dogmatic** — CMUdict gives the app confidence; custom overrides give the artist authority.

## Two-Layer Architecture

Syllable count and visible written splits are related but separate concerns. Keep them in different layers.

### Pronunciation Layer (CMUdict)

CMUdict tells us:
- Phonemes
- Syllable count (derived from vowel phoneme count)
- Stress pattern
- Alternate pronunciations

### Display / Spelling Layer (Heuristic)

CMUdict does **not** tell us how to split the written word visually. `CROOKED` has 2 spoken syllables but the visual split `[CROOK][ED]` requires a spelling-alignment heuristic, count-guided by the CMU number.

A user may not care about phonemes at all. They may just want the editor to show `[heav'n]` or `[ev][ry]` and count it correctly. The display layer must be independently overridable.

## CMUdict Background

Entries look like:

```
CROOKED  K R UH1 K AH0 D
```

Format: `WORD  PHONEME PHONEME ...` using ARPABET phonemes.

### Stress Digits

Vowel phonemes carry stress digits:

- `0` = unstressed / weak
- `1` = primary stress
- `2` = secondary stress

### Syllable Count Rule

Each vowel phoneme = one syllable nucleus. So:

```ts
const syllableCount = phones.filter(p => /[012]$/.test(p)).length;
```

`CROOKED` → `UH1`, `AH0` → 2 syllables.

### Stress Examples

```
GENTLY      JH EH1 N T L IY0          → stress 1 0
UNDERSTAND  AH2 N D ER0 S T AE1 N D   → stress 2 0 1
```

### Stress Display Modes (later)

```
Full CMU stress:       2 0 1
Strong/weak display:   / x /
Primary-only display:  x x /
```

CMU stress is **dictionary stress**, not performance stress. In lyrics, phrase emphasis shifts with melody, delivery, and intent — so any stress display is a hint, not a directive.

## Pipeline

```
raw line
  ↓
tokenize into words / punctuation / whitespace
  ↓
normalize words for CMU lookup
  ↓
lookup pronunciations
  ↓
choose pronunciation (first by default)
  ↓
count vowel phones for syllable count
  ↓
derive stress pattern
  ↓
generate spelling chunks (count-guided heuristic) — only when needed
  ↓
apply any active overrides
  ↓
return structured result (LineResult / WordResult)
```

Rendering the result is the UI's job. The engine ends at "return data."

## Data Model

Two-layer separation reflected in types:

```ts
type DictionaryPronunciation = {
  source: "cmudict" | "custom" | "heuristic";
  phones?: string[];
  syllableCount: number;
  stress: string;        // e.g. "10", "201"
};

type DisplaySyllables = {
  chunks: string[];      // e.g. ["gent", "ly"]
  stress: string;
  source: "auto" | "custom";
};

type WordAnalysis = {
  word: string;
  normalized: string;
  candidates: Array<{
    label: string;       // "CMU #1", "CMU #2", "custom: song"
    syllables: string[];
    stress: string;
    phones?: string[];
    source: string;
  }>;
  selectedCandidateId: string;
};
```

## Multi-Pronunciation Words

Some words have multiple CMU entries. **MVP: always use the first.** Later: clickable word cycles through alternatives.

## Spelling Chunk Heuristic

Used only when visual syllable splits are displayed (a later feature).

Approach:

1. Find written vowel groups in the word.
2. Use CMU syllable count as the target chunk count.
3. If written vowel-group count ≈ spoken syllable count, split around vowel groups.
4. Assign consonants between groups using simple English heuristic (single consonant → next syllable; multi-consonant → split after first).
5. If uncertain, fall back to whole word or rely on manual edit.

Reference implementation:

```ts
const VOWELS = /[aeiouy]+/gi;

function splitWordIntoSyllableChunks(word: string, syllableCount: number): string[] {
  if (syllableCount <= 1) return [word];

  const matches = [...word.matchAll(VOWELS)];
  if (matches.length < syllableCount) return [word];

  const centers = matches.slice(0, syllableCount);
  const cuts: number[] = [];

  for (let i = 0; i < centers.length - 1; i++) {
    const current = centers[i];
    const next = centers[i + 1];
    const currentEnd = current.index! + current[0].length;
    const nextStart = next.index!;
    const consonantRun = word.slice(currentEnd, nextStart);

    if (consonantRun.length <= 1) {
      cuts.push(currentEnd);          // ba-na
    } else {
      cuts.push(currentEnd + 1);      // gent-ly, hap-py
    }
  }

  const chunks: string[] = [];
  let start = 0;
  for (const cut of cuts) {
    chunks.push(word.slice(start, cut));
    start = cut;
  }
  chunks.push(word.slice(start));
  return chunks;
}
```

Useful suffix rules to layer on (heuristic, not dogma — English spelling is haunted):

```
-ly    gently   → [gent][ly]
-ing   walking  → [walk][ing]
-ed    crooked  → [crook][ed]
-er    lover    → [lov][er]
-est
-tion
```

## Heuristic Fallback (Unknown Words)

For words not in CMUdict (slang, names, made-up words):

- Count written vowel groups.
- Apply simple silent-e and diphthong rules.
- Mark `source: "heuristic"` so the UI can optionally cue this visually (e.g. dotted underline) — the user knows the count is a guess.

A library like `syllable` (npm) is a reasonable starting point for this fallback rather than rolling our own from scratch.

## Override System

Lyrics are performance objects. Singers compress, stretch, elide, stylize. The override system is essential, not optional.

### Override Scopes

```
Global:  Every time I write "heaven", treat it as [heav][en].
Song:    In this song, "fire" is one syllable.
Line:    Only here, "every" is sung as [ev][ry].
```

### Common Overrides

```
every     [ev][er][y] → [ev][ry]
fire      [fi][re]    → [fire]
heaven    [heav][en]  → [heav'n]
going     [go][ing]   → [goin]
over      [o][ver]    → [o'er]
tonight   [to][night] → [t'night]
```

### Custom Word Model

```ts
type CustomWordEntry = {
  text: string;                  // "fire"
  normalized: string;            // "fire"
  syllables: string[];           // ["fire"] or ["fi", "re"]
  stress: ("0" | "1" | "2")[];   // ["1"] or ["1", "0"]
  phones?: string[];             // optional ARPABET override
  note?: string;                 // "sung as one syllable in chorus"
  scope: "global" | "song" | "line";
};
```

### Precedence Stack

```
line override
song override
project/user custom dictionary
selected CMU pronunciation candidate
CMU first pronunciation
heuristic fallback
```

### Phrase Overrides (later)

Syllables often cross word boundaries in sung language:

```
I am       → I'm
going to   → gonna
want to    → wanna
out of     → outta
kind of    → kinda
```

```ts
type CustomPhraseEntry = {
  text: string;          // "going to"
  display: string[];     // ["gon", "na"]
  stress: string;        // "10"
  scope: "global" | "song";
};
```

## UI Sketch (Word Popover, later)

Clicking a word opens:

```
gently

CMU:     [gent][ly]    stress: 1 0
Custom:  [gen][tly]    stress: 1 0

Actions:
- Split syllable here
- Merge with next syllable
- Mark strong / weak / secondary
- Use for this word everywhere
- Use only in this song
- Reset to CMU
```

Stress UI should avoid raw `0/1/2` by default. Friendly mapping:

```
weak       = 0
strong     = 1
medium     = 2
```

Visual options:

```
[gent][ly]      [gént][ly]
  ●    ·
```

Advanced mode exposes raw CMU stress digits.

## MVP Scope

**In:**
- CMUdict lookup → syllable count.
- Heuristic fallback for unknown words.
- Per-line gutter totals.
- Per-section totals.
- Per-word annotation (toolbar toggle), simple count format (e.g. `gently [2]`).

**Out (deferred):**
- Stress display.
- Visible syllable splits (`[gent][ly]`).
- Word-click popover.
- Override system (global / song / line).
- Multi-pronunciation cycling.
- Phrase overrides.
- Rhyme/near-rhyme analysis.
- Stress clash highlighting.
- Custom dictionary import/export.

## MVP Annotation Format

Per-word annotation renders as a small chip after the word, e.g. `gently ⟨2⟩` (exact glyph TBD — chip-style on the smaller side, visually quiet). The engine returns the count; the UI renders the chip.

## Open Questions

- Should heuristic-source counts be visually distinguished from CMU-source counts? Wait until overrides exist; before then it's noise without recourse. (Engine returns `source` regardless; this is a UI decision about whether to surface it.)

## Guiding Principle

> CMUdict gives the app confidence.
> Custom overrides give the artist authority.
> The editor should be helpful, not dogmatic.
