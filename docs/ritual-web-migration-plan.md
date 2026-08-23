# Ritual: Electron → Nuxt Web Application Migration Plan

**Audience:** OMP / Terra implementation agent  
**Status:** Architecture agreed; ready for implementation  
**Primary goal:** Convert the existing Electron-based Ritual lyrics editor into a self-hosted web application without unnecessarily rewriting the editor or its domain logic.

---

## 1. Executive summary

Ritual is currently an Electron application with a Vue 3/Pinia/CodeMirror renderer, a small Electron IPC boundary, SQLite persistence through `better-sqlite3`, and a pure TypeScript syllable engine.

The migration should preserve the existing application behavior and UI while replacing the Electron perimeter with a Nuxt/Nitro web server and PostgreSQL persistence.

### Approved target stack

- **Nuxt 4** as the application framework.
- **Vue 3** for the UI, retaining the existing components and interaction model.
- **Client-side rendering (`ssr: false`)** for the editor application.
- **Nitro server routes** for the application API; do not introduce a separate Express/Fastify service.
- **Pinia** retained for client state.
- **CodeMirror 6** retained unchanged unless Nuxt integration requires minor lifecycle/import changes.
- **`syllable-engine`** retained as a pure TypeScript workspace package.
- **PostgreSQL** as the primary database.
- **Drizzle ORM + Drizzle Kit** for schema/query/migration management.
- **Google OAuth** for sign-in.
- **Nuxt Auth Utils** for the OAuth flow and sealed cookie session handling.
- **Application-owned `users` and `oauth_accounts` tables** so accounts/ownership exist from day one.
- **UUID primary keys** for users, songs, versions, and OAuth account records.
- **Friendly per-song integer version numbers** (`v1`, `v2`, …) preserved independently of UUID IDs.
- **Docker Compose** for local PostgreSQL only; do not require a host PostgreSQL daemon.
- **nginx → Nuxt/Nitro Node server** in production.
- **PM2** as the initial process manager, one application process by default.

### Architecture in one picture

```text
Browser
  |
  | HTTPS
  v
nginx
  |
  | proxy_pass http://127.0.0.1:3000
  v
Nuxt 4 / Nitro
  |
  +-- Vue / Pinia / CodeMirror SPA
  |
  +-- Nuxt Auth Utils
  |     +-- Google OAuth
  |     +-- sealed session cookie
  |
  +-- /api/* Nitro routes
        |
        +-- authenticated repositories/services
              |
              v
        Drizzle ORM
              |
              v
          PostgreSQL
```

---

## 2. Non-goals and guardrails

This is a platform migration, **not a redesign**.

Do not use the migration as an excuse to replace working application logic.

### Preserve unless there is a concrete blocker

- Current overall three-column application layout.
- Existing dark visual design and CSS.
- Current song/archive workflow.
- Version snapshot semantics.
- CodeMirror editor behavior.
- Syllable count gutter and word annotations.
- Baseline syllable comparison behavior.
- Diff panel behavior.
- Keyboard shortcuts.
- Clipboard behavior.
- Pinia-based client state organization where it remains useful.
- Existing unit tests for diff, editor alignment, syllable engine, and repository semantics where applicable.

### Explicitly avoid

- No UI component framework migration.
- No Tailwind migration unless already independently required; it is not required by this plan.
- No separate REST server framework beside Nitro.
- No GraphQL.
- No SSR complexity for the editor.
- No password authentication.
- No storage of Google access/refresh tokens unless a future feature actually requires Google APIs.
- No permissive CORS configuration; browser app and API are same-origin.
- No Electron compatibility layer after migration is complete.
- No attempt to preserve old integer database IDs as public identifiers.
- No clever delta-based version storage. Continue storing complete lyric snapshots.

The implementation should favor **parity first, cleanup second**.

---

## 3. Current application boundaries to preserve

The current frontend already has a useful abstraction boundary:

```text
Pinia stores/components
        |
        v
      api.ts
        |
        v
window.api / Electron IPC
        |
        v
SQLite repositories
```

The web migration should keep the same conceptual boundary:

```text
Pinia stores/components
        |
        v
      api.ts
        |
        v
$fetch / HTTP
        |
        v
Nitro API routes
        |
        v
Postgres repositories
```

A key goal is that calls such as these remain conceptually identical from the stores' perspective:

```ts
await api.songs.list()
await api.songs.create(name)
await api.versions.list(songId)
await api.versions.save({ songId, lyrics, label })
```

Do **not** scatter raw `$fetch()` calls through components just because Nuxt makes that easy. Keep a typed application API adapter so the frontend remains isolated from transport details.

---

## 4. Target repository layout

The exact final layout may vary slightly with Nuxt conventions, but aim for this structure:

```text
ritual/
├── app/
│   ├── components/
│   │   ├── DiffPanel.vue
│   │   ├── EditorPane.vue
│   │   ├── Sidebar.vue
│   │   └── StatusBar.vue
│   ├── diff/
│   │   ├── compute.ts
│   │   └── compute.test.ts
│   ├── editor/
│   │   ├── extensions.ts
│   │   ├── extensions.test.ts
│   │   └── sections.ts
│   ├── middleware/
│   │   └── auth.ts
│   ├── pages/
│   │   ├── index.vue
│   │   └── login.vue
│   ├── stores/
│   │   ├── prefs.ts
│   │   ├── song.ts
│   │   └── songs.ts
│   ├── api.ts
│   └── styles.css
├── server/
│   ├── api/
│   │   ├── songs/
│   │   └── versions/
│   ├── routes/
│   │   └── auth/
│   │       └── google.get.ts
│   ├── db/
│   │   ├── client.ts
│   │   ├── schema.ts
│   │   └── repositories/
│   │       ├── users.ts
│   │       ├── songs.ts
│   │       └── versions.ts
│   └── utils/
│       ├── auth.ts
│       └── validation.ts
├── shared/
│   └── types/
│       ├── api.ts
│       └── auth.d.ts
├── packages/
│   └── syllable-engine/
├── drizzle/
├── scripts/
│   └── import-electron-sqlite.ts
├── docker-compose.yml
├── drizzle.config.ts
├── ecosystem.config.cjs
├── nuxt.config.ts
├── package.json
├── pnpm-workspace.yaml
└── .env.example
```

### Cleanup after parity is confirmed

Remove:

- `packages/backend/src/main.ts`
- Electron preload code.
- Electron IPC registration code.
- Electron Vite plugins.
- Electron builder configuration.
- Electron native dependency installation script.
- Windows Electron worktree/build script.
- `better-sqlite3` from the runtime app.
- Electron-specific package scripts and dependencies.

`packages/backend` may disappear entirely once shared API types have moved into `shared/` and server repositories live under `server/`.

---

## 5. Nuxt configuration

Use Nuxt as a **Node-hosted full-stack application**, not a static generated site.

Recommended shape:

```ts
export default defineNuxtConfig({
  ssr: false,
  modules: [
    '@pinia/nuxt',
    'nuxt-auth-utils',
  ],
  nitro: {
    preset: 'node-server',
  },
})
```

Exact module syntax should follow the installed versions at implementation time.

Important distinction:

- `ssr: false` is intentional for the Vue editor.
- The production artifact must still be produced with **`nuxt build`**, because Nitro API routes and Nuxt Auth Utils require the Nuxt server.
- Do **not** switch production deployment to `nuxt generate` / static-only hosting.

The application should run in production as roughly:

```sh
NODE_ENV=production node .output/server/index.mjs
```

PM2 will wrap that entry point later in this plan.

---

## 6. Authentication and account model

### 6.1 Authentication choice

Use **Nuxt Auth Utils + Google OAuth**.

Ritual does not need Google API access after authentication. Google is an identity provider only.

Therefore:

- Request only the identity/profile/email scopes required for login.
- Do not persist OAuth access tokens.
- Do not persist refresh tokens.
- Do not put provider tokens into the browser-visible session.

### 6.2 Session contents

The sealed session cookie should contain only essential application identity information, e.g.:

```ts
interface RitualSessionUser {
  id: string       // internal Ritual user UUID
  email: string
  name: string | null
  avatarUrl: string | null
}
```

Keep the session small.

### 6.3 Persistent user identity

Do not use email as the only OAuth identity key.

Persist the stable Google provider subject/account ID in `oauth_accounts`.

On successful Google authentication:

1. Read the provider's stable user identifier (`sub` / provider account ID according to the installed handler's type).
2. Require an email from Google.
3. Prefer a verified email; do not silently trust an unverified email for account linking.
4. Look for `oauth_accounts(provider = 'google', provider_account_id = ...)`.
5. If found, load its user.
6. If not found:
   - determine whether signup is currently permitted;
   - create or safely link the local `users` row;
   - create the `oauth_accounts` row.
7. Update display name/avatar/last-login metadata as appropriate.
8. Create the sealed Nuxt session using the **internal Ritual user UUID**.
9. Redirect to `/`.

### 6.4 Initial registration policy

The database should support multiple users immediately, but the initial production deployment is expected to have one real user.

Implement a simple configurable registration policy rather than hard-coding a single account.

Recommended modes:

```text
allowlist   # default initially
open        # future public/multi-user signup
closed      # only previously linked accounts may sign in
```

Suggested environment configuration:

```dotenv
RITUAL_AUTH_MODE=allowlist
RITUAL_ALLOWED_EMAILS=user@example.com
```

The exact environment → Nuxt runtime config wiring may follow Nuxt conventions, but the behavior above should exist.

This gives us real account infrastructure now without accidentally allowing every Google account on the internet to create a Ritual account on day one.

### 6.5 Server-side authorization helper

Create one helper such as:

```ts
const user = await requireCurrentUser(event)
```

Its responsibilities:

1. Call Nuxt Auth Utils' `requireUserSession(event)`.
2. Extract the internal user UUID.
3. Load that user from PostgreSQL.
4. Reject the request if the user no longer exists or is inactive.
5. Return the trusted database user record.

Do not authorize database access merely because a UUID exists in a cookie.

### 6.6 Route protection

- `/login` is public.
- `/auth/google` is public as required for OAuth.
- Nuxt Auth Utils' own session endpoint must not be blocked by custom API middleware.
- The editor application (`/`) requires an authenticated session.
- Every `/api/*` data route must independently enforce authentication and ownership server-side.

Client route middleware is for UX; it is **not** the security boundary.

---

## 7. PostgreSQL schema

Use PostgreSQL UUID primary keys while preserving human-friendly per-song version numbers.

Recommended conceptual schema follows.

### 7.1 `users`

```text
id              uuid primary key
email           text not null unique
display_name    text null
avatar_url      text null
active          boolean not null default true
created_at      timestamptz not null default now()
updated_at      timestamptz not null default now()
last_login_at   timestamptz null
```

Normalize email consistently before persistence/comparison.

### 7.2 `oauth_accounts`

```text
id                    uuid primary key
user_id               uuid not null references users(id) on delete cascade
provider              text not null
provider_account_id   text not null
created_at             timestamptz not null default now()
updated_at             timestamptz not null default now()

unique(provider, provider_account_id)
```

Do not store OAuth tokens here for the current feature set.

### 7.3 `songs`

```text
id                    uuid primary key
user_id               uuid not null references users(id) on delete cascade
name                   text not null
next_version_number    integer not null default 1
created_at             timestamptz not null default now()
updated_at             timestamptz not null default now()
archived_at            timestamptz null
```

Suggested index:

```text
(user_id, archived_at, updated_at)
```

### 7.4 `versions`

```text
id                uuid primary key
song_id           uuid not null references songs(id) on delete cascade
version_number    integer not null
lyrics            text not null
label             text null
created_at         timestamptz not null default now()
updated_at         timestamptz not null default now()

unique(song_id, version_number)
```

The unique constraint naturally indexes song/version lookup.

### 7.5 Friendly version number semantics

The UUID is the database/API identity.

The user-facing identity remains:

```text
v1
v2
v3: tightened chorus
v4
```

`version_number` is scoped to a song and should be **monotonic and never reused**.

This is an intentional improvement over deriving the next number from `MAX(version_number) + 1`.

When saving a new version:

1. Start a database transaction.
2. Atomically consume the song's `next_version_number` while checking ownership.
3. Increment `next_version_number`.
4. Insert the new version with the consumed integer.
5. Update the song timestamp.
6. Commit.

For example, conceptually:

```sql
UPDATE songs
SET next_version_number = next_version_number + 1,
    updated_at = now()
WHERE id = $song_id
  AND user_id = $user_id
RETURNING next_version_number - 1 AS version_number;
```

Then insert the version in the same transaction.

Consequences:

- Delete `v3`; the next save is `v4`, not a new `v3`.
- Two concurrent saves cannot both become `v7`.
- Human-facing version labels remain stable references.

---

## 8. Data ownership and IDOR protection

Every data operation must be scoped to the authenticated user.

Never accept a song/version UUID from the browser and then query only by that UUID.

### Song operations

Queries should include:

```text
songs.id = requestedSongId
AND songs.user_id = currentUser.id
```

### Version operations

Version ownership should be checked by joining through the parent song:

```text
versions.id = requestedVersionId
JOIN songs ON songs.id = versions.song_id
WHERE songs.user_id = currentUser.id
```

This rule applies to:

- load version;
- overwrite version;
- delete version;
- list versions;
- any future diff/export endpoint.

If a resource belongs to another user, return a normal not-found/unauthorized-safe response rather than leaking its existence.

Add integration tests proving that User A cannot read or mutate User B's songs or versions.

---

## 9. Server API contract

Retain a small typed client API wrapper so the existing Pinia stores need minimal change.

A reasonable REST mapping is below.

### Songs

```text
GET    /api/songs?archived=false
POST   /api/songs
PATCH  /api/songs/:songId
POST   /api/songs/:songId/archive
POST   /api/songs/:songId/restore
DELETE /api/songs/:songId
```

Example bodies:

```json
POST /api/songs
{
  "name": "Untitled Song"
}
```

```json
PATCH /api/songs/:songId
{
  "name": "goblin mode"
}
```

### Versions

```text
GET    /api/songs/:songId/versions
POST   /api/songs/:songId/versions
GET    /api/versions/:versionId
PUT    /api/versions/:versionId
DELETE /api/versions/:versionId
```

Example bodies:

```json
POST /api/songs/:songId/versions
{
  "lyrics": "...",
  "label": "tightened chorus"
}
```

```json
PUT /api/versions/:versionId
{
  "lyrics": "..."
}
```

The exact endpoint filenames should follow Nitro file routing conventions.

### Input validation

Validate all request bodies and path parameters at the API boundary.

Use one lightweight validation approach consistently (for example Zod) rather than ad hoc checks in every route.

Validate at minimum:

- UUID syntax where applicable;
- song name type/length;
- lyrics type;
- optional label type/length;
- archived query parameter.

Do not trust TypeScript interfaces as runtime validation.

---

## 10. Frontend API adapter

Replace the current Electron-backed API implementation with an HTTP-backed implementation while preserving the typed surface.

Conceptually:

```ts
export const api: Api = {
  songs: {
    list: (args) => $fetch('/api/songs', { query: args }),
    create: (name) => $fetch('/api/songs', {
      method: 'POST',
      body: { name },
    }),
    // ...
  },
  versions: {
    // ...
  },
}
```

Move the `Song`, `Version`, and `Api` interfaces out of the Electron backend package and into a shared location usable by client and server.

IDs change from `number` to `string` throughout the frontend types.

This will touch:

- `Song.id`;
- `Version.id`;
- `Version.song_id` (or migrate API naming to camelCase consistently if desired);
- `activeSongId`;
- `SongState.songId`;
- `loadedVersionId`;
- `diffTargetVersionId`;
- component event types;
- relevant `Record<number, ...>` structures.

For maps keyed by UUID, use:

```ts
Record<string, SongState>
```

Do not change display version numbers to UUIDs. `version_number` remains an integer.

---

## 11. Frontend/Nuxt integration

### 11.1 Main application page

Move the existing `App.vue` application shell into the Nuxt app structure with as little semantic change as possible.

A likely approach:

- `app/pages/index.vue` becomes the editor page/application shell.
- Existing child components move into `app/components`.
- Existing Pinia stores move into `app/stores`.
- Existing editor/diff modules move under `app/editor` and `app/diff`.

### 11.2 Browser-only behavior

Because the editor is intentionally CSR (`ssr: false`), existing browser APIs may remain browser-side:

- `localStorage` preferences;
- `navigator.clipboard`;
- `window.addEventListener` keyboard shortcuts;
- CodeMirror `EditorView`;
- dynamic `document.title` behavior.

Still keep lifecycle cleanup correct.

### 11.3 Preferences

Retain current local preferences in `localStorage` for now.

Do not move cosmetic/editor preferences to PostgreSQL as part of the platform migration unless necessary.

### 11.4 Unsaved draft recovery

**Not required for initial parity.**

After the web migration is stable, a follow-up enhancement may persist the current unsaved editor buffer to IndexedDB or local storage for crash/tab recovery.

This recovery mechanism should not replace deliberate `Save vX` snapshots.

Do not let this optional feature delay the core migration.

---

## 12. Local development: Docker Compose PostgreSQL

The developer does not want PostgreSQL or similar server daemons installed/running directly on the workstation.

Run PostgreSQL in Docker Compose; run the Nuxt dev process normally with pnpm.

Suggested `docker-compose.yml`:

```yaml
services:
  db:
    image: postgres:17-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ritual
      POSTGRES_USER: ritual
      POSTGRES_PASSWORD: ritual_dev
    ports:
      - "5432:5432"
    volumes:
      - ritual_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ritual -d ritual"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  ritual_pgdata:
```

If port 5432 conflicts with something in the actual environment, map a different host port rather than requiring a host PostgreSQL install.

Suggested local workflow:

```sh
docker compose up -d db
pnpm db:migrate
pnpm dev
```

And to stop the daemonized dependency:

```sh
docker compose down
```

Do **not** make the developer containerize the Nuxt dev server unless there is a concrete need. Source mounts, Node module volumes, and file watching would add complexity without solving the stated problem.

### Development database URL

Example:

```dotenv
DATABASE_URL=postgresql://ritual:ritual_dev@127.0.0.1:5432/ritual
```

Keep production credentials entirely separate.

---

## 13. Drizzle and migrations

Use schema files plus generated SQL migrations committed to the repository.

Expected scripts, names may vary slightly:

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "...",
    "db:studio": "drizzle-kit studio"
  }
}
```

For shared/deployed environments:

- Generate migrations deliberately.
- Commit migrations.
- Apply committed migrations on deploy.
- Do not rely on schema `push` against production.

Create one database client/pool module and reuse it server-side rather than creating a new pool per request.

---

## 14. Existing Electron SQLite import

Create a one-shot import script so existing Ritual data can move into PostgreSQL.

Suggested interface:

```sh
pnpm import:sqlite -- \
  --source /path/to/ritual.sqlite \
  --user user@example.com
```

### Preconditions

- The PostgreSQL schema has been migrated.
- The target user has signed in with Google at least once, so a canonical local account exists.
- The script can find exactly one target user by normalized email.

### Import behavior

For every old SQLite song:

1. Generate a new song UUID.
2. Attach the song to the selected PostgreSQL user.
3. Preserve:
   - name;
   - created timestamp;
   - updated timestamp;
   - archived timestamp.
4. Import every version with a new UUID.
5. Preserve:
   - `version_number`;
   - lyrics;
   - label;
   - created timestamp;
   - updated timestamp.
6. Set `songs.next_version_number` to:

```text
max(imported version_number) + 1
```

or `1` if the song has no versions.

### Safety requirements

- Run the import in a transaction where practical.
- Print counts before and after.
- Fail clearly on schema/data inconsistencies.
- Avoid silently duplicating an import.
- By default, refuse to import into a user who already has Ritual songs unless an explicit override flag is provided.
- Do not mutate the source SQLite file.

Old integer IDs do not need to be retained after relational mapping during the import.

---

## 15. Production deployment

### 15.1 Build

Expected deployment commands:

```sh
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm build
pm2 reload ritual
```

Adapt order for zero-downtime requirements if the schema later becomes more complex. For this initial migration the schema should be straightforward.

### 15.2 PM2

Initial `ecosystem.config.cjs` should favor simplicity:

```js
module.exports = {
  apps: [
    {
      name: 'ritual',
      script: './.output/server/index.mjs',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '127.0.0.1',
      },
    },
  ],
}
```

PostgreSQL removes the old SQLite reason to avoid multiple workers, but one process is more than adequate initially and easier to reason about.

Scale later if there is evidence that it matters.

### 15.3 nginx

Use nginx for TLS termination and reverse proxying.

Representative site config:

```nginx
server {
    listen 443 ssl http2;
    server_name ritual.example.com;

    # SSL configuration omitted here.

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Ensure the OAuth callback sees the correct public HTTPS origin.

### 15.4 Google OAuth production configuration

Create a Google OAuth web application with the appropriate production origin and callback.

Nuxt Auth Utils expects a provider callback route of the form:

```text
https://ritual.example.com/auth/google
```

Set the production redirect URL explicitly through environment configuration if proxy/origin autodetection is unreliable.

### 15.5 Production environment variables

At minimum:

```dotenv
NODE_ENV=production
PORT=3000
HOST=127.0.0.1

DATABASE_URL=postgresql://...

NUXT_SESSION_PASSWORD=<long-random-secret-at-least-32-chars>
NUXT_OAUTH_GOOGLE_CLIENT_ID=...
NUXT_OAUTH_GOOGLE_CLIENT_SECRET=...
NUXT_OAUTH_GOOGLE_REDIRECT_URL=https://ritual.example.com/auth/google

RITUAL_AUTH_MODE=allowlist
RITUAL_ALLOWED_EMAILS=user@example.com
```

Do not commit real values.

Provide a complete `.env.example` with safe placeholders.

---

## 16. Migration phases

The implementation agent should keep the project runnable as often as practical and avoid a single opaque mega-rewrite.

### Phase 0 — Baseline and inventory

- [ ] Run the existing tests and record current failures, if any.
- [ ] Run the existing build if practical.
- [ ] Confirm current Electron behavior relevant to parity.
- [ ] Identify all imports of Electron-specific backend/API types.
- [ ] Do not modify domain behavior yet.

**Exit condition:** baseline understood; no accidental pre-existing failures attributed to migration work.

### Phase 1 — Introduce Nuxt application shell

- [ ] Add Nuxt 4.
- [ ] Add `@pinia/nuxt`.
- [ ] Configure CSR with `ssr: false`.
- [ ] Configure Nitro Node server preset.
- [ ] Move or adapt the current Vue app into Nuxt's `app/` structure.
- [ ] Keep CodeMirror, diff, syllable, CSS, and local preference behavior working.
- [ ] Do not remove Electron yet if it is useful as a parity reference.

**Exit condition:** Nuxt renders the existing UI/editor locally without relying on Electron APIs for initial render.

### Phase 2 — PostgreSQL + Drizzle foundation

- [ ] Add Docker Compose PostgreSQL.
- [ ] Add Drizzle ORM / Drizzle Kit / PostgreSQL driver.
- [ ] Add `drizzle.config.ts`.
- [ ] Implement `users`, `oauth_accounts`, `songs`, `versions` schema.
- [ ] Add migrations.
- [ ] Add shared DB client/pool.
- [ ] Add DB scripts.
- [ ] Verify migration against a fresh Docker volume.

**Exit condition:** a clean local database can be started and migrated from zero with documented commands.

### Phase 3 — Google OAuth and persistent accounts

- [ ] Add Nuxt Auth Utils.
- [ ] Add Google OAuth handler.
- [ ] Implement persistent user/OAuth-account linking.
- [ ] Implement configurable allowlist/open/closed registration policy.
- [ ] Add typed session augmentation.
- [ ] Add `requireCurrentUser()` server helper.
- [ ] Add `/login` page and logout control.
- [ ] Protect the editor route.
- [ ] Confirm sealed session cookie works through local Nuxt server.

**Exit condition:** an allowed Google user can sign in, receives/links a local UUID account, reloads successfully, and can log out.

### Phase 4 — PostgreSQL repositories and authenticated Nitro API

- [ ] Port song repository behavior to Drizzle/Postgres.
- [ ] Port version repository behavior.
- [ ] Implement monotonic `next_version_number` transaction logic.
- [ ] Implement Nitro endpoints.
- [ ] Add runtime input validation.
- [ ] Scope every resource query to authenticated ownership.
- [ ] Add API/repository tests, including cross-user isolation tests.

**Exit condition:** API supports complete song/version lifecycle independent of the Electron renderer.

### Phase 5 — Replace Electron IPC client boundary

- [ ] Move shared API types out of `packages/backend`.
- [ ] Change IDs from number → UUID string throughout frontend types.
- [ ] Replace `window.api` implementation with typed `$fetch` wrapper.
- [ ] Keep Pinia store public behavior as unchanged as practical.
- [ ] Ensure create/rename/archive/restore/delete flows work.
- [ ] Ensure version list/save/load/overwrite/delete flows work.
- [ ] Ensure diff and baseline syllable features work with string IDs.

**Exit condition:** all normal application features work in a browser against Nitro/Postgres, with no Electron IPC dependency.

### Phase 6 — Existing data importer

- [ ] Implement SQLite → PostgreSQL import script.
- [ ] Preserve content, labels, archive status, timestamps, and friendly version numbers.
- [ ] Set correct `next_version_number` after import.
- [ ] Add dry-run or clear preflight output if easy to support.
- [ ] Verify against a copy of a representative Ritual SQLite database.

**Exit condition:** existing Electron data can be migrated safely into the authenticated user's account.

### Phase 7 — Remove Electron

- [ ] Remove Electron main/preload/IPC code.
- [ ] Remove Electron Vite plugins.
- [ ] Remove Electron builder and packaging config.
- [ ] Remove native Electron dependency rebuild scripts.
- [ ] Remove Windows Electron build helper.
- [ ] Remove `better-sqlite3` from normal application runtime.
- [ ] Update package scripts.
- [ ] Update README to describe the web application.

**Exit condition:** `pnpm install`, `pnpm test`, `pnpm build`, and `pnpm dev` do not require Electron.

### Phase 8 — Production deployment assets

- [ ] Add `ecosystem.config.cjs`.
- [ ] Add nginx example/documentation.
- [ ] Add `.env.example`.
- [ ] Document Google OAuth callback configuration.
- [ ] Document database migration command.
- [ ] Document deploy/reload procedure.
- [ ] Confirm production build runs via `.output/server/index.mjs`.

**Exit condition:** deploy can be performed on a normal Linux Node host behind nginx without any desktop packaging step.

---

## 17. Test and acceptance matrix

### Authentication

- [ ] Unauthenticated visitor is sent to login.
- [ ] Disallowed Google account cannot register when mode is `allowlist`.
- [ ] Allowed Google account creates a local user on first login.
- [ ] Re-login links to the same local user, not a duplicate.
- [ ] Session survives normal reload.
- [ ] Logout clears access.
- [ ] Inactive/deleted local user cannot continue accessing API merely with an old session cookie.

### User isolation

With two test users:

- [ ] User A cannot list User B's songs.
- [ ] User A cannot load User B's song by UUID.
- [ ] User A cannot rename/archive/restore/delete User B's song.
- [ ] User A cannot list User B's versions.
- [ ] User A cannot load/overwrite/delete User B's version by UUID.

### Songs

- [ ] Create song.
- [ ] Rename song.
- [ ] Archive song.
- [ ] List archived songs.
- [ ] Restore song.
- [ ] Permanently delete archived song and cascade versions.

### Versions

- [ ] First save becomes `v1`.
- [ ] Second save becomes `v2`.
- [ ] Labels are preserved.
- [ ] Loading an old version works.
- [ ] Overwriting a loaded version updates content without changing its friendly number.
- [ ] Deleting a version works.
- [ ] Deleting latest `vN`, then saving again, produces `vN+1`, not a reused number.
- [ ] Concurrent new-version saves receive distinct friendly version numbers.

### Editor parity

- [ ] CodeMirror loads and edits normally.
- [ ] Syllable line counts work.
- [ ] Section totals work.
- [ ] Word annotation toggle works.
- [ ] Baseline syllable counts align after line edits.
- [ ] Diff panel renders additions/removals.
- [ ] Diff baseline picker works.
- [ ] Copy-to-clipboard actions work.
- [ ] `Ctrl/Cmd+S` saves a new version.
- [ ] `Ctrl/Cmd+Shift+S` preserves current overwrite behavior.
- [ ] Dirty-change confirmation still protects navigation/song switches.
- [ ] Sidebar collapsed preference survives reload.
- [ ] Word annotation preference survives reload.
- [ ] Browser title reflects active song/version as before.

### Build/development

- [ ] Fresh clone + `pnpm install` succeeds without Electron native rebuilds.
- [ ] `docker compose up -d db` starts the only required local server daemon.
- [ ] Fresh database migrates from zero.
- [ ] `pnpm test` passes.
- [ ] `pnpm build` produces Nuxt `.output` Node server.
- [ ] Production output runs locally with Node.

---

## 18. Error handling expectations

Keep error handling simple but deliberate.

### API

Use appropriate HTTP errors:

```text
400 / 422  invalid input
401        no valid session
403        authenticated but signup/access policy rejects action
404        owned resource not found (also acceptable for foreign resource IDs)
409        genuine state/constraint conflict
500        unexpected server error
```

Do not expose raw PostgreSQL errors or stack traces to the browser in production.

### Frontend

The current app primarily assumes API success. During migration add a minimal common error path so a transient API failure does not produce silent corruption.

At minimum:

- show a visible failure notice for save/overwrite/delete failures;
- do not mark a document clean when a save failed;
- preserve the user's current editor contents after failed network/database operations.

Do not turn this into a broad notification-system rewrite.

---

## 19. Security checklist

- [ ] Google OAuth client secret is server-only.
- [ ] Session password is long/random and server-only.
- [ ] No OAuth tokens sent to the browser beyond what Nuxt Auth Utils inherently requires for the login flow.
- [ ] No OAuth tokens persisted unnecessarily.
- [ ] All mutation/read APIs use `requireCurrentUser()`.
- [ ] All song/version queries enforce ownership server-side.
- [ ] No permissive `Access-Control-Allow-Origin: *` setup.
- [ ] Production cookies use HTTPS/secure behavior appropriate to the deployed origin.
- [ ] nginx forwards `Host` and `X-Forwarded-Proto` correctly.
- [ ] Google callback URL is HTTPS in production.
- [ ] User-supplied text is rendered as text, not injected HTML.
- [ ] Database credentials are not bundled into the frontend.
- [ ] `.env` remains ignored; `.env.example` contains placeholders only.

---

## 20. Deliberate behavior changes from Electron version

These changes are approved/expected as part of becoming a web application:

1. **IDs become UUID strings.**
   - Internal song/version identity is no longer a sequential integer.

2. **Friendly version numbers never rewind/reuse.**
   - Deleting `v5` does not make the next save `v5` again.

3. **All songs have an owner.**
   - `songs.user_id` is mandatory.

4. **Authentication is required.**
   - Google OAuth is the initial sign-in mechanism.

5. **Persistence moves from local Electron SQLite to central PostgreSQL.**
   - Existing local data is migrated with a one-shot importer.

6. **The application is reached in a browser instead of being packaged per desktop OS.**

These should not otherwise change the writing/versioning workflow.

---

## 21. Implementation-agent instructions

Treat this document as the intended architecture unless the current repository proves a detail impossible or a library API has materially changed.

If a package's exact API differs from examples in this plan:

1. use the currently installed/current stable API;
2. preserve the behavior and architecture described here;
3. document the deviation in the final implementation summary.

### Priorities

In order:

1. Preserve user-visible Ritual behavior.
2. Establish correct authentication/ownership boundaries.
3. Establish reliable PostgreSQL persistence and migrations.
4. Minimize unnecessary frontend churn.
5. Remove Electron completely after browser parity is proven.
6. Leave the repository understandable for future human work.

### Do not stop halfway at a hybrid architecture

Temporary Electron compatibility during implementation is fine, but the completed migration should not retain Electron as a required runtime/build target.

The finished default development path should be approximately:

```sh
pnpm install
docker compose up -d db
pnpm db:migrate
pnpm dev
```

The finished default production path should be approximately:

```sh
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm build
pm2 reload ritual
```

### Final handoff report should include

- Summary of architecture actually implemented.
- Any deviations from this plan and why.
- Database migration commands.
- Local development commands.
- Google OAuth setup requirements.
- Production environment variables.
- Existing SQLite import command.
- Test/build results.
- Any remaining known issues or deliberately deferred items.

---

## 22. Reference notes

The starting repository is the current Electron/Vue/Pinia/CodeMirror application supplied with this planning task. The migration intentionally takes advantage of the fact that most application behavior already lives in browser-compatible Vue/TypeScript code and that the Electron IPC API is a narrow persistence boundary.

Current documentation consulted while preparing this plan:

- Nuxt 4 deployment / Node server / PM2: https://nuxt.com/docs/4.x/getting-started/deployment
- Nuxt sessions/authentication recipe: https://nuxt.com/docs/4.x/guide/recipes/sessions-and-authentication
- Nuxt Auth Utils module docs: https://nuxt.com/modules/auth-utils
- Drizzle PostgreSQL guide: https://orm.drizzle.team/docs/get-started-postgresql
- Drizzle migration concepts: https://orm.drizzle.team/docs/migrations

Library APIs evolve. The implementation agent should verify exact installed-version signatures while preserving the decisions in this plan.
