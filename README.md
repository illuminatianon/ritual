# Ritual

Self-hosted lyrics editor built with Nuxt 4, Vue 3, Pinia, CodeMirror, PostgreSQL, and Google OAuth.

## Local development

```sh
pnpm install
cp .env.example .env
docker compose up -d db
pnpm db:migrate
pnpm dev
```

The Nuxt application runs locally; PostgreSQL is the only local daemon and runs in Docker Compose.

## Database

Run migration commands with `DATABASE_URL` set. The provided `.env.example` matches `docker-compose.yml`.

```sh
pnpm db:generate
pnpm db:migrate
```

Apply committed migrations with `pnpm db:migrate`; do not use schema push for deployed databases.

## Google OAuth

Create a Google OAuth web client and set these environment variables:

```dotenv
NUXT_SESSION_PASSWORD=<long-random-secret-at-least-32-characters>
NUXT_OAUTH_GOOGLE_CLIENT_ID=<client-id>
NUXT_OAUTH_GOOGLE_CLIENT_SECRET=<client-secret>
NUXT_OAUTH_GOOGLE_REDIRECT_URL=https://ritual.example.com/auth/google
NUXT_RITUAL_AUTH_MODE=allowlist
NUXT_RITUAL_ALLOWED_EMAILS=user@example.com
```

Registration modes are `allowlist` (the default), `open`, and `closed`. OAuth access and refresh tokens are not stored.

For local HTTP development, use `pnpm dev` and the same origin consistently—`http://localhost:3000` in the provided example. Do not set `NODE_ENV=production` in local `.env`: OAuth state cookies are intentionally `Secure` in production and require HTTPS. A production deployment must use the public HTTPS callback URL and forwarded HTTPS proxy headers.

## Existing SQLite data

Sign in once with the target Google account, migrate PostgreSQL, then import a copy of the Electron SQLite database:

```sh
pnpm import:sqlite -- --source /path/to/ritual.sqlite --user user@example.com --dry-run
pnpm import:sqlite -- --source /path/to/ritual.sqlite --user user@example.com
```

The importer preserves timestamps, archive status, labels, lyrics, and friendly version numbers. It refuses a target account that already owns songs unless `--force` is explicit.

## Production

Set the production variables from `.env.example`, configure Google with `https://ritual.example.com/auth/google`, and put nginx in front of the Node server. A proxy example is in `deploy/nginx.conf.example`.

```sh
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm build
pm2 reload ecosystem.config.cjs --only ritual
```

`ecosystem.config.cjs` runs one Nitro Node process on `127.0.0.1:3000`.

## Verification

```sh
pnpm test
pnpm typecheck
pnpm build
```

Run PostgreSQL integration tests explicitly after Docker PostgreSQL is migrated:

```sh
RITUAL_TEST_DATABASE_URL=postgresql://ritual:ritual_dev@127.0.0.1:5432/ritual pnpm test:db
```

## Workspace package

- `packages/syllable-engine` — Pure TypeScript syllable counting and tokenization.
