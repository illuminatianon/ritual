import { contextBridge, ipcRenderer } from 'electron';
import type { Api } from './api';

const api: Api = {
  songs: {
    list: (args) => ipcRenderer.invoke('songs:list', args),
    create: (name) => ipcRenderer.invoke('songs:create', name),
    rename: (id, name) => ipcRenderer.invoke('songs:rename', { id, name }),
    archive: (id) => ipcRenderer.invoke('songs:archive', id),
    restore: (id) => ipcRenderer.invoke('songs:restore', id),
    deletePermanent: (id) => ipcRenderer.invoke('songs:deletePermanent', id),
  },
  versions: {
    list: (songId) => ipcRenderer.invoke('versions:list', songId),
    save: (args) => ipcRenderer.invoke('versions:save', args),
    overwrite: (args) => ipcRenderer.invoke('versions:overwrite', args),
    load: (versionId) => ipcRenderer.invoke('versions:load', versionId),
    delete: (versionId) => ipcRenderer.invoke('versions:delete', versionId),
  },
};

contextBridge.exposeInMainWorld('api', api);
