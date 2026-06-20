<script setup lang="ts">
import type { Song } from '@ritual/backend/api';

defineProps<{
  songs: Song[];
  archived: Song[];
  activeSongId: number | null;
  archiveOpen: boolean;
  collapsed: boolean;
}>();

defineEmits<{
  create: [];
  select: [songId: number];
  toggleArchive: [];
  restore: [song: Song];
  deletePermanent: [song: Song];
  collapse: [];
  expand: [];
}>();

function versionLabel(song: Song) {
  return song.latest_version_number ? `v${song.latest_version_number}` : 'Draft';
}

function updatedDate(song: Song) {
  return new Date(song.latest_version_updated_at ?? song.updated_at).toLocaleDateString();
}
</script>

<template>
  <aside class="sidebar" :class="{ 'sidebar--slim': collapsed }">
    <template v-if="collapsed">
      <button class="icon-button primary" type="button" title="New song" @click="$emit('create')">+</button>
      <div class="slim-expand" @click="$emit('expand')" title="Open library" />
    </template>

    <template v-else>
      <div class="sidebar-head">
        <div class="brand-block">
          <h1>Ritual</h1>
          <p class="eyebrow">Library</p>
        </div>
        <div class="sidebar-head-actions">
          <button class="icon-button primary" type="button" title="New song" @click="$emit('create')">+</button>
          <button class="collapse-btn" type="button" title="Collapse sidebar" @click="$emit('collapse')">‹</button>
        </div>
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
    </template>
  </aside>
</template>
