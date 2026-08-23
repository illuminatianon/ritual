import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useSongsStore } from './songs';

beforeEach(() => {
  setActivePinia(createPinia());
});

describe('songs store version counter', () => {
  it('advances from a saved version without rewinding after deletion', () => {
    const store = useSongsStore();
    store.songs = [{
      id: 'song-id',
      name: 'Song',
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z',
      archived_at: null,
      next_version_number: 3,
    }];

    store.setLatestVersion('song-id', { version_number: 3, updated_at: '2024-01-02T00:00:00.000Z' });
    expect(store.songs[0]?.next_version_number).toBe(4);

    store.setLatestVersion('song-id', { version_number: 1, updated_at: '2024-01-03T00:00:00.000Z' });
    store.setLatestVersion('song-id', null);
    expect(store.songs[0]?.next_version_number).toBe(4);
  });
});
