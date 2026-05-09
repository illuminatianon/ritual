import { defineStore } from 'pinia';
import type { Song } from '@ritual/backend/api';
import { api } from '../api';

export const useSongsStore = defineStore('songs', {
  state: () => ({
    songs: [] as Song[],
    archived: [] as Song[],
    activeSongId: null as number | null,
    archiveOpen: false,
    loading: false,
  }),
  getters: {
    activeSong(state): Song | null {
      return state.songs.find((song) => song.id === state.activeSongId) ?? null;
    },
  },
  actions: {
    async loadAll() {
      this.loading = true;
      try {
        this.songs = await api.songs.list();
        if (this.activeSongId == null && this.songs.length > 0) {
          this.activeSongId = this.songs[0].id;
        }
      } finally {
        this.loading = false;
      }
    },
    async loadArchived() {
      this.archived = await api.songs.list({ archived: true });
    },
    async create(name: string) {
      const song = await api.songs.create(name);
      this.songs.unshift(song);
      this.activeSongId = song.id;
      return song;
    },
    async rename(id: number, name: string) {
      const song = await api.songs.rename(id, name);
      this.songs = this.songs.map((item) => (item.id === id ? song : item));
      return song;
    },
    setLatestVersion(id: number, version: { version_number: number; updated_at: string } | null) {
      this.songs = this.songs.map((song) =>
        song.id === id
          ? {
              ...song,
              latest_version_number: version?.version_number ?? null,
              latest_version_updated_at: version?.updated_at ?? null,
              updated_at: version?.updated_at ?? song.updated_at,
            }
          : song,
      );
    },
    async archive(id: number) {
      await api.songs.archive(id);
      this.songs = this.songs.filter((song) => song.id !== id);
      if (this.activeSongId === id) {
        this.activeSongId = this.songs[0]?.id ?? null;
      }
      await this.loadArchived();
    },
    async restore(id: number) {
      const song = await api.songs.restore(id);
      this.archived = this.archived.filter((item) => item.id !== id);
      this.songs.unshift(song);
      this.activeSongId = song.id;
      return song;
    },
    async deletePermanent(id: number) {
      await api.songs.deletePermanent(id);
      this.archived = this.archived.filter((song) => song.id !== id);
    },
    setActive(id: number | null) {
      this.activeSongId = id;
    },
  },
});
