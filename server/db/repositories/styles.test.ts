import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type * as StyleRepository from './styles';
import type * as UserRepository from './users';
import type { Pool } from 'pg';

const testDatabaseUrl = process.env.RITUAL_TEST_DATABASE_URL;
const describeDatabase = testDatabaseUrl ? describe : describe.skip;

describeDatabase('Style repository', () => {
  let styles: typeof StyleRepository;
  let users: typeof UserRepository;
  let pool: Pool;
  let userA: { id: string };
  let userB: { id: string };

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl!;
    styles = await import('./styles');
    users = await import('./users');
    ({ pool } = await import('../client'));
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE oauth_accounts, style_versions, styles, versions, songs, users CASCADE');
    userA = await users.createUserWithOAuthAccount({ email: 'styles-a@example.com', displayName: 'A', avatarUrl: null, provider: 'google', providerAccountId: 'styles-a' });
    userB = await users.createUserWithOAuthAccount({ email: 'styles-b@example.com', displayName: 'B', avatarUrl: null, provider: 'google', providerAccountId: 'styles-b' });
  });

  afterAll(async () => { await pool.end(); });

  it('creates v1, appends immutable versions, and updates the current version', async () => {
    const created = await styles.createStyle({ userId: userA.id, name: 'Electro', positivePrompt: 'driving bass', negativePrompt: 'acoustic', metadata: { unknown: 'retained' } });
    expect(created.current_version).toMatchObject({ version_number: 1, positive_prompt: 'driving bass' });
    expect(JSON.parse(created.current_version.metadata_json)).toMatchObject({ source: 'manual', unknown: 'retained' });

    const updated = await styles.appendStyleVersion({ styleId: created.id, userId: userA.id, name: 'Electro v2', positivePrompt: 'hard bass', negativePrompt: '', metadata: { source: 'import' } });
    expect(updated?.current_version).toMatchObject({ version_number: 2, positive_prompt: 'hard bass' });
    expect(updated?.versions.map((version) => version.version_number)).toEqual([2, 1]);
    expect(updated?.versions[1]?.positive_prompt).toBe('driving bass');
    expect(updated?.next_version_number).toBe(3);
  });

  it('allocates distinct monotonic version numbers concurrently', async () => {
    const style = await styles.createStyle({ userId: userA.id, name: 'Concurrent', positivePrompt: 'one' });
    await Promise.all([
      styles.appendStyleVersion({ styleId: style.id, userId: userA.id, name: 'Concurrent', positivePrompt: 'two' }),
      styles.appendStyleVersion({ styleId: style.id, userId: userA.id, name: 'Concurrent', positivePrompt: 'three' }),
    ]);
    const detail = await styles.findOwnedActiveStyle(style.id, userA.id);
    expect(detail?.versions.map((version) => version.version_number).sort()).toEqual([1, 2, 3]);
    expect(detail?.next_version_number).toBe(4);
  });

  it('enforces ownership and hides soft-deleted styles', async () => {
    const style = await styles.createStyle({ userId: userA.id, name: 'Private', positivePrompt: 'private' });
    expect(await styles.findOwnedActiveStyle(style.id, userB.id)).toBeNull();
    expect(await styles.appendStyleVersion({ styleId: style.id, userId: userB.id, name: 'stolen', positivePrompt: 'stolen' })).toBeNull();
    expect(await styles.softDeleteStyle(style.id, userB.id)).toBeNull();
    expect(await styles.softDeleteStyle(style.id, userA.id)).not.toBeNull();
    expect(await styles.listStyles(userA.id)).toEqual([]);
    expect(await styles.findOwnedActiveStyle(style.id, userA.id)).toBeNull();
    const [{ count }] = await pool.query<{ count: string }>('SELECT count(*) FROM style_versions WHERE style_id = $1', [style.id]).then((result) => result.rows);
    expect(count).toBe('1');
  });
});
