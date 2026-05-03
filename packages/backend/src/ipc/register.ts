import { ipcMain } from 'electron';
import type { RitualDatabase } from '../db/database';
import { createSongRepository, createVersionRepository } from '../db/database';

export function registerIpcHandlers(db: RitualDatabase) {
  const songs = createSongRepository(db);
  const versions = createVersionRepository(db);

  ipcMain.handle('songs:list', (_event, args?: { archived?: boolean }) => songs.list(args));
  ipcMain.handle('songs:create', (_event, name: string) => songs.create(name));
  ipcMain.handle('songs:rename', (_event, args: { id: number; name: string }) => songs.rename(args.id, args.name));
  ipcMain.handle('songs:archive', (_event, id: number) => songs.archive(id));
  ipcMain.handle('songs:restore', (_event, id: number) => songs.restore(id));
  ipcMain.handle('songs:deletePermanent', (_event, id: number) => songs.deletePermanent(id));

  ipcMain.handle('versions:list', (_event, songId: number) => versions.list(songId));
  ipcMain.handle('versions:save', (_event, args: { songId: number; lyrics: string; label?: string }) =>
    versions.save(args),
  );
  ipcMain.handle('versions:overwrite', (_event, args: { versionId: number; lyrics: string }) =>
    versions.overwrite(args),
  );
  ipcMain.handle('versions:load', (_event, versionId: number) => versions.load(versionId));
  ipcMain.handle('versions:delete', (_event, versionId: number) => versions.delete(versionId));
}
