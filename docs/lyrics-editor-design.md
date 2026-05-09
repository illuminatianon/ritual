# Suno Lyrics Editor — Design Doc

## Overview

A desktop app for writing and editing song lyrics intended for Suno generation. Replaces the "VS Code" step in the current workflow of (chat LLM ↔ text editor ↔ Suno). Primary value: live syllable/meter feedback and version history with diffs.

**Not a goal (initially):** built-in LLM chat, Suno API integration, collaboration, web hosting.

### Companion docs

- `architecture.md` — Electron process model, IPC, state management, package boundary, folder layout.
- `editor.md` — CodeMirror setup, custom extensions, diff recompute behavior.
- `syllable-engine.md` — CMUdict integration, heuristic fallback, override system, stress.

## Core Workflow It Supports

1. Write or paste lyrics into the editor.
2. See syllable counts per line and section totals at a glance.
3. Snapshot a version before each Suno generation attempt.
4. Diff against any previous version to see what changed.
5. Copy clean lyrics out to Suno; copy as-is to LLM chat for revision.

## MVP Features

- CodeMirror-based editor with lyrics text.
- Section tag recognition (`[Verse]`, `[Chorus]`, `[Bridge]`, `[Instrumental]`, etc.) — styled distinctly, exempt from syllable counting.
- Gutter showing syllable count per line.
- Section totals (per-section syllable sums) shown somewhere readable.
- Save/snapshot versions (manual hotkey, e.g. Cmd/Ctrl+S, with optional label).
- Version list / picker.
- Diff panel showing changes between current editor buffer and a chosen saved baseline version. The baseline picker defaults to the latest saved version and lists older versions newest-first.
- "Copy to Suno" button: clean lyrics only, no annotations.
- "Copy for chat" button: lyrics as-is.

## Later / Maybe

- Export with syllable annotations (for feeding meter info to LLM).
- "Mark version as good" flag with notes.
- Stress pattern display (CMU-derived; see `syllable-engine.md`).
- Visible syllable splits inside words (e.g. `[gent][ly]`).
- Per-word manual syllable / stress / pronunciation overrides, with global / song / line scope.
- Word-click popover for inspecting and adjusting pronunciation.
- Rhyme scheme / near-rhyme detection.
- Phrase-level overrides for sung contractions (`going to` → `gonna`).
- Strip-annotations-on-paste (handle accidental re-paste of annotated exports).
- Optional line numbers in gutter.
- Tabs (multiple songs open simultaneously).
- LLM chat integration.
- Suno API integration.

## Project Structure

Monorepo with three packages:

- **`packages/syllable-engine/`** — Pure JS/TS, no Electron, no UI. CMUdict data + lookup, heuristic fallback, override resolution, tokenization. Returns data; renders nothing. See `syllable-engine.md`.
- **`packages/backend/`** — Electron main process: SQLite access, file I/O, IPC handlers. Exposes a narrow API to the renderer via a preload bridge. See `architecture.md`.
- **`packages/frontend/`** — Vue 3 renderer app. Imports `syllable-engine` directly as a workspace dependency. Calls into the backend via `window.api`. See `architecture.md` for the boundary.

Rationale:
- **UI-replaceability:** When the frontend gets reworked, the engine stays put. The engine is a pure-data package with no Vue, no CodeMirror, no Electron — a UI rewrite touches only `frontend/`.
- **Testable in isolation:** Engine has unit tests that don't spin up Electron.
- **Future optionality:** CLI tools, server-side use, npm publishing — all become possible without restructuring.

Diff logic likely lives in `frontend/src/diff/` for MVP — small enough not to justify its own package, but could be promoted to `packages/diff-engine/` later if symmetry with syllable-engine becomes valuable.

## Diff Behavior

- Default granularity: line-level, with per-word highlighting within changed lines (WinMerge-style).
- Implementation: `jsdiff`'s `diffLines` for the outer pass, `diffWords` for the inner highlighting on changed line pairs.
- The live editor itself does **not** highlight changed lines — the diff lives entirely in the right panel.

## CodeMirror Toggles

- **Always on:** line syllable count in gutter.
- **Toolbar toggle:** per-word syllable annotations. Exact rendering TBD (under-word vs. inline-after, etc.). See `syllable-engine.md`.

## Tech Stack

- **Shell:** Electron. Process model and IPC details in `architecture.md`.
- **Frontend:** Vue 3.
- **Editor:** CodeMirror 6.
- **Diff:** `jsdiff`. See Diff Behavior section above.
- **Syllable counting:** CMU Pronouncing Dictionary lookup with heuristic fallback. See `syllable-engine.md` for details.
- **Storage:** SQLite (one file, transactional, easy querying).

## Data Model (draft)

```
songs
  id            INTEGER PK
  name          TEXT
  created_at    DATETIME
  updated_at    DATETIME

versions
  id              INTEGER PK
  song_id         INTEGER FK -> songs.id
  version_number  INTEGER       -- user-facing v1, v2, v3...
  lyrics          TEXT
  label           TEXT NULL     -- optional user note ("rewrote bridge")
  created_at      DATETIME
  updated_at      DATETIME
```

Soft-delete: add `archived_at DATETIME NULL` to `songs`. Archived songs are hidden from the main list but reachable via an "Archived" view, where they can be restored or permanently deleted (cascading drop of all related versions).

## Versioning Behavior

### Save Actions

Menu/button labels show the resulting version number dynamically:

- **Ctrl+S — "Save new version [v6]".** Default save. Creates a new version, incrementing `version_number` by 1. This is the action used before each Suno generation attempt.
- **Ctrl+Shift+S — "Update [v5]".** Overwrites the currently-loaded version's lyrics in place; no new version created. Works whether the loaded version is the head or an older one. When overwriting a non-head version (e.g. editing v2 while head is v5), prompt with a confirmation ("Overwrite v2? This rewrites history.") to prevent surprise edits.
- **Ctrl+Alt+S — Save As (deferred).** Reserved for future "fork to new song." Not in MVP.

### Rules

- If a saved version is decided to be wrong/unwanted, it can be deleted; the next save resumes from the previous number (i.e. delete v4 → next save is v4 again). Expected to be uncommon.
- "Restore from v2" while currently on v4 does **not** revert the counter — loading v2's lyrics into the editor and saving creates v5. Version history is append-only in number, even when content is rolled back.

### Editor State Indicator

The editor needs to clearly show:
- Which version is currently loaded.
- Whether there are unsaved changes (dirty indicator).
- The editor header shows loaded/next version state: clean `v3`, dirty `v3 -> v4 (unsaved)`.
- A status bar near the editor shows secondary loaded-version metadata, currently the update timestamp.

The save action labels themselves ("Save new version [v6]", "Update [v5]") communicate what each action will do, so a separate "next save will be vN" indicator isn't needed.

## Layout

Three regions:

- **Left sidebar:** app title, library label, create button, song list from DB, latest version metadata, active song highlight, archived section.
- **Center:** CodeMirror editor.
  - Gutter: line syllable count. (Line numbers reserved as a possible future toggle but not prioritized — LLM workflow uses whole sections for context, not line numbers.)
  - Inline annotations: section total syllable counts rendered as CodeMirror decorations next to the section tag (e.g. `[Chorus]  24`). Placement may revisit once the info gets real-world use.
  - Section tags styled dimmer/italic.
- **Right panel:** custom diff baseline picker at top. The selected row shows version, label, and timestamp; opening it shows other saved versions newest-first. The diff compares that saved version against the current editor buffer.

## Paste Handling

LLM output is clean by default in current workflow, so no paste cleanup needed at MVP. A "strip annotations on paste" feature is deferred (see Later list).

## Deletion / Archival

- Soft-delete is the default — songs go to an Archived view rather than disappearing.
- From Archived view, songs can be restored or permanently deleted.
- Permanent deletion cascades to all versions of that song.

## Version Picker (Diff Panel)

- **Selected/closed state:** two-line row — `v12: tighten chorus` plus timestamp.
- **Open dropdown:** custom menu with other saved versions newest-first; version, label, timestamp visible per row.
- **Loaded version state** lives in the editor header; loaded-version timestamp lives in the status bar.

## Open Questions

Most remaining UX details (section total annotation placement, picker formatting edge cases, status bar contents, etc.) are deferred until the app is bootstrapped enough to use for real work. Decisions here will be informed by feel, not spec.

### Resolved

- Single `updated_at` timestamp per version is fine for MVP. A separate `edited_at` for in-place updates can be added later without losing sleep over historical data.
- Switching songs with unsaved changes: standard "unsaved changes" prompt (save / discard / cancel).

## Multi-Song UX

MVP shows one song at a time in the editor, switched via the left sidebar. Standard single-file behavior — switching prompts on unsaved changes.

**Tabs are likely in the future** (one tab per open song, each with its own loaded version and dirty state).

To avoid a painful refactor later, the state layer should be designed as if tabs already exist: a keyed collection of per-song state (`{ [songId]: { loadedVersion, dirty, editorState, ... } }`) plus an `activeSongId`, even though MVP only ever populates one entry. Adding tabs becomes a UI change rather than a state-management rewrite.
