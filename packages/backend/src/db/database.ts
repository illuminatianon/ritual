import Database from 'better-sqlite3';
import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import type { Song, Version } from '../api';

export type RitualDatabase = Database.Database;

type SongRow = Song;
type VersionRow = Version;

export function openDatabase(filePath: string): RitualDatabase {
  mkdirSync(dirname(filePath), { recursive: true });
  const db = new Database(filePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  return db;
}

export function runMigrations(db: RitualDatabase) {
  const current = db.pragma('user_version', { simple: true }) as number;

  if (current < 1) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS songs (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        archived_at TEXT NULL
      );

      CREATE TABLE IF NOT EXISTS versions (
        id INTEGER PRIMARY KEY,
        song_id INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
        version_number INTEGER NOT NULL,
        lyrics TEXT NOT NULL,
        label TEXT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(song_id, version_number)
      );

      CREATE INDEX IF NOT EXISTS versions_song_id_version_number_idx
        ON versions(song_id, version_number);

      PRAGMA user_version = 1;
    `);
  }
}

export function createSongRepository(db: RitualDatabase) {
  return {
    list(args?: { archived?: boolean }): Song[] {
      const archived = args?.archived === true;
      return db
        .prepare(
          archived
            ? `
              SELECT songs.*,
                latest.version_number AS latest_version_number,
                latest.updated_at AS latest_version_updated_at
              FROM songs
              LEFT JOIN versions latest
                ON latest.song_id = songs.id
                AND latest.version_number = (
                  SELECT MAX(version_number)
                  FROM versions
                  WHERE versions.song_id = songs.id
                )
              WHERE songs.archived_at IS NOT NULL
              ORDER BY songs.updated_at DESC, songs.id DESC
            `
            : `
              SELECT songs.*,
                latest.version_number AS latest_version_number,
                latest.updated_at AS latest_version_updated_at
              FROM songs
              LEFT JOIN versions latest
                ON latest.song_id = songs.id
                AND latest.version_number = (
                  SELECT MAX(version_number)
                  FROM versions
                  WHERE versions.song_id = songs.id
                )
              WHERE songs.archived_at IS NULL
              ORDER BY songs.updated_at DESC, songs.id DESC
            `,
        )
        .all() as SongRow[];
    },

    create(name: string): Song {
      const cleanName = name.trim() || 'Untitled song';
      const info = db.prepare('INSERT INTO songs (name) VALUES (?)').run(cleanName);
      return this.load(Number(info.lastInsertRowid));
    },

    load(id: number): Song {
      const song = db.prepare('SELECT * FROM songs WHERE id = ?').get(id) as SongRow | undefined;
      if (!song) {
        throw new Error(`Song ${id} was not found.`);
      }
      return song;
    },

    rename(id: number, name: string): Song {
      const cleanName = name.trim() || 'Untitled song';
      db.prepare("UPDATE songs SET name = ?, updated_at = datetime('now') WHERE id = ?").run(cleanName, id);
      return this.load(id);
    },

    archive(id: number): void {
      db.prepare("UPDATE songs SET archived_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(id);
    },

    restore(id: number): Song {
      db.prepare("UPDATE songs SET archived_at = NULL, updated_at = datetime('now') WHERE id = ?").run(id);
      return this.load(id);
    },

    deletePermanent(id: number): void {
      db.prepare('DELETE FROM songs WHERE id = ?').run(id);
    },
  };
}

export function createVersionRepository(db: RitualDatabase) {
  return {
    list(songId: number): Version[] {
      return db
        .prepare('SELECT * FROM versions WHERE song_id = ? ORDER BY version_number ASC')
        .all(songId) as VersionRow[];
    },

    save(args: { songId: number; lyrics: string; label?: string }): Version {
      const latest = db
        .prepare('SELECT COALESCE(MAX(version_number), 0) AS value FROM versions WHERE song_id = ?')
        .get(args.songId) as { value: number };
      const nextVersion = latest.value + 1;
      const info = db
        .prepare('INSERT INTO versions (song_id, version_number, lyrics, label) VALUES (?, ?, ?, ?)')
        .run(args.songId, nextVersion, args.lyrics, args.label?.trim() || null);
      db.prepare("UPDATE songs SET updated_at = datetime('now') WHERE id = ?").run(args.songId);
      return this.load(Number(info.lastInsertRowid));
    },

    overwrite(args: { versionId: number; lyrics: string }): Version {
      const current = this.load(args.versionId);
      db.prepare("UPDATE versions SET lyrics = ?, updated_at = datetime('now') WHERE id = ?").run(
        args.lyrics,
        args.versionId,
      );
      db.prepare("UPDATE songs SET updated_at = datetime('now') WHERE id = ?").run(current.song_id);
      return this.load(args.versionId);
    },

    load(versionId: number): Version {
      const version = db.prepare('SELECT * FROM versions WHERE id = ?').get(versionId) as VersionRow | undefined;
      if (!version) {
        throw new Error(`Version ${versionId} was not found.`);
      }
      return version;
    },

    delete(versionId: number): void {
      db.prepare('DELETE FROM versions WHERE id = ?').run(versionId);
    },
  };
}
