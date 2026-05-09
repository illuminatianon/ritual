<script setup lang="ts">
import type { Song } from '@ritual/backend/api';

defineProps<{
  songs: Song[];
  archived: Song[];
  activeSongId: number | null;
  archiveOpen: boolean;
}>();

defineEmits<{
  create: [];
  select: [songId: number];
  rename: [song: Song];
  archive: [song: Song];
  toggleArchive: [];
  restore: [song: Song];
  deletePermanent: [song: Song];
}>();

function versionLabel(song: Song) {
  return song.latest_version_number ? `v${song.latest_version_number}` : 'Draft';
}

function updatedDate(song: Song) {
  return new Date(song.latest_version_updated_at ?? song.updated_at).toLocaleDateString();
}
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-head">
      <div class="brand-block">
        <h1>Ritual</h1>
        <p class="eyebrow">Library</p>
      </div>
      <button class="icon-button primary" type="button" title="New song" @click="$emit('create')">+</button>
    </div>

    <div class="song-list">
      <button
        v-for="song in songs"
        :key="song.id"
        class="song-row"
        :class="{ active: song.id === activeSongId }"
        type="button"
        @click="$emit('select', song.id)"
      >
        <span>{{ song.name }}</span>
        <small>{{ versionLabel(song) }} · {{ updatedDate(song) }}</small>
      </button>
    </div>

    <div class="sidebar-actions">
      <button type="button" @click="$emit('toggleArchive')">
        {{ archiveOpen ? 'Hide archived' : 'Archived' }}
      </button>
    </div>

    <div v-if="archiveOpen" class="archive-list">
      <div v-for="song in archived" :key="song.id" class="archive-row">
        <span>{{ song.name }}</span>
        <div>
          <button type="button" @click="$emit('restore', song)">Restore</button>
          <button type="button" class="danger" @click="$emit('deletePermanent', song)">Delete</button>
        </div>
      </div>
      <p v-if="archived.length === 0" class="empty-note">No archived songs.</p>
    </div>
  </aside>
</template>
