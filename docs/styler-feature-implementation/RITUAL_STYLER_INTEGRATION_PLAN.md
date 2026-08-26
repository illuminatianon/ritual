# Ritual × Styler Integration Plan

## Problem

Styler’s behavior fits Ritual, but its persistence semantics do **not** fit the existing Song/Version model:

- Songs have mutable and deletable versions; styles require append-only immutable versions.
- Songs derive their head version from ordering; styles require an explicit `currentVersionId`.
- Songs may be archived then permanently deleted; styles are soft-deleted only.
- The song editor is CodeMirror-backed and diff-driven; style prompt editing is form-based, read-only outside save dialogs.
- Ritual is a per-user, authenticated Nuxt/PostgreSQL app; Styler was a single-user SQLite/Express app.

**Decision:** add Styles as a parallel bounded context. Reuse Ritual’s API, repository, Pinia, visual-history, dialog, clipboard, and version-number allocation patterns—but do not reuse `songs`, `versions`, `useSongStore`, `EditorPane`, or `DiffPanel` directly.

## Target Design

### Separate data model

Add `styles` and `style_versions`; never add style fields to `songs` or reuse `versions`.

```text
styles
├── id: UUID
├── user_id: UUID → users.id
├── name: text
├── current_version_id: UUID → style_versions.id
├── next_version_number: integer
├── created_at: timestamptz
├── updated_at: timestamptz
└── deleted_at: timestamptz?

style_versions
├── id: UUID
├── style_id: UUID → styles.id
├── version_number: integer
├── positive_prompt: text
├── negative_prompt: text
├── metadata_json: text
└── created_at: timestamptz
```

Required constraints and indexes:

- `UNIQUE(style_id, version_number)`.
- Index active library reads by `(user_id, deleted_at, updated_at DESC)`.
- Index version history by `(style_id, version_number DESC)`.
- FK from a style version to its style; deleting a user cascades through styles and versions.
- `current_version_id` must reference a version belonging to that style. Enforce this in the transaction even if the database FK only proves the referenced version exists.
- Keep `metadata_json` as `text`, not `jsonb`. New writes serialize valid JSON; storing raw text preserves malformed legacy Styler metadata during an eventual import.

`next_version_number` is intentional. Styler’s SQLite `MAX(version_number) + 1` allocation relies on SQLite write serialization; Ritual runs on PostgreSQL. The existing Song pattern—atomically incrementing a parent counter in a transaction—avoids concurrent version-number collisions and preserves the “never reuse” invariant.

### Immutable style semantics

A Style has exactly one current version. Every mutation that changes prompts or name creates a new version.

| Operation | Result |
| --- | --- |
| Create style | Transaction creates Style + version `1`, makes it current, sets next version to `2`. |
| Edit current or historical version | Transaction appends the next version, updates `name`, `currentVersionId`, `updatedAt`, and `nextVersionNumber`. Original remains unchanged. |
| View historical version | Changes only renderer selection; never changes `currentVersionId`. |
| Delete style | Sets `deletedAt` and `updatedAt`; leaves all versions intact. |
| List styles | Returns only non-deleted styles joined to their current version. |
| Get style detail | Returns the summary plus all versions newest-first. |

This differs deliberately from `server/db/repositories/versions.ts`, which currently supports overwriting and deleting Song versions. Styles must not expose analogous operations.

### Shared API contract

Extend `shared/types/api.ts` and `app/api.ts` with a dedicated `styles` namespace and model-operation methods.

Recommended resource routes:

```text
GET    /api/styles
POST   /api/styles
GET    /api/styles/:styleId
POST   /api/styles/:styleId/versions
DELETE /api/styles/:styleId

POST   /api/styles/generate
POST   /api/styles/refine
```

Use Ritual’s existing conventions:

- UUID route validation through `parseUuidParam`.
- `requireCurrentUser(event)` on every endpoint.
- Repository operations scoped by `userId`; a foreign user’s style is indistinguishable from a missing one.
- H3 `createError` status responses and Zod request schemas.
- Existing snake_case transport fields, rather than introducing Styler’s camelCase convention into Ritual.

Validation at both client and server boundary:

| Field | Rule |
| --- | --- |
| Name | Required, trimmed, max 120 |
| Positive prompt | Required, trimmed, max 1,000 |
| Negative prompt | Optional, trimmed, defaults to `''`, max 1,000 |
| Generation request | Required, trimmed, max 2,000 |
| Refinement instruction | Required, trimmed, max 2,000 |

Metadata rules:

- Every new version records a `source`, defaulting to `manual`.
- Supported values: `manual`, `import`, `generated`, `model-edit`.
- Model edits also retain `instruction`.
- Preserve unknown keys on writes and display invalid/unparseable legacy metadata as `manual`.

### Shared workbench shell

Ritual is one persistent creative workbench, not a collection of route-specific mini-apps. Songs and Styles remain separate bounded contexts, but they populate the same durable application chrome.

```text
┌────┬────────────────────┬─────────────────────────────┬────────────────────┐
│    │                    │                             │                    │
│ A  │  PRIMARY SIDEBAR   │       MAIN WORKSPACE        │  SECONDARY PANEL   │
│ C  │                    │                             │                    │
│ T  │                    │                             │                    │
│ I  │                    │                             │                    │
│ V  │                    │                             │                    │
│ I  │                    │                             │                    │
│ T  │                    │                             │                    │
│ Y  │                    │                             │                    │
│    │                    │                             │                    │
├────┴────────────────────┴─────────────────────────────┴────────────────────┤
│                             STATUS BAR                                     │
└────────────────────────────────────────────────────────────────────────────┘
```

The shell owns region layout, panel dimensions, borders, typography, toolbar treatment, dialogs, notifications, and mode navigation. It does not own resource selection, version semantics, mutations, or model workflows.

| Shell region | Songs mode | Styles mode |
| --- | --- | --- |
| Activity Bar | Songs item selected | Styles item selected |
| Primary Sidebar | Song library | Style library |
| Main Workspace | CodeMirror lyrics editor | Readonly positive/negative prompt workspace |
| Secondary Panel | Song diff and version UI | Style version history |
| Status Bar | Song/editor status | Style/version status |

The Activity Bar is the persistent top-level mode switch. It gives every current and future Ritual domain a stable place in the workbench, uses clear accessible labels/tooltips in addition to its iconography, and changes the active route and shell contents without replacing the chrome.

Routes remain the source of truth for mode and selected resource, for example `/songs/:songId` and `/styles/:styleId`. They support deep links, browser history, reload recovery, and direct selection. A route changes the active workbench context; it does **not** select an unrelated page layout or remount the whole application shell.

### Shared structural primitives

The first shell refactor shares only stable structural behavior:

```text
app/
├── workbench/
│   ├── WorkbenchShell.vue
│   ├── ActivityBar.vue
│   ├── WorkspaceHeader.vue
│   ├── Panel.vue
│   └── WorkbenchStatusBar.vue
├── songs/
│   ├── SongLibrary.vue
│   ├── SongWorkspace.vue
│   ├── SongDiffPanel.vue
│   └── stores/...
└── styles/
    ├── StyleLibrary.vue
    ├── StyleWorkspace.vue
    ├── StyleHistoryPanel.vue
    └── stores/...
```

- `WorkbenchShell` provides named regions for the activity bar, primary sidebar, workspace, secondary panel, and status bar.
- `ActivityBar` renders available modes and exposes the active mode.
- `WorkspaceHeader`, `Panel`, and `WorkbenchStatusBar` provide layout and slots; domain containers own their buttons and status values.
- The shell accepts domain-specific content through slots or equivalent composition, not a generic resource/provider interface.

Keep Song and Style orchestration separate. `useSongsStore`/`useSongStore` continue to own song state; `useStylesStore` and a style-detail state/store own style state. Do not introduce generic resource providers, shared mutation strategies, type-parameterized domain controllers, `LibraryList`, or `VersionList` merely to fit both contexts into one interface.

`LibraryList` and `VersionList` are possible later extractions, not prerequisites. First establish the shell with the existing Song components intact, then build the Style containers. Extract a shared presentational list only after both consumers demonstrate the same rendered structure, keyboard behavior, and state boundary; make that extraction a behavior-preserving refactor in its own reviewable commit.

### Style workspace presentation

Styles use the shared shell without CodeMirror, lyric diffing, song dirty-state, or `useSongStore` dependencies.

```text
Midnight Electro Thing                                      v7
────────────────────────────────────────────────────────────────

POSITIVE PROMPT                                         Copy

industrial electro house, bratty female vocal delivery, ...


NEGATIVE PROMPT                                         Copy

no acoustic drums, no orchestral arrangement, ...
```

The shared workspace header carries the style name, displayed version, and domain actions: **New Version**, **Refine**, **Import**, **Generate**, and **Delete**. The main workspace renders the selected version’s prompt pair as readable, copyable text. The secondary panel shows all versions through `StyleHistoryPanel`.

Selecting an older version updates only the visible prompt pair and header metadata, analogous to loading historical song content. It must not modify the stored current version. “New Version” opens a focused prompt-edit dialog prefilled from the selected version; this preserves Ritual’s existing dialog workflow without making editing a separate page.

### Version-history reuse boundary

`DiffPanel.vue` must not be generalized during the shell refactor. It imports `computeLyricsDiff`, reads CodeMirror state through `useSongStore`, polls editor activity, and exposes song-version actions.

Phase 1 keeps the existing Song diff/version panel intact inside the Secondary Panel region. The first `StyleHistoryPanel` owns its own simple historical-selection rendering. Once both are real consumers, compare their presentational needs:

```text
SongDiffPanel              StyleHistoryPanel
├── lyric diff behavior    ├── historical-selection behavior
└── local version list     └── local version list

            ↓ only after demonstrated duplication

shared VersionList
└── rows: version label, timestamp, active state, selection event
```

If the common list is extracted, it must remain dumb and presentation-only. It may render newest-first version labels, timestamps, active-row styling, and keyboard-safe selection, but it must not absorb song diffing, CodeMirror activity, version mutation, or Style current-version semantics.

### Dialog workflows

#### Manual create

- Name, positive prompt, optional negative prompt.
- Save creates Style/version 1 with `source: manual`.

#### Edit as new version

- Opens the selected historical/current prompt pair in a form.
- Saving appends a version with `source: manual`.
- Name changes belong to that new current version transaction.

#### Combined import

- Split comma-delimited terms.
- Terms beginning with `-`, `‐`, `‑`, `‒`, `–`, or `—` become `no <term>` exclusions.
- Remaining terms become the positive prompt.
- Default missing name to the first positive term, truncated to 60 characters.
- Present editable name, positive, and negative fields before save.
- Saving creates a new style with `source: import`.

#### Generate

- Request free-form sound direction.
- Display candidates in ephemeral, newest-first dialog history.
- Reroll adds a candidate but writes nothing.
- “Use this” opens normal create with `source: generated`.

#### Refine

- Use the renderer-selected version, not necessarily the stored current version, as model context.
- Candidate history remains ephemeral.
- “Save as version” appends a version with `source: model-edit` and `{ instruction }` metadata.

#### Copy

- Use `navigator.clipboard.writeText`.
- Give explicit success and unavailable-clipboard feedback.

## Model Integration

Implement OpenRouter calls only in Nitro server handlers or a server-only utility. Add private runtime configuration, not a browser-exposed value:

```text
NUXT_OPENROUTER_API_KEY
NUXT_OPENROUTER_MODEL
NUXT_OPENROUTER_SITE_URL
NUXT_OPENROUTER_APP_NAME
```

The shared server utility should:

- use a 45-second timeout;
- use the selected model or Styler’s default;
- request exactly:

  ```text
  STYLE PROMPT: <positive prompt>
  NEGATIVE PROMPT: <negative prompt>
  ```

- parse labels case-insensitively after stripping surrounding code fences;
- reject missing labels, blank output, and outputs over 1,000 characters;
- never persist generated/refined output before explicit user action;
- preserve Styler’s content rules: original Suno-oriented prompts, separate positive/negative fields, no artists/bands/songs/albums/copyrighted lyrics/voice imitation/“in the style of”, and neutral musical-trait substitutions.

No provider abstraction is warranted yet: Ritual has no other model provider and Styler already defines the precise OpenRouter contract.

## Delivery Phases

### Phase 1 — Persistent workbench refactor

This phase is Songs-only. Do not add Style tables, types, API routes, stores, components, or placeholder modes.

1. Introduce `WorkbenchShell` with persistent Activity Bar, Primary Sidebar, Main Workspace, Secondary Panel, and Status Bar regions.
2. Move the existing Song sidebar, CodeMirror workspace, diff/version panel, header, and status behavior into those regions without changing their domain semantics.
3. Establish route-driven Song resource identity and deep linking where the refactor requires it; retain Songs as the only available workbench mode.
4. Keep `DiffPanel` and its current version-list markup intact. Do not introduce `LibraryList`, `VersionList`, or another shared list abstraction in this phase.
5. Verify existing Song behavior in the refactored shell before proceeding.

**Exit condition:** the existing Song experience is functionally unchanged inside a persistent workbench shell. The app remains buildable/testable, Song navigation and dirty-transition behavior remain intact, and no Style-domain implementation exists.

### Phase 2 — Style contract, persistence, and API

1. Add Style and StyleVersion shared API types.
2. Add Drizzle tables, constraints, indexes, and migration.
3. Add Style Zod schemas and metadata normalization helpers.
4. Add repositories:
   - list active summaries with one joined current version query;
   - find owned active detail;
   - transactional create;
   - transactional append;
   - soft delete.
5. Add authenticated API routes and extend `app/api.ts`.
6. Add repository/API coverage for ownership, transactionality, immutability, validation, ordering, and soft deletion.

**Exit condition:** all Style mutations are transactional, user-scoped, append-only, and isolated from Song behavior. The contract is usable by a future workbench mode, but no Style UI is required yet.

### Phase 3 — Manual Style library workspace

1. Add Styles to the existing Activity Bar and add route-driven Style resource identity and deep links.
2. Add `useStylesStore` and style-detail state/store; do not reuse Song selection or editor state.
3. Add StyleLibrary in the Primary Sidebar with loading, selection, empty, and error states.
4. Add readonly StyleWorkspace in the Main Workspace with prompt copy controls, selected-version metadata, and shared-header actions.
5. Add StyleHistoryPanel in the Secondary Panel with local historical-version selection rendering.
6. Add create, focused edit-as-new-version, copy, and soft-delete flows using Ritual dialogs and notifications.
7. Evaluate list duplication only after both panels exist; extract a presentation-only shared list in a separate refactor only if the evidence supports it.

**Exit condition:** Songs and Styles occupy the same persistent workbench shell; navigating or deep-linking between them changes mode and selected resource without replacing application chrome. A user can manage immutable prompt pairs end-to-end with no CodeMirror, lyric diff, song dirty-state, or song-store dependency.

### Phase 4 — Import

1. Add the combined-prompt parser as a pure utility.
2. Add import paste/review/edit/save flow.
3. Mark created versions with `source: import`.

**Exit condition:** dash-prefixed comma terms become `no …` exclusions; users can correct every imported field before storage.

### Phase 5 — Model generation and refinement

1. Add server-only OpenRouter configuration and prompt utility.
2. Implement generation and refinement endpoints.
3. Add candidate-history dialogs and explicit save/use transitions.
4. Surface disabled/loading/error states; never hide a failed request behind a generic success state.

**Exit condition:** candidates are ephemeral until chosen; server validates model output and client never receives provider credentials.

### Phase 6 — Optional Styler SQLite import

Keep this out of the initial release. It needs a clear target-account decision because Styler has no user ownership while Ritual requires `user_id`.

When enabled:

1. Build a command-line, admin-only importer requiring:
   - a consistent SQLite backup/path;
   - an explicit Ritual target user UUID;
   - a source database fingerprint.
2. Use a separate import ledger keyed by source fingerprint and legacy style ID for idempotency; do not pollute the core Style domain with permanent Styler-only identifiers.
3. Import each style and all versions in a transaction, including deleted styles.
4. Preserve version numbers, prompt text, timestamps, deletion state, current-version mapping, and raw metadata where valid storage permits.
5. Stop on orphan versions or invalid current-version ownership. Record malformed metadata for review without discarding prompt content.
6. Verify source/destination counts and sample imported detail views before enabling the feature.

### Commit discipline

Every delivery phase ends only after its relevant verification passes and its completed state is committed. Prefer a few buildable, reviewable commits at natural architectural or feature boundaries; do not mix unrelated cleanup into them, create one-file noise commits, squash the phase history later, create release tags, or bump the application version.

Recommended commit sequence:

| Phase | Natural commit boundary | Conventional commit example |
| --- | --- | --- |
| 1 | Shell structure | `refactor: introduce persistent workbench shell` |
| 1 | Song content moved into shell regions | `refactor: move song workspace into workbench regions` |
| 2 | Database schema and repositories | `feat: add style persistence and repositories` |
| 2 | Authenticated HTTP/client contract | `feat: add authenticated style API` |
| 3 | Manual library workspace | `feat: add manual style library workspace` |
| 3 | Demonstrated list-only reuse, if warranted | `refactor: extract shared version list` |
| 4 | Combined import workflow | `feat: add style import workflow` |
| 5 | Server model contract | `feat: add style generation API` |
| 5 | Candidate dialogs and explicit saves | `feat: add style generation and refinement` |
| 6 | One-time importer and verification | `feat: add styler sqlite importer` |

The examples are boundaries, not mandatory one-to-one commits. Split a phase only when a subset is independently meaningful and remains practical to build and test; otherwise commit the completed phase as one coherent conventional commit.

## Verification Plan

Phase-gate verification:

| Phase | Required verification before commit |
| --- | --- |
| 1 | Run the existing Song tests and typecheck; browser-smoke Song creation, selection, CodeMirror editing, save/overwrite, historical-version loading, dirty-transition confirmation, archive/restore, and the refactored panel layout. |
| 2 | Run the Style repository and API tests against `RITUAL_TEST_DATABASE_URL`; exercise transactionality, ownership, immutability, current-version links, validation, ordering, and soft deletion. |
| 3 | Browser-smoke route-driven Song/Style switching, deep-link reload, list selection, historical Style selection, manual create/edit/copy/delete, and shell persistence. |
| 4 | Run parser tests and browser-smoke import parsing, editable review, and source metadata persistence. |
| 5 | Run deterministic prompt-parser/server tests with provider calls mocked; browser-smoke candidate rerolls and explicit use/save transitions. |
| 6 | Run the importer against a fixture SQLite database and verify source/destination counts, prompt text, metadata, versions, current links, timestamps, and deletion state. |

Commit the completed phase immediately after its gate passes. No phase begins on top of an unverified, uncommitted predecessor.

Repository and API coverage:

- Creates version 1 and points `currentVersionId` at it.
- Appends immutable versions from both current and historical selections.
- Allocates distinct monotonic numbers under concurrent appends.
- Prevents cross-user read, append, and delete access.
- Hides soft-deleted styles from list/detail while retaining versions.
- Rejects invalid UUIDs, blank required values, and all length overflows.
- Preserves unknown metadata and treats malformed stored metadata as `manual` in UI parsing.
- Produces correct current-summary ordering by `updated_at`.
- Parses all supported dash characters for imports.
- Rejects malformed, blank, or oversized model output.
- Confirms generation/refinement never create database rows until explicit save.

Manual browser smoke path after implementation:

1. Open a deep-linked song route, then switch to Styles through the Activity Bar; confirm the shell, panel geometry, notifications, and status region remain present while domain contents change.
2. Open a deep-linked style route and confirm the corresponding activity item, style row, and selected version are active after reload.
3. Create a manual style and confirm `v1`.
4. Select `v1`, edit, save `v2`, then reselect `v1` and confirm it is unchanged.
5. Import a mixed combined prompt and correct the review fields before save.
6. Copy both prompts.
7. Delete the style and confirm it leaves the active library while retained in the database.
8. Generate and reroll candidates; verify database count stays unchanged until “Use this.”
9. Refine a historical version and verify saved candidate becomes the new current version.
