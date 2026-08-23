import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type * as SongRepository from './songs';
import type * as UserRepository from './users';
import type * as VersionRepository from './versions';
import type { Pool } from 'pg';

const testDatabaseUrl = process.env.RITUAL_TEST_DATABASE_URL;
const describeDatabase = testDatabaseUrl ? describe : describe.skip;

describeDatabase('PostgreSQL repository ownership and versioning', () => {
  let songRepository: typeof SongRepository;
  let userRepository: typeof UserRepository;
  let versionRepository: typeof VersionRepository;
  let pool: Pool;
  let userA: { id: string };
  let userB: { id: string };

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl!;
    // Load after DATABASE_URL is configured so skipped tests never create a database pool.
    songRepository = await import('./songs');
    userRepository = await import('./users');
    versionRepository = await import('./versions');
    ({ pool } = await import('../client'));
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE oauth_accounts, versions, songs, users CASCADE');
    userA = await userRepository.createUserWithOAuthAccount({
      email: 'a@example.com', displayName: 'User A', avatarUrl: null, provider: 'google', providerAccountId: 'google-a',
    });
    userB = await userRepository.createUserWithOAuthAccount({
      email: 'b@example.com', displayName: 'User B', avatarUrl: null, provider: 'google', providerAccountId: 'google-b',
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  it('prevents cross-user song and version access', async () => {
    const songA = await songRepository.createSong(userA.id, 'A song');
    const songB = await songRepository.createSong(userB.id, 'B song');
    const versionB = await versionRepository.createVersion({ songId: songB.id, userId: userB.id, lyrics: 'private' });
    expect(versionB).not.toBeNull();

    expect(await songRepository.listSongs(userA.id)).toMatchObject([{ id: songA.id }]);
    expect(await songRepository.findOwnedSong(songB.id, userA.id)).toBeNull();
    expect(await songRepository.renameSong(songB.id, userA.id, 'stolen')).toBeNull();
    expect(await songRepository.archiveSong(songB.id, userA.id)).toBeNull();
    expect(await songRepository.restoreSong(songB.id, userA.id)).toBeNull();
    expect(await songRepository.deleteSong(songB.id, userA.id)).toBeNull();
    expect(await versionRepository.listVersions(songB.id, userA.id)).toBeNull();
    expect(await versionRepository.loadVersion(versionB!.id, userA.id)).toBeNull();
    expect(await versionRepository.overwriteVersion(versionB!.id, userA.id, 'stolen')).toBeNull();
    expect(await versionRepository.deleteVersion(versionB!.id, userA.id)).toBeNull();
  });

  it('assigns monotonic distinct version numbers', async () => {
    const song = await songRepository.createSong(userA.id, 'Versioned song');
    const first = await versionRepository.createVersion({ songId: song.id, userId: userA.id, lyrics: 'one' });
    const second = await versionRepository.createVersion({ songId: song.id, userId: userA.id, lyrics: 'two' });
    await versionRepository.deleteVersion(second!.id, userA.id);
    expect((await songRepository.listSongs(userA.id))[0]?.next_version_number).toBe(3);
    const third = await versionRepository.createVersion({ songId: song.id, userId: userA.id, lyrics: 'three' });
    const concurrent = await Promise.all([
      versionRepository.createVersion({ songId: song.id, userId: userA.id, lyrics: 'four' }),
      versionRepository.createVersion({ songId: song.id, userId: userA.id, lyrics: 'five' }),
    ]);

    expect(first?.version_number).toBe(1);
    expect(second?.version_number).toBe(2);
    expect(third?.version_number).toBe(3);
    expect((await songRepository.listSongs(userA.id))[0]?.next_version_number).toBe(6);
    expect(concurrent.map((version) => version?.version_number).sort()).toEqual([4, 5]);
  });

  it('normalizes blank create and rename names', async () => {
    const song = await songRepository.createSong(userA.id, '   ');
    expect(song.name).toBe('Untitled Song');

    const renamed = await songRepository.renameSong(song.id, userA.id, '  ');
    expect(renamed?.name).toBe('Untitled Song');
  });
});
