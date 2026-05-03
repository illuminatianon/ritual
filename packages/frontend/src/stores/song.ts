import { defineStore } from 'pinia';
import type { EditorView } from '@codemirror/view';
import type { Version } from '@ritual/backend/api';
import { api } from '../api';
import { useSongsStore } from './songs';

export interface SongState {
  songId: number;
  versions: Version[];
  loadedVersionId: number | null;
  dirty: boolean;
  diffTargetVersionId: number | null;
  view: EditorView | null;
  activity: number;
}

function emptyState(songId: number): SongState {
  return {
    songId,
    versions: [],
    loadedVersionId: null,
    dirty: false,
    diffTargetVersionId: null,
    view: null,
    activity: 0,
  };
}

export const useSongStore = defineStore('song', {
  state: () => ({
    byId: {} as Record<number, SongState>,
  }),
  getters: {
    active(state): SongState | null {
      const activeSongId = useSongsStore().activeSongId;
      return activeSongId == null ? null : state.byId[activeSongId] ?? null;
    },
    activeVersion(): Version | null {
      const active = this.active;
      return active?.versions.find((version) => version.id === active.loadedVersionId) ?? null;
    },
    headVersion(): Version | null {
      const active = this.active;
      return active?.versions.at(-1) ?? null;
    },
  },
  actions: {
    ensure(songId: number) {
      if (!this.byId[songId]) {
        this.byId[songId] = emptyState(songId);
      }
      return this.byId[songId];
    },
    async open(songId: number) {
      const state = this.ensure(songId);
      state.versions = await api.versions.list(songId);
      const head = state.versions.at(-1) ?? null;
      state.loadedVersionId = head?.id ?? null;
      state.diffTargetVersionId = state.versions.length > 1 ? state.versions[state.versions.length - 2].id : null;
      state.dirty = false;

      if (head && state.view) {
        this.replaceEditorText(songId, head.lyrics);
      } else if (state.view) {
        this.replaceEditorText(songId, '');
      }
    },
    registerView(songId: number, view: EditorView) {
      const state = this.ensure(songId);
      state.view = view;
      const loaded = state.versions.find((version) => version.id === state.loadedVersionId);
      if (loaded) {
        this.replaceEditorText(songId, loaded.lyrics);
      }
      state.dirty = false;
    },
    unregisterView(songId: number) {
      this.ensure(songId).view = null;
    },
    replaceEditorText(songId: number, lyrics: string) {
      const view = this.ensure(songId).view;
      if (!view) {
        return;
      }
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: lyrics },
      });
    },
    getCurrentText(songId: number): string {
      return this.ensure(songId).view?.state.doc.toString() ?? '';
    },
    markDirty(songId: number, dirty: boolean) {
      this.ensure(songId).dirty = dirty;
    },
    markActivity(songId: number) {
      this.ensure(songId).activity += 1;
    },
    async loadVersion(songId: number, versionId: number) {
      const state = this.ensure(songId);
      const version = state.versions.find((item) => item.id === versionId) ?? (await api.versions.load(versionId));
      this.replaceEditorText(songId, version.lyrics);
      state.loadedVersionId = version.id;
      state.dirty = false;
      state.diffTargetVersionId = pickPreviousVersionId(state.versions, version.id);
    },
    async saveBumpVersion(songId: number, label?: string) {
      const state = this.ensure(songId);
      const version = await api.versions.save({ songId, lyrics: this.getCurrentText(songId), label });
      state.versions.push(version);
      state.loadedVersionId = version.id;
      state.diffTargetVersionId = pickPreviousVersionId(state.versions, version.id);
      state.dirty = false;
      return version;
    },
    async overwriteCurrentVersion(songId: number) {
      const state = this.ensure(songId);
      if (state.loadedVersionId == null) {
        return this.saveBumpVersion(songId);
      }
      const version = await api.versions.overwrite({
        versionId: state.loadedVersionId,
        lyrics: this.getCurrentText(songId),
      });
      state.versions = state.versions.map((item) => (item.id === version.id ? version : item));
      state.dirty = false;
      return version;
    },
    async deleteVersion(songId: number, versionId: number) {
      const state = this.ensure(songId);
      await api.versions.delete(versionId);
      state.versions = state.versions.filter((version) => version.id !== versionId);
      if (state.loadedVersionId === versionId) {
        const head = state.versions.at(-1) ?? null;
        state.loadedVersionId = head?.id ?? null;
        this.replaceEditorText(songId, head?.lyrics ?? '');
        state.dirty = false;
      }
      state.diffTargetVersionId = state.loadedVersionId
        ? pickPreviousVersionId(state.versions, state.loadedVersionId)
        : null;
    },
    setDiffTarget(songId: number, versionId: number | null) {
      this.ensure(songId).diffTargetVersionId = versionId;
    },
  },
});

function pickPreviousVersionId(versions: Version[], loadedVersionId: number): number | null {
  const index = versions.findIndex((version) => version.id === loadedVersionId);
  return index > 0 ? versions[index - 1].id : null;
}
