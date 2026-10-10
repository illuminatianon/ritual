# Repository Guidelines

## Project Overview

Ritual is a self-hosted lyrics editor with song/version history and a Style prompt library. The current application is a Nuxt 4 client-rendered Vue 3 app with Google OAuth and PostgreSQL; older Electron/SQLite code and design documents describe the predecessor, not the active runtime.

## Architecture & Data Flow

- `app/pages/` enters the authenticated UI; Vue components use Pinia stores in `app/stores/`. Store actions call the typed `$fetch` adapter in `app/api.ts`.
- Nitro file routes in `server/api/` authenticate via `server/utils/auth.ts`, validate inputs via Zod helpers in `server/utils/validation.ts`, then call `server/db/repositories/`. Repositories enforce per-user ownership and use Drizzle/PostgreSQL through `server/db/client.ts`.
- `shared/types/api.ts` defines the client/server wire contract. `server/routes/auth/google.get.ts` handles OAuth and session creation. The CodeMirror editor lives in `app/editor/` and uses `packages/syllable-engine` for lyric annotations.

## Key Directories

- `app/components/`, `app/workbench/`, `app/styles/`: editor UI, layout, and Style workspace; `app/stores/`: songs, current song, styles, preferences.
- `server/api/`, `server/utils/`, `server/db/`: HTTP handlers, auth/validation/model helpers, schema and repositories.
- `shared/types/`: API/session types; `packages/syllable-engine/`: active pure TypeScript workspace package.
- `drizzle/`: committed PostgreSQL migrations; `scripts/`: database test wrapper and SQLite importers; `docs/`: designs and migration history, some Electron-era and outdated.

## Development Commands

```sh
pnpm install
test -e .env || cp .env.example .env
docker compose up --build
docker compose exec app pnpm db:migrate
pnpm dev                    # alternative to the Compose app service
pnpm test
pnpm typecheck
pnpm build
pnpm preview                # run the built Nitro server
```

`DATABASE_URL` is required for Drizzle commands: `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:studio`. Apply committed migrations with `db:migrate`, not schema push. There is no declared lint script.

## Code Conventions & Common Patterns

- Use TypeScript with strict Nuxt checking, Vue SFCs with `<script setup lang="ts">`, and existing single-quoted, semicolon-terminated source style. Match nearby naming: `useSongsStore`, `requireCurrentUser`, `*.get.ts` / `*.post.ts` handlers, and colocated `*.test.ts`.
- Keep HTTP parsing/auth/errors in handlers and helpers, persistence and ownership predicates in repositories, and client state transitions in Pinia actions. Add wire changes to `shared/types/api.ts` and the `app/api.ts` adapter together.
- Validate external input with Zod; use H3 `createError` for HTTP status (for example, 400 malformed IDs, 422 invalid bodies, 401 unauthenticated, 404 missing/foreign records). Async store actions await the API before changing state and clear loading flags in `finally` where needed.
- Prefer the existing module-level Drizzle pool and explicit imports over introducing a DI container. Browser preferences use `localStorage`; editor instances register/unregister with store callbacks on mount/unmount.

## Important Files

- `nuxt.config.ts`: SPA, modules, runtime config; `app/pages/index.vue` and `app/components/RitualApp.vue`: authenticated editor entry.
- `app/api.ts`, `shared/types/api.ts`: transport and contract; `server/db/schema.ts`, `server/db/client.ts`, `server/db/repositories/`: persistent model.
- `server/routes/auth/google.get.ts`, `server/utils/auth.ts`: Google login and access gate; `drizzle.config.ts`: migration config; `vitest.config.ts`: test setup.
- `README.md`: current setup/deployment reference. Treat `docs/architecture.md` and `docs/ritual-web-migration-plan.md` as historical, not operational instructions.

## Runtime/Tooling Preferences

- Use Node (the Docker image uses Node 24), Corepack/pnpm `10.18.2` from `package.json`, and the checked-in `pnpm-lock.yaml`; do not assume Bun. Workspace membership is declared in `pnpm-workspace.yaml`.
- Local Compose runs PostgreSQL 17 and the Nuxt dev server. For OAuth in local development, consistently use `http://localhost:3000` and its `/auth/google` callback; production requires HTTPS and forwarded proxy headers. Keep credentials in `.env`, not version control.

## Testing & QA

- Vitest runs in the Node environment via `pnpm test`; tests are colocated with app/server modules and under `packages/syllable-engine/test/`. Run `pnpm typecheck` and `pnpm build` for cross-module changes. No coverage threshold is configured.
- PostgreSQL repository integration tests require a migrated test database and `RITUAL_TEST_DATABASE_URL`; `pnpm test:db` runs the ownership test subset. Never point integration tests at valuable data. For user-visible changes, exercise the actual application in addition to tests.

## Database Safety

Agents MUST NOT delete, reset, recreate, truncate, or otherwise destroy the Ritual database or its Docker volume unless the user explicitly authorizes that destructive operation in the current conversation.

## Git Workflow

- **Use Conventional Commits** for all commits. Supported types include `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `build`, `ci`, and `chore`.
- Write specific, meaningful commit messages describing the actual change. Avoid generic messages such as `updates`, `changes`, or `implementation`.
- Mark breaking changes using `!` and/or a `BREAKING CHANGE:` footer when appropriate.
- **Commit completed, coherent units of work incrementally** rather than accumulating an entire task into one large commit. Agents are authorized and encouraged to create local commits without requesting permission.
- Prefer sensible, atomic commits over minimizing commit count. Do not create artificial checkpoints merely to increase the number of commits.
- Run relevant tests, typechecks, or other verification before committing. Do not knowingly commit broken or incomplete changes.
- Inspect the working tree before making changes and before staging. Preserve pre-existing modifications and stage only files relevant to the current task.
- Include necessary generated files and lockfile updates with the changes that require them.
- Never commit secrets, credentials, local environment files, temporary debugging artifacts, or unrelated existing work.
- Do not amend, rebase, reset, or otherwise rewrite existing history without explicit permission.
- **Do not push, merge, or deploy unless explicitly instructed.** Permission to create local commits does not imply permission to modify remote repositories or environments.
- At the end of a task, summarize commits created, verification performed, and any remaining uncommitted changes.