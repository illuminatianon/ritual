import { and, desc, eq, isNotNull, isNull } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { Song, Version } from '../../../shared/types/api';
import { db } from '../client';
import { songs, versions } from '../schema';

function serializeSong(song: typeof songs.$inferSelect, latest: typeof versions.$inferSelect | null): Song {
  return {
    id: song.id,
    name: song.name,
    created_at: song.createdAt.toISOString(),
    updated_at: song.updatedAt.toISOString(),
    archived_at: song.archivedAt?.toISOString() ?? null,
    next_version_number: song.nextVersionNumber,
    latest_version_number: latest?.versionNumber ?? null,
    latest_version_updated_at: latest?.updatedAt.toISOString() ?? null,
  };
}

export async function listSongs(userId: string, archived = false): Promise<Song[]> {
  const where = archived
    ? and(eq(songs.userId, userId), isNotNull(songs.archivedAt))
    : and(eq(songs.userId, userId), isNull(songs.archivedAt));
  const rows = await db.select().from(songs).where(where).orderBy(desc(songs.updatedAt), desc(songs.id));
  return Promise.all(rows.map(async (song) => {
    const [latest] = await db.select().from(versions).where(eq(versions.songId, song.id)).orderBy(desc(versions.versionNumber)).limit(1);
    return serializeSong(song, latest ?? null);
  }));
}

export async function findOwnedSong(id: string, userId: string) {
  const [song] = await db.select().from(songs).where(and(eq(songs.id, id), eq(songs.userId, userId))).limit(1);
  return song ?? null;
}

export async function createSong(userId: string, name: string): Promise<Song> {
  const now = new Date();
  const [song] = await db.insert(songs).values({
    id: randomUUID(),
    userId,
    name: name.trim() || 'Untitled Song',
    createdAt: now,
    updatedAt: now,
  }).returning();
  if (!song) {
    throw new Error('Failed to create song.');
  }
  return serializeSong(song, null);
}

export async function renameSong(id: string, userId: string, name: string): Promise<Song | null> {
  const [song] = await db.update(songs).set({ name: name.trim() || 'Untitled Song', updatedAt: new Date() })
    .where(and(eq(songs.id, id), eq(songs.userId, userId))).returning();
  return song ? serializeSong(song, null) : null;
}

export async function archiveSong(id: string, userId: string) {
  const [song] = await db.update(songs).set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(songs.id, id), eq(songs.userId, userId))).returning({ id: songs.id });
  return song ?? null;
}

export async function restoreSong(id: string, userId: string): Promise<Song | null> {
  const [song] = await db.update(songs).set({ archivedAt: null, updatedAt: new Date() })
    .where(and(eq(songs.id, id), eq(songs.userId, userId))).returning();
  return song ? serializeSong(song, null) : null;
}

export async function deleteSong(id: string, userId: string) {
  const [song] = await db.delete(songs).where(and(eq(songs.id, id), eq(songs.userId, userId))).returning({ id: songs.id });
  return song ?? null;
}
