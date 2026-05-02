import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('ritual', {
  platform: process.platform,
});
