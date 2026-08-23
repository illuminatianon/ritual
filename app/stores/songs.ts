import { defineStore } from 'pinia';
import type { Song } from '../../shared/types/api';
import { api } from '../api';

export const useSongsStore = defineStore('songs', {
  state: () => ({
    songs: [] as Song[],
    archived: [] as Song[],
    activeSongId: null as string | null,
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
          this.activeSongId = this.songs[0]?.id ?? null;
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
    async rename(id: string, name: string) {
      const song = await api.songs.rename(id, name);
      this.songs = this.songs.map((item) => (item.id === id ? song : item));
      return song;
    },
    setLatestVersion(id: string, version: { version_number: number; updated_at: string } | null) {
      this.songs = this.songs.map((song) =>
        song.id === id
          ? {
              ...song,
              latest_version_number: version?.version_number ?? null,
              latest_version_updated_at: version?.updated_at ?? null,
              updated_at: version?.updated_at ?? song.updated_at,
              next_version_number: version
                ? Math.max(song.next_version_number, version.version_number + 1)
                : song.next_version_number,
            }
          : song,
      );
    },
    async archive(id: string) {
      await api.songs.archive(id);
      this.songs = this.songs.filter((song) => song.id !== id);
      if (this.activeSongId === id) {
        this.activeSongId = this.songs[0]?.id ?? null;
      }
      await this.loadArchived();
    },
    async restore(id: string) {
      const song = await api.songs.restore(id);
      this.archived = this.archived.filter((item) => item.id !== id);
      this.songs.unshift(song);
      this.activeSongId = song.id;
      return song;
    },
    async deletePermanent(id: string) {
      await api.songs.deletePermanent(id);
      this.archived = this.archived.filter((song) => song.id !== id);
    },
    setActive(id: string | null) {
      this.activeSongId = id;
    },
  },
});
