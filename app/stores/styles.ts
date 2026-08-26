import { defineStore } from 'pinia';
import type { Style, StyleDetail } from '../../shared/types/api';
import { api } from '../api';

export const useStylesStore = defineStore('styles', {
  state: () => ({ styles: [] as Style[], activeStyle: null as StyleDetail | null, loading: false }),
  actions: {
    async load() { this.loading = true; try { this.styles = await api.styles.list(); } finally { this.loading = false; } },
    async open(styleId: string) { this.activeStyle = await api.styles.get(styleId); },
    async create(args: { name: string; positive_prompt: string; negative_prompt?: string; metadata?: Record<string, unknown> }) {
      const detail = await api.styles.create(args); this.activeStyle = detail; this.styles.unshift(detail); return detail;
    },
    async append(args: { styleId: string; name: string; positive_prompt: string; negative_prompt?: string; metadata?: Record<string, unknown> }) {
      const detail = await api.styles.appendVersion(args); this.activeStyle = detail; this.styles = this.styles.map((style) => style.id === detail.id ? detail : style); return detail;
    },
    async remove(styleId: string) { await api.styles.delete(styleId); this.styles = this.styles.filter((style) => style.id !== styleId); if (this.activeStyle?.id === styleId) this.activeStyle = null; },
  },
});
