import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import electron from 'vite-plugin-electron/simple';
import renderer from 'vite-plugin-electron-renderer';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    vue(),
    electron({
      main: {
        entry: 'packages/backend/src/main.ts',
        vite: {
          build: {
            rollupOptions: {
              external: ['better-sqlite3'],
            },
          },
        },
      },
      preload: {
        input: 'packages/backend/src/preload.ts',
      },
    }),
    renderer(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./packages/frontend/src', import.meta.url)),
      '@ritual/backend': fileURLToPath(new URL('./packages/backend/src', import.meta.url)),
      'syllable-engine': fileURLToPath(new URL('./packages/syllable-engine/src/index.ts', import.meta.url)),
    },
  },
});
