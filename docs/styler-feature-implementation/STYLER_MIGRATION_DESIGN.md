# Styler Feature Migration Design

## Purpose

This document describes the portable product behavior and data contract of Styler: a local library for reusable Suno style prompts. It is intended to move these capabilities into another application without preserving the current Vue/Express implementation.

Existing-library migration is desirable but not a release blocker. The model is deliberately small: a style has append-only prompt versions, one of which is current.

## Scope

### In scope

- A named library of reusable music-style prompt pairs.
- Separate **positive** (style) and **negative** (exclude) prompts.
- Immutable version history and current-version selection.
- Manual entry, combined-prompt import, model generation, and model-assisted refinement.
- Copying either prompt to the clipboard.
- Soft deletion.
- Server-side model integration and prompt-safety rules.

### Out of scope

- Lyrics, audio, Suno account integration, Suno generation submission, playback, sharing, collaboration, tags, folders, search, authentication, and recovery/trash UI.
- A requirement to preserve the existing Vue, Vuetify, Express, SQLite, or OpenRouter-specific interfaces.

## Product behavior

### Library and detail views

The library shows non-deleted styles ordered by most recently updated, newest record first for ties. Each row exposes:

- style name;
- current version number; and
- last style update time.

Opening a style shows its name, current prompt pair, source metadata, timestamp, and a version selector. Selecting a historical version changes only the prompt pair being viewed; it does not change the stored current version.

An empty library must guide the user to create, import, or generate a style. Loading, request failure, success feedback, and disabled/loading submit states are part of the expected interaction behavior.

### Manual creation and editing

A user creates a style with a required name and required positive prompt. The negative prompt is optional.

Editing is never in-place. Editing any historical or current version creates the next version for that style, updates the style name supplied by the edit, makes the new version current, and preserves every prior version unchanged.

### Combined-prompt import

Import accepts a comma-separated combined prompt. Each non-empty comma-delimited term whose first non-whitespace character is a dash (`-`, `‐`, `‑`, `‒`, `–`, or `—`) becomes a negative exclusion after removing that dash and prefixing `no `.

All remaining terms form the positive prompt. Both prompt fields remain editable before save. If the user did not supply a name, default it to the first positive term truncated to 60 characters. Saved imports create a new style with source `import`.

Example:

```text
Input: dark synth-pop, breathy alto, - trap drums, - harsh highs
Positive: dark synth-pop, breathy alto
Negative: no trap drums, no harsh highs
```

### Model generation

The user provides a free-form sound request. The service returns a separately labeled positive and negative prompt pair. Results are ephemeral until the user chooses one; rerolls remain available in the current dialog/session history and do not alter saved data. Choosing a generated result opens normal creation with source `generated`.

### Model refinement

The user selects any saved version and provides an edit instruction. The service receives that selected version's prompt pair plus the instruction, then returns one or more ephemeral candidate pairs. Saving a candidate appends a version to the selected style with source `model-edit` and metadata containing the edit instruction.

The original version remains unchanged until the user explicitly saves a candidate.

### Deletion

Deletion hides a style from normal reads by marking it deleted. It must not delete the style or any prompt versions. The present product has no restore UI, but retaining the record supports a future restore or audit operation.

## Domain model

### Entities

```text
Style
├── id
├── name
├── currentVersionId ─────────────┐
├── createdAt                     │
├── updatedAt                     │
└── deletedAt?                    │
                                 │
StyleVersion                      │
├── id ◄──────────────────────────┘
├── styleId ──────────────────────► Style.id
├── versionNumber                 (unique within one style)
├── positivePrompt
├── negativePrompt
├── metadata                      (extensible JSON object)
└── createdAt
```

### Logical schema

The following relational model matches the existing semantics. Another application's persistence system may represent the same fields differently.

```sql
CREATE TABLE styles (
  id                  INTEGER PRIMARY KEY,
  name                TEXT NOT NULL,
  current_version_id  INTEGER,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  deleted_at          TEXT
);

CREATE TABLE style_versions (
  id                INTEGER PRIMARY KEY,
  style_id          INTEGER NOT NULL REFERENCES styles(id),
  version_number    INTEGER NOT NULL,
  positive_prompt   TEXT NOT NULL,
  negative_prompt   TEXT NOT NULL,
  metadata_json     TEXT NOT NULL DEFAULT '{}',
  created_at        TEXT NOT NULL,
  UNIQUE (style_id, version_number)
);
```

Recommended indexes:

```sql
CREATE INDEX styles_active_updated_idx
  ON styles (deleted_at, updated_at DESC);
CREATE INDEX style_versions_style_idx
  ON style_versions (style_id, version_number DESC);
```

### Invariants

1. A visible style has `deletedAt = null` and a valid `currentVersionId` referencing one of its own versions.
2. Each newly created style has version number `1`, which is immediately current.
3. Version numbers are monotonically increasing per style and are never reused.
4. Prompt versions are immutable. No update or delete path may alter existing prompt content or metadata.
5. Appending a version updates `Style.name`, `currentVersionId`, and `updatedAt` atomically.
6. Soft deletion only sets `deletedAt` and updates `updatedAt`; it does not affect versions.
7. A style detail response includes all versions in descending version-number order. The list response includes only the current version.

Transactions are required for initial creation and version append so readers cannot observe a style without its current version or a partially applied version change.

### Metadata

`metadata` is an extensible object persisted as JSON. `source` is always present and defaults to `manual`.

Current source values:

| Source | Meaning | Additional metadata |
| --- | --- | --- |
| `manual` | User typed a new style or manually edited a version. | None required. |
| `import` | Created from a combined prompt import. | None required. |
| `generated` | Created from an accepted generation candidate. | None required. |
| `model-edit` | Saved model-refinement candidate. | `instruction`: submitted edit request. |

The destination application should preserve unknown metadata keys during migration and writes. It should not make UI behavior depend on metadata JSON parsing succeeding; an unreadable or legacy value should display as `manual`.

## Validation and limits

Apply validation in the client for fast feedback and authoritatively on the server or trusted backend boundary.

| Field | Required | Normalization | Maximum |
| --- | --- | --- | --- |
| Style name | Yes | Trim whitespace. | 120 characters |
| Positive prompt | Yes | Trim whitespace. | 1,000 characters |
| Negative prompt | No | Trim whitespace; use empty string when absent. | 1,000 characters |
| Generation request | Yes | Trim whitespace. | 2,000 characters |
| Refinement instruction | Yes | Trim whitespace. | 2,000 characters |

The model guidance recommends positive prompts of 250–700 characters but only enforces the 1,000-character ceiling. Negative prompts should usually contain 3–10 concise exclusions.

## Service contract

The current HTTP API is a reference contract, not a mandate for the destination application's transport. Responses use camelCase; timestamps are SQLite `CURRENT_TIMESTAMP` strings (UTC).

| Operation | Reference endpoint | Request | Result |
| --- | --- | --- | --- |
| Health check | `GET /api/health` | — | `{ ok: true }` |
| List active styles | `GET /api/styles` | — | Current-version style summaries, ordered by update time descending. |
| Get style history | `GET /api/styles/:id` | — | Summary plus `versions` in version-number descending order. |
| Create style | `POST /api/styles` | `StyleInput` | Created current summary, HTTP 201. |
| Append version | `POST /api/styles/:id/versions` | `StyleInput` | New current summary, HTTP 201. |
| Soft-delete style | `DELETE /api/styles/:id` | — | HTTP 204. |
| Generate candidates | `POST /api/generate` | `{ request }` | `{ positivePrompt, negativePrompt }` |
| Refine candidate | `POST /api/edit-style` | `{ instruction, positivePrompt, negativePrompt }` | `{ positivePrompt, negativePrompt }` |

`StyleInput`:

```ts
type StyleInput = {
  name: string
  positivePrompt: string
  negativePrompt?: string
  source?: 'manual' | 'import' | 'generated' | 'model-edit' | string
  metadata?: Record<string, unknown>
}
```

A summary contains the style fields plus its current version fields:

```ts
type StyleSummary = {
  id: number
  name: string
  currentVersionId: number
  createdAt: string
  updatedAt: string
  versionNumber: number
  positivePrompt: string
  negativePrompt: string
  metadataJson: string
  versionCreatedAt: string
}

type StyleVersion = {
  id: number
  versionNumber: number
  positivePrompt: string
  negativePrompt: string
  metadataJson: string
  createdAt: string
}

type StyleDetail = StyleSummary & { versions: StyleVersion[] }
```

Expected errors are JSON objects in the form `{ "error": string }`: invalid input and model response errors are client errors; a missing or deleted style is a 404. The destination should preserve user-actionable error text but may use its own error envelope.

## Model integration

### Trust boundary

Model calls run only in a server-side environment. Never expose an OpenRouter API key or equivalent provider credential to the browser/client.

The current provider is OpenRouter's chat-completions API. Configuration is:

```text
OPENROUTER_API_KEY        required
OPENROUTER_MODEL          optional; default deepseek/deepseek-v4-pro
OPENROUTER_SITE_URL       optional HTTP-Referer
OPENROUTER_APP_NAME       optional X-Title
```

The existing integration uses a 45-second request timeout, model temperature `0.9`, and requires exactly these two labeled fields with no commentary:

```text
STYLE PROMPT: <positive prompt>
NEGATIVE PROMPT: <negative prompt>
```

Parse the labels case-insensitively, trim surrounding code fences, reject missing labels, and reject either output if it is empty or exceeds 1,000 characters. Do not persist a generated or refined candidate automatically.

### Prompt policy

Both generation and refinement must preserve these rules:

- Create original Suno v5.5-oriented prompts.
- Keep positive and negative prompts separate.
- Do not include artists, bands, songs, albums, copyrighted lyrics, voice imitation, or `in the style of` phrasing.
- Convert referenced artists or works into neutral traits such as era, genre, mood, instrumentation, vocal delivery, arrangement, and production.
- Front-load genre and mood, then cover vocal delivery, instrumentation, tempo/key, arrangement, production, and mix.
- Keep positive prompts concise, natural, non-contradictory, and within the limit.
- Keep negatives concise and specific exclusions.

Refinement additionally receives the selected current-or-historical prompt pair and must preserve compatible useful direction while applying the user's request. If the old prompt or instruction contains a prohibited reference, the response removes it and substitutes neutral traits without commenting on the removal.

## Migration strategy

### Priority and compatibility posture

Data migration is optional for initial feature delivery. The destination should ship the library feature with the domain invariants above even if importing old data is deferred. No cross-application live synchronization is required.

When migration is implemented, prefer a one-time, idempotent import that preserves old identifiers and version history where practical. Treat the source database as read-only and take a consistent SQLite backup before processing.

### Source extraction

The source is a SQLite database at `data/styler.db`, with foreign keys enabled and WAL mode. Copy the database safely using SQLite backup tooling or by copying a checkpointed database; do not copy only the main database file while uncheckpointed WAL data exists.

Extract all rows from `styles` and `style_versions`, including soft-deleted styles. Import order is:

1. create styles with original IDs or retain a stable `legacyStyleId` mapping;
2. create every version with its original version number and timestamp;
3. resolve each style's current version from `current_version_id`;
4. copy `created_at`, `updated_at`, and `deleted_at` when the target can store them;
5. verify counts and relational integrity before marking the import complete.

### Field mapping

| Source field | Destination meaning | Notes |
| --- | --- | --- |
| `styles.id` | style ID or legacy external ID | Preserve when no collision risk. |
| `styles.name` | style name | Preserve verbatim; only normalize if target requires it. |
| `styles.current_version_id` | current version reference | Must reference an imported version of the same style. |
| `styles.created_at`, `updated_at`, `deleted_at` | lifecycle timestamps | Preserve as UTC values where possible. |
| `style_versions.id` | version ID or legacy external ID | Preserve when feasible. |
| `style_versions.style_id` | style reference | Resolve through the imported style map. |
| `style_versions.version_number` | version sequence | Preserve exactly. |
| `positive_prompt`, `negative_prompt` | prompt pair | Preserve exactly; do not regenerate. |
| `metadata_json` | version metadata | Parse and preserve unknown keys; retain raw JSON or record an import warning if malformed. |
| `style_versions.created_at` | version creation time | Preserve where possible. |

### Migration validation

For every imported style, verify:

- the destination has the same number of styles and versions as the source, including deleted styles;
- each source style maps to exactly one destination style;
- every destination current version belongs to its style and equals the source's current version mapping;
- version numbers, prompt strings, timestamps, deletion state, and metadata survive unchanged;
- active-list ordering matches source ordering when timestamps are preserved.

A malformed metadata JSON value should not abort the entire import: preserve its raw value if supported, otherwise import the prompts and record the affected source version ID for review. Missing current-version references or orphan versions are integrity failures and should stop migration rather than silently choosing a replacement.

### Cutover

1. Stop writes to the source app or accept that the import is a point-in-time snapshot.
2. Create and retain a source backup.
3. Run the import in a transaction or an import namespace that can be discarded on failure.
4. Run migration validation and inspect a small sample in the destination UI.
5. Enable the new feature after validation. Keep the backup until the destination's normal retention period permits deletion.

## Implementation dependencies

The feature needs:

- persistent storage with transactions and foreign-key-equivalent integrity;
- a trusted backend or server action layer for validation and model calls;
- a model provider credential store;
- client clipboard access for copy actions; and
- a UI state model for selection, draft dialogs, asynchronous operations, transient candidate histories, feedback, and errors.

The feature does not require the current presentation layer. The source app uses Vue 3, Vuetify, Express 5, better-sqlite3, and OpenRouter, but those are implementation choices rather than domain requirements.

## Acceptance checklist

- [ ] Users can create a named prompt pair with an optional negative prompt.
- [ ] A style edit creates a new immutable version and changes the active current version atomically.
- [ ] Users can inspect and select historical versions without mutating current-version state.
- [ ] Combined import splits dash-prefixed comma terms into `no …` exclusions and permits review before saving.
- [ ] Generation and refinement candidates remain unsaved until explicit user action.
- [ ] Model requests are server-side, enforce the required labeled output, and apply the original-content restrictions.
- [ ] Deleting a style is reversible at the data level because it is soft deletion.
- [ ] Input limits are enforced at the trusted boundary.
- [ ] If migration is enabled, imported style/version counts, version links, prompt content, metadata, and deletion state are verified.
