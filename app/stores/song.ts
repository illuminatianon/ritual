import { defineStore } from 'pinia';
import type { EditorView } from '@codemirror/view';
import type { Version } from '../../shared/types/api';
import { api } from '../api';
import { useSongsStore } from './songs';

export interface SongState {
  songId: string;
  versions: Version[];
  loadedVersionId: string | null;
  dirty: boolean;
  documentReady: boolean;
  diffTargetVersionId: string | null;
  view: EditorView | null;
  resetEditorDocument: ((lyrics: string) => void) | null;
  activity: number;
}

function emptyState(songId: string): SongState {
  return {
    songId,
    versions: [],
    loadedVersionId: null,
    dirty: false,
    documentReady: false,
    diffTargetVersionId: null,
    view: null,
    resetEditorDocument: null,
    activity: 0,
  };
}

export const useSongStore = defineStore('song', {
  state: () => ({
    byId: {} as Record<string, SongState>,
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
    ensure(songId: string) {
      if (!this.byId[songId]) {
        this.byId[songId] = emptyState(songId);
      }
      return this.byId[songId];
    },
    async open(songId: string) {
      const state = this.ensure(songId);
      state.documentReady = false;
      state.versions = await api.versions.list(songId);
      const head = state.versions.at(-1) ?? null;
      state.loadedVersionId = head?.id ?? null;
      state.diffTargetVersionId = head?.id ?? null;
      state.dirty = false;

      if (head && state.view) {
        this.replaceEditorText(songId, head.lyrics);
      } else if (state.view) {
        this.replaceEditorText(songId, '');
      }
      state.documentReady = state.view != null;
      state.activity += 1;
    },
    registerView(songId: string, view: EditorView, resetEditorDocument: (lyrics: string) => void) {
      const state = this.ensure(songId);
      state.view = view;
      state.resetEditorDocument = resetEditorDocument;
      const loaded = state.versions.find((version) => version.id === state.loadedVersionId);
      if (loaded) {
        this.replaceEditorText(songId, loaded.lyrics);
      }
      state.documentReady = true;
      state.dirty = false;
      state.activity += 1;
    },
    unregisterView(songId: string) {
      const state = this.ensure(songId);
      state.view = null;
      state.resetEditorDocument = null;
    },
    replaceEditorText(songId: string, lyrics: string) {
      const state = this.ensure(songId);
      const view = state.view;
      if (!view) {
        return;
      }
      state.resetEditorDocument?.(lyrics);
    },
    getCurrentText(songId: string): string {
      return this.ensure(songId).view?.state.doc.toString() ?? '';
    },
    markDirty(songId: string, dirty: boolean) {
      this.ensure(songId).dirty = dirty;
    },
    markActivity(songId: string) {
      this.ensure(songId).activity += 1;
    },
    async loadVersion(songId: string, versionId: string) {
      const state = this.ensure(songId);
      const version = state.versions.find((item) => item.id === versionId) ?? (await api.versions.load(versionId));
      state.documentReady = false;
      this.replaceEditorText(songId, version.lyrics);
      state.loadedVersionId = version.id;
      state.dirty = false;
      state.diffTargetVersionId = pickLatestVersionId(state.versions);
      state.documentReady = true;
      state.activity += 1;
    },
    async saveBumpVersion(songId: string, label?: string) {
      const state = this.ensure(songId);
      const version = await api.versions.save({ songId, lyrics: this.getCurrentText(songId), label });
      state.versions.push(version);
      state.loadedVersionId = version.id;
      state.diffTargetVersionId = version.id;
      state.dirty = false;
      useSongsStore().setLatestVersion(songId, version);
      return version;
    },
    async overwriteCurrentVersion(songId: string) {
      const state = this.ensure(songId);
      if (state.loadedVersionId == null) {
        return this.saveBumpVersion(songId);
      }
      const version = await api.versions.overwrite({
        versionId: state.loadedVersionId,
        lyrics: this.getCurrentText(songId),
      });
      state.versions = state.versions.map((item) => (item.id === version.id ? version : item));
      state.diffTargetVersionId = version.id;
      state.dirty = false;
      useSongsStore().setLatestVersion(songId, state.versions.at(-1) ?? null);
      return version;
    },
    async deleteVersion(songId: string, versionId: string) {
      const state = this.ensure(songId);
      await api.versions.delete(versionId);
      state.versions = state.versions.filter((version) => version.id !== versionId);
      if (state.loadedVersionId === versionId) {
        const head = state.versions.at(-1) ?? null;
        state.loadedVersionId = head?.id ?? null;
        state.documentReady = false;
        this.replaceEditorText(songId, head?.lyrics ?? '');
        state.dirty = false;
        state.documentReady = true;
        state.activity += 1;
      }
      state.diffTargetVersionId = pickLatestVersionId(state.versions);
      useSongsStore().setLatestVersion(songId, state.versions.at(-1) ?? null);
    },
    setDiffTarget(songId: string, versionId: string | null) {
      this.ensure(songId).diffTargetVersionId = versionId;
    },
  },
});

function pickLatestVersionId(versions: Version[]): string | null {
  return versions.at(-1)?.id ?? null;
}
