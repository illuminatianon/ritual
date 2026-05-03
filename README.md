# Ritual

Electron desktop app scaffolded with TypeScript, pnpm, Vue 3, Vite, and CodeMirror.

## Scripts

```sh
pnpm install
pnpm dev
pnpm build
pnpm test
```

`pnpm dev` starts the Vite dev server and launches Electron through the Vite Electron plugin.

## Packages

- `packages/backend` — Electron main process, SQLite persistence, IPC, preload bridge.
- `packages/frontend` — Vue 3 renderer, Pinia stores, CodeMirror lyrics editor, diff UI.
- `packages/syllable-engine` — Pure TypeScript syllable counting and tokenization.
