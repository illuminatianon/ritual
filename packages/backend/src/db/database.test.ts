import { describe, expect, it } from 'vitest';
import { createSongRepository, createVersionRepository, runMigrations, type RitualDatabase } from './database';

class FakeDb {
  userVersion = 0;
  songs: Array<Record<string, unknown>> = [];
  versions: Array<Record<string, unknown>> = [];
  nextSongId = 1;
  nextVersionId = 1;

  pragma(statement: string, opts?: { simple?: boolean }) {
    if (statement === 'user_version' && opts?.simple) {
      return this.userVersion;
    }
    return undefined;
  }

  exec(sql: string) {
    if (sql.includes('PRAGMA user_version = 1')) {
      this.userVersion = 1;
    }
  }

  prepare(sql: string) {
    return {
      run: (...args: unknown[]) => this.run(sql, args),
      get: (...args: unknown[]) => this.get(sql, args),
      all: (...args: unknown[]) => this.all(sql, args),
    };
  }

  private run(sql: string, args: unknown[]) {
    if (sql.startsWith('INSERT INTO songs')) {
      const song = {
        id: this.nextSongId++,
        name: args[0],
        created_at: '2026-01-01 00:00:00',
        updated_at: '2026-01-01 00:00:00',
        archived_at: null,
      };
      this.songs.push(song);
      return { lastInsertRowid: song.id };
    }

    if (sql.startsWith('UPDATE songs SET name')) {
      const song = this.songs.find((item) => item.id === args[1]);
      if (song) {
        song.name = args[0];
      }
      return {};
    }

    if (sql.startsWith('UPDATE songs SET archived_at = datetime')) {
      const song = this.songs.find((item) => item.id === args[0]);
      if (song) {
        song.archived_at = '2026-01-01 00:00:00';
      }
      return {};
    }

    if (sql.startsWith('UPDATE songs SET archived_at = NULL')) {
      const song = this.songs.find((item) => item.id === args[0]);
      if (song) {
        song.archived_at = null;
      }
      return {};
    }

    if (sql.startsWith('DELETE FROM songs')) {
      this.songs = this.songs.filter((item) => item.id !== args[0]);
      this.versions = this.versions.filter((item) => item.song_id !== args[0]);
      return {};
    }

    if (sql.startsWith('INSERT INTO versions')) {
      const version = {
        id: this.nextVersionId++,
        song_id: args[0],
        version_number: args[1],
        lyrics: args[2],
        label: args[3],
        created_at: '2026-01-01 00:00:00',
        updated_at: '2026-01-01 00:00:00',
      };
      this.versions.push(version);
      return { lastInsertRowid: version.id };
    }

    if (sql.startsWith('UPDATE versions SET lyrics')) {
      const version = this.versions.find((item) => item.id === args[1]);
      if (version) {
        version.lyrics = args[0];
      }
      return {};
    }

    if (sql.startsWith('DELETE FROM versions')) {
      this.versions = this.versions.filter((item) => item.id !== args[0]);
      return {};
    }

    return {};
  }

  private get(sql: string, args: unknown[]) {
    if (sql.includes("sqlite_master WHERE type = 'table'")) {
      return this.userVersion === 1 ? { name: 'songs' } : undefined;
    }
    if (sql.startsWith('SELECT * FROM songs')) {
      return this.songs.find((item) => item.id === args[0]);
    }
    if (sql.startsWith('SELECT COALESCE(MAX(version_number)')) {
      const songId = args[0];
      return {
        value: Math.max(0, ...this.versions.filter((item) => item.song_id === songId).map((item) => Number(item.version_number))),
      };
    }
    if (sql.startsWith('SELECT * FROM versions WHERE id')) {
      return this.versions.find((item) => item.id === args[0]);
    }
    return undefined;
  }

  private all(sql: string, args: unknown[]) {
    if (sql.includes('FROM songs WHERE archived_at IS NOT NULL')) {
      return this.songs.filter((item) => item.archived_at != null);
    }
    if (sql.includes('FROM songs WHERE archived_at IS NULL')) {
      return this.songs.filter((item) => item.archived_at == null);
    }
    if (sql.startsWith('SELECT * FROM versions')) {
      return this.versions
        .filter((item) => item.song_id === args[0])
        .sort((a, b) => Number(a.version_number) - Number(b.version_number));
    }
    return [];
  }
}

function makeDb() {
  const db = new FakeDb();
  runMigrations(db as unknown as RitualDatabase);
  return db as unknown as RitualDatabase;
}

describe('backend database repositories', () => {
  it('migrates the schema', () => {
    const db = new FakeDb();
    runMigrations(db as unknown as RitualDatabase);
    expect(db.pragma('user_version', { simple: true })).toBe(1);
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'songs'").get()).toBeTruthy();
  });

  it('manages songs and archives', () => {
    const db = makeDb();
    const songs = createSongRepository(db);
    const song = songs.create('Rough chorus');

    expect(songs.list()).toHaveLength(1);
    songs.archive(song.id);
    expect(songs.list()).toHaveLength(0);
    expect(songs.list({ archived: true })).toHaveLength(1);
    songs.restore(song.id);
    expect(songs.list()).toHaveLength(1);
  });

  it('numbers, overwrites, deletes, and loads versions', () => {
    const db = makeDb();
    const songs = createSongRepository(db);
    const versions = createVersionRepository(db);
    const song = songs.create('Version song');
    const v1 = versions.save({ songId: song.id, lyrics: 'first' });
    const v2 = versions.save({ songId: song.id, lyrics: 'second' });

    expect(v1.version_number).toBe(1);
    expect(v2.version_number).toBe(2);
    expect(versions.overwrite({ versionId: v1.id, lyrics: 'first edit' }).lyrics).toBe('first edit');
    versions.delete(v2.id);
    expect(versions.save({ songId: song.id, lyrics: 'new second' }).version_number).toBe(2);
  });
});
