import { $fetch } from 'ofetch';
import type { Api } from '../shared/types/api';

export const api: Api = {
  songs: {
    list: (args) => $fetch('/api/songs', { query: args }),
    create: (name) => $fetch('/api/songs', { method: 'POST', body: { name } }),
    rename: (id, name) => $fetch(`/api/songs/${id}`, { method: 'PATCH', body: { name } }),
    archive: async (id) => { await $fetch(`/api/songs/${id}/archive`, { method: 'POST' }); },
    restore: (id) => $fetch(`/api/songs/${id}/restore`, { method: 'POST' }),
    deletePermanent: async (id) => { await $fetch(`/api/songs/${id}`, { method: 'DELETE' }); },
  },
  versions: {
    list: (songId) => $fetch(`/api/songs/${songId}/versions`),
    save: ({ songId, lyrics, label }) => $fetch(`/api/songs/${songId}/versions`, { method: 'POST', body: { lyrics, label } }),
    overwrite: ({ versionId, lyrics }) => $fetch(`/api/versions/${versionId}`, { method: 'PUT', body: { lyrics } }),
    load: (versionId) => $fetch(`/api/versions/${versionId}`),
    delete: async (versionId) => { await $fetch(`/api/versions/${versionId}`, { method: 'DELETE' }); },
  },
  styles: {
    list: () => $fetch('/api/styles'),
    create: (args) => $fetch('/api/styles', { method: 'POST', body: args }),
    get: (styleId) => $fetch(`/api/styles/${styleId}`),
    appendVersion: ({ styleId, ...body }) => $fetch(`/api/styles/${styleId}/versions`, { method: 'POST', body }),
    delete: async (styleId) => { await $fetch(`/api/styles/${styleId}`, { method: 'DELETE' }); },
  },
  styleModel: {
    generate: (request) => $fetch('/api/styles/generate', { method: 'POST', body: { request } }),
    refine: (args) => $fetch('/api/styles/refine', { method: 'POST', body: args }),
  },
};
