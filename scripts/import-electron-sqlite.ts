import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

type LegacySong = {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

type LegacyVersion = {
  id: number;
  song_id: number;
  version_number: number;
  lyrics: string;
  label: string | null;
  created_at: string;
  updated_at: string;
};

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const source = argument('--source');
const email = argument('--user')?.trim().toLowerCase();
const force = process.argv.includes('--force');
const dryRun = process.argv.includes('--dry-run');
const databaseUrl = process.env.DATABASE_URL;

if (!source || !email || !databaseUrl) {
  throw new Error('Usage: pnpm import:sqlite -- --source /path/to/ritual.sqlite --user user@example.com [--dry-run] [--force]');
}

const sqlite = new Database(source, { readonly: true, fileMustExist: true });
const pool = new Pool({ connectionString: databaseUrl });

try {
  const songs = sqlite.prepare('SELECT id, name, created_at, updated_at, archived_at FROM songs ORDER BY id').all() as LegacySong[];
  const versions = sqlite.prepare('SELECT id, song_id, version_number, lyrics, label, created_at, updated_at FROM versions ORDER BY song_id, version_number').all() as LegacyVersion[];
  const userResult = await pool.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [email]);
  if (userResult.rowCount !== 1) {
    throw new Error(`Expected exactly one local user for ${email}; sign in with Google before importing.`);
  }

  const targetUserId = userResult.rows[0].id;
  const existingSongs = await pool.query<{ count: string }>('SELECT count(*) FROM songs WHERE user_id = $1', [targetUserId]);
  if (!force && Number(existingSongs.rows[0].count) > 0) {
    throw new Error('Target user already owns songs. Refusing to duplicate import; use --force only after reviewing the target account.');
  }

  const versionsBySong = new Map<number, LegacyVersion[]>();
  for (const version of versions) {
    if (!Number.isInteger(version.version_number) || version.version_number < 1) {
      throw new Error(`Invalid version number for legacy version ${version.id}.`);
    }
    const list = versionsBySong.get(version.song_id) ?? [];
    list.push(version);
    versionsBySong.set(version.song_id, list);
  }

  for (const version of versions) {
    if (!songs.some((song) => song.id === version.song_id)) {
      throw new Error(`Legacy version ${version.id} refers to missing song ${version.song_id}.`);
    }
  }

  console.log(`Preflight: ${songs.length} songs and ${versions.length} versions for ${email}.`);
  if (dryRun) {
    console.log('Dry run complete; PostgreSQL was not changed.');
  } else {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const song of songs) {
        const importedVersions = versionsBySong.get(song.id) ?? [];
        const songId = randomUUID();
        const nextVersionNumber = Math.max(0, ...importedVersions.map((version) => version.version_number)) + 1;
        await client.query(
          `INSERT INTO songs (id, user_id, name, next_version_number, created_at, updated_at, archived_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [songId, targetUserId, song.name, nextVersionNumber, song.created_at, song.updated_at, song.archived_at],
        );
        for (const version of importedVersions) {
          await client.query(
            `INSERT INTO versions (id, song_id, version_number, lyrics, label, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [randomUUID(), songId, version.version_number, version.lyrics, version.label, version.created_at, version.updated_at],
          );
        }
      }
      await client.query('COMMIT');
      console.log(`Imported ${songs.length} songs and ${versions.length} versions.`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
} finally {
  sqlite.close();
  await pool.end();
}
