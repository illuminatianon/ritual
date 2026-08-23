import { and, asc, eq, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { Version } from '../../../shared/types/api';
import { db } from '../client';
import { songs, versions } from '../schema';

function serializeVersion(version: typeof versions.$inferSelect): Version {
  return {
    id: version.id,
    song_id: version.songId,
    version_number: version.versionNumber,
    lyrics: version.lyrics,
    label: version.label,
    created_at: version.createdAt.toISOString(),
    updated_at: version.updatedAt.toISOString(),
  };
}

export async function listVersions(songId: string, userId: string): Promise<Version[] | null> {
  const [song] = await db.select({ id: songs.id }).from(songs)
    .where(and(eq(songs.id, songId), eq(songs.userId, userId))).limit(1);
  if (!song) {
    return null;
  }
  const rows = await db.select().from(versions).where(eq(versions.songId, song.id)).orderBy(asc(versions.versionNumber));
  return rows.map(serializeVersion);
}

export async function createVersion(args: { songId: string; userId: string; lyrics: string; label?: string }): Promise<Version | null> {
  return db.transaction(async (tx) => {
    const [song] = await tx.update(songs).set({
      nextVersionNumber: sql`${songs.nextVersionNumber} + 1`,
      updatedAt: new Date(),
    }).where(and(eq(songs.id, args.songId), eq(songs.userId, args.userId)))
      .returning({ id: songs.id, nextVersionNumber: songs.nextVersionNumber });

    if (!song) {
      return null;
    }

    const now = new Date();
    const [version] = await tx.insert(versions).values({
      id: randomUUID(),
      songId: song.id,
      versionNumber: song.nextVersionNumber - 1,
      lyrics: args.lyrics,
      label: args.label?.trim() || null,
      createdAt: now,
      updatedAt: now,
    }).returning();
    if (!version) {
      throw new Error('Failed to create version.');
    }
    return serializeVersion(version);
  });
}

export async function findOwnedVersion(versionId: string, userId: string) {
  const [row] = await db.select({ version: versions }).from(versions).innerJoin(songs, eq(versions.songId, songs.id))
    .where(and(eq(versions.id, versionId), eq(songs.userId, userId))).limit(1);
  return row?.version ?? null;
}

export async function loadVersion(versionId: string, userId: string): Promise<Version | null> {
  const version = await findOwnedVersion(versionId, userId);
  return version ? serializeVersion(version) : null;
}

export async function overwriteVersion(versionId: string, userId: string, lyrics: string): Promise<Version | null> {
  const current = await findOwnedVersion(versionId, userId);
  if (!current) {
    return null;
  }
  const [version] = await db.update(versions).set({ lyrics, updatedAt: new Date() }).where(eq(versions.id, current.id)).returning();
  if (!version) {
    throw new Error('Failed to overwrite version.');
  }
  await db.update(songs).set({ updatedAt: new Date() }).where(eq(songs.id, current.songId));
  return serializeVersion(version);
}

export async function deleteVersion(versionId: string, userId: string) {
  const current = await findOwnedVersion(versionId, userId);
  if (!current) {
    return null;
  }
  const [version] = await db.delete(versions).where(eq(versions.id, current.id)).returning({ id: versions.id });
  return version ?? null;
}
