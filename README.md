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

## Desktop Builds

Linux remains the local fallback build:

```sh
pnpm electron:build:linux
```

Build Windows from a native Windows checkout with:

```sh
pnpm install
pnpm electron:build:windows
```

From WSL, keep the Linux checkout untouched and build Windows in a detached worktree on the Windows filesystem:

```sh
pnpm electron:build:windows:wsl
```

The WSL helper builds committed `HEAD` under `/mnt/d/dev/lumi/ritual` by default. Override with `WINDOWS_BUILD_DIR=/mnt/d/dev/lumi/other-dir` if needed.

## Packages

- `packages/backend` — Electron main process, SQLite persistence, IPC, preload bridge.
- `packages/frontend` — Vue 3 renderer, Pinia stores, CodeMirror lyrics editor, diff UI.
- `packages/syllable-engine` — Pure TypeScript syllable counting and tokenization.
