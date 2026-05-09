# Architecture — Process Model, IPC, State

Covers Electron's process model, what runs where, how the frontend talks to the backend, and how renderer-side state is organized.

## Process Model

Electron has two kinds of processes:

- **Main process** — One per app. Runs Node.js. Has access to OS APIs, filesystem, native modules (e.g. `better-sqlite3`), windows. This is the "backend."
- **Renderer process** — One per window. Runs Chromium. This is the Vue app. By default has **no** Node access (security default; don't change it).

```
┌────────────────────────────────────┐
│ Main Process (Node)                │
│   - SQLite                         │
│   - File I/O                       │
│   - IPC handlers                   │
└──────────────┬─────────────────────┘
               │ IPC (message passing)
               │
┌──────────────┴─────────────────────┐
│ Renderer Process (Chromium)        │
│   - Vue app                        │
│   - CodeMirror                     │
│   - syllable-engine (bundled in)   │
│   - diff logic                     │
└────────────────────────────────────┘
```

## What Runs Where

### Main Process

- SQLite access (native module, has to be here).
- IPC handlers (`songs:*`, `versions:*`).
- App lifecycle, window creation.

### Renderer Process

- Vue app, all UI.
- CodeMirror.
- **Syllable engine** — bundled in via the workspace package. Reasons:
  - CodeMirror updates frequently as you type; round-tripping every change to main would either feel laggy or require careful debouncing.
  - CMUdict is data, not Node-only code — it loads fine in the renderer.
  - The engine's API is synchronous and pure; matching that in IPC would be wasteful.
- **Diff logic** — pure JS, no reason to cross IPC. Lives next to the panel that renders it.

### Rule of Thumb

If something needs Node APIs (filesystem, native modules, OS), it lives in main. Everything else can and probably should live in the renderer to avoid IPC overhead.

## The Preload Bridge

The renderer can't `import` from main; communication is message-passing. The clean way to expose IPC to the renderer is via a **preload script** — a small file that runs in the renderer with privileged access and uses `contextBridge` to expose a narrow, explicit API on `window`.

```ts
// packages/backend/src/preload.ts
import { contextBridge, ipcRenderer } from 'electron';
import type { Api } from './api';

const api: Api = {
  songs: {
    list:            (args)     => ipcRenderer.invoke('songs:list', args),
    create:          (name)     => ipcRenderer.invoke('songs:create', name),
    rename:          (id, name) => ipcRenderer.invoke('songs:rename', { id, name }),
    archive:         (id)       => ipcRenderer.invoke('songs:archive', id),
    restore:         (id)       => ipcRenderer.invoke('songs:restore', id),
    deletePermanent: (id)       => ipcRenderer.invoke('songs:deletePermanent', id),
  },
  versions: {
    list:      (songId)    => ipcRenderer.invoke('versions:list', songId),
    save:      (args)      => ipcRenderer.invoke('versions:save', args),
    overwrite: (args)      => ipcRenderer.invoke('versions:overwrite', args),
    load:      (versionId) => ipcRenderer.invoke('versions:load', versionId),
    delete:    (versionId) => ipcRenderer.invoke('versions:delete', versionId),
  },
};

contextBridge.exposeInMainWorld('api', api);
```

In the renderer:

```js
const songs = await window.api.songs.list();
```

The preload is the **only** bridge. Renderer has no other path to the backend, and exposes only what's explicitly listed.

## IPC Patterns

### Request/Response (`invoke` / `handle`)

Async, returns a value. Use for almost everything.

```ts
// main
ipcMain.handle('songs:list', async () => {
  return db.songs.all();
});

// renderer (via preload)
const songs = await window.api.songs.list();
```

### Push (`webContents.send` / `ipcRenderer.on`)

Main pushes to renderer unsolicited. Use for events the renderer didn't ask for: file changed on disk, background job finished. Probably not needed for MVP.

## Channel Naming

Fine-grained, namespaced: `songs:list`, `versions:save`, `versions:overwrite`. One channel per operation.

Alternative is coarse-grained dispatch (`db:request` with an action object), but fine-grained wins on:
- Easier debugging — channel name pinpoints failure.
- Per-channel typing.
- No giant switch statement in main.

Cost (more channel definitions) is small at this scale.

## API Contract

TypeScript throughout. The IPC surface is exactly where bugs hide ("I renamed the channel but missed one side"), and shared types make the boundary self-enforcing.

```ts
// packages/backend/src/api.ts (imported by frontend via workspace path)

export interface Song {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  latest_version_number?: number | null;
  latest_version_updated_at?: string | null;
}

export interface Version {
  id: number;
  song_id: number;
  version_number: number;
  lyrics: string;
  label: string | null;
  created_at: string;
  updated_at: string;
}

export interface Api {
  songs: {
    list(args?: { archived?: boolean }): Promise<Song[]>;
    create(name: string): Promise<Song>;
    rename(id: number, name: string): Promise<Song>;
    archive(id: number): Promise<void>;
    restore(id: number): Promise<Song>;
    deletePermanent(id: number): Promise<void>;
  };
  versions: {
    list(songId: number): Promise<Version[]>;
    save(args: { songId: number; lyrics: string; label?: string }): Promise<Version>;
    overwrite(args: { versionId: number; lyrics: string }): Promise<Version>;
    load(versionId: number): Promise<Version>;
    delete(versionId: number): Promise<void>;
  };
}

declare global {
  interface Window { api: Api; }
}
```

Renderer auto-completes `window.api.versions.save(...)`; main implements against the same contract.

## Folder Layout

```
package.json                      # workspaces root
tsconfig.json                     # shared TS config and package path aliases
vite.config.ts                    # Vite + Electron build entries
packages/
  syllable-engine/
    src/
      index.ts                    # public API
    data/
      cmudict.json                # small seeded dict for now
    test/
    package.json
  backend/
    src/
      main.ts                     # Electron bootstrap, window creation
      preload.ts                  # contextBridge API
      api.ts                      # shared types (Api, Song, Version)
      ipc/
        register.ts               # ipcMain.handle for songs:* and versions:*
      db/
        database.ts               # schema migration + repositories
        database.test.ts
    package.json
  frontend/
    src/
      App.vue
      components/
        EditorPane.vue
        Sidebar.vue
        DiffPanel.vue
        Toolbar.vue
        StatusBar.vue
      stores/                     # Pinia
        songs.ts                  # library / sidebar
        song.ts                   # per-song editor state (keyed by id)
        prefs.ts                  # UI preferences
      editor/
        extensions.ts
        sections.ts
      diff/
        compute.ts
      api.ts                      # thin wrapper around window.api
    package.json
    tsconfig.json
```

## Boundary Rules

- `frontend/` never imports backend runtime code. The renderer contract is `window.api`.
- `frontend/` may import `@ritual/backend/api` types only.
- `frontend/` imports `syllable-engine` directly (workspace dependency, bundled at build time).
- `backend/` doesn't depend on `frontend/` at all.
- Shared types live in `backend/src/api.ts` and are imported by `frontend/` via workspace path. (Could move to a `packages/shared-types/` later if it grows.)

## State Management (Pinia)

Three stores, split by ownership and lifecycle.

### `useSongsStore` — the library

Owns "what songs exist." Sidebar reads from here. Loaded once at app start, occasionally mutated.

```ts
state: {
  songs: Song[];                 // non-archived
  archived: Song[];              // loaded lazily when archive view opens
  activeSongId: number | null;
  archiveOpen: boolean;
}

actions: {
  loadAll();                     // window.api.songs.list()
  loadArchived();
  create(name);
  rename(id, name);
  archive(id);
  restore(id);
  deletePermanent(id);
  setLatestVersion(id, version); // keeps sidebar metadata fresh after saves/deletes
  setActive(id);
}
```

### `useSongStore` — per-song editor state

Owns "what's happening with the songs that are open." Editor, diff panel, status bar read from here. Mutated constantly during editing.

Keyed by song id ("designed for tabs, rendering one") so adding tabs later is a UI change, not a state-shape rewrite. For MVP, `byId` only ever has 0 or 1 entry.

```ts
type SongState = {
  songId: number;
  versions: Version[];           // all versions for this song
  loadedVersionId: number | null;// which version is in the editor
  dirty: boolean;                // editor differs from loaded version
  documentReady: boolean;        // prevents diffing against an empty transient buffer
  diffTargetVersionId: number | null; // selected diff baseline
  view: EditorView | null;
  resetEditorDocument: ((lyrics: string) => void) | null;
  activity: number;
};

state: {
  byId: Record<number, SongState>;
}

getters: {
  active(): SongState | null;    // byId[useSongsStore().activeSongId]
}

actions: {
  open(songId);                  // ensure byId[songId] exists, load versions
  loadVersion(songId, versionId);
  saveBumpVersion(songId, label?);
  overwriteCurrentVersion(songId);
  setDiffTarget(songId, versionId);
  close(songId);                 // for tabs, later
}
```

#### Editor text — not in the store

CodeMirror owns the document during editing. The store does **not** mirror live editor text. See `editor.md` for the full editor/store bridge. Reasons:
- Per-line syllable counts come from the gutter extension reading editor state directly; no need to round-trip through Pinia.
- Mirroring on every keystroke is wasted work.

The store holds a reference to the editor view and a `resetEditorDocument()` callback set when the editor mounts. Save actions read text from the editor at save time. The dirty flag is reported by the editor's update listener, not derived from comparing strings.

When loading a song/version, the store calls `resetEditorDocument()` rather than dispatching a normal text change. That rebuilds CodeMirror state for the loaded document, clears undo history for the previous document, and avoids marking app-driven loads as dirty.

### `usePrefsStore` — UI preferences

```ts
state: {
  showWordAnnotations: boolean;
  sidebarCollapsed: boolean;
  // ...
}
```

Persists via localStorage for MVP. (A backend `prefs` table is overkill until prefs need to sync across devices, which isn't a goal.)

### Component → Store Mapping

```
Sidebar.vue          ← useSongsStore
EditorPane.vue       ← useSongStore (active)
DiffPanel.vue        ← useSongStore (active)
StatusBar.vue        ← useSongStore (loaded version metadata)
Toolbar.vue          ← usePrefsStore + useSongStore (save actions)
```

### Decisions

- **Versions list:** loaded eagerly when a song opens. Songs with hundreds of versions are unlikely; eager is simpler. Diff baseline picker displays newest first.
- **Switching songs:** previous song's `SongState` stays in `byId` (not evicted). Memory cost negligible; makes tab support trivial later.
- **"Viewing v2 while head is v4":** represented as `loadedVersionId = 2`. Save actions decide whether to bump or overwrite based on whether `loadedVersionId` is the current head.
- **Diff baseline:** defaults to the latest saved version. The right panel compares the current editor buffer against the custom baseline picker selection.

## SQLite & Migrations

- **Library:** `better-sqlite3`. Sync API, fast, ergonomic. Rebuilt for Electron's Node version via `pnpm rebuild:native`.
- **Migrations:** Current MVP uses a hand-rolled `PRAGMA user_version` runner inside `packages/backend/src/db/database.ts`. It applies the v1 schema at app start in main, before IPC handlers bind. Numbered migration files are still a likely next step once schema changes begin accumulating.
- Rationale: third-party migration libraries bring more ceremony than this app needs. The runner is ~30 lines. If schema management gets complex enough to want fancier tooling (rollback, branching, named migrations), swap in something heavier later — the data shape doesn't depend on the runner.

## Open Questions

(None blocking. Decisions deferred to scaffolding will be made in code, not in docs.)
