/// <reference types="vite/client" />

import type { Api } from '@ritual/backend/api';

declare global {
  interface Window {
    api: Api;
  }
}
