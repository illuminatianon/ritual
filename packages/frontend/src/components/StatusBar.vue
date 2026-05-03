<script setup lang="ts">
import type { Song } from '@ritual/backend/api';
import type { SongState } from '../stores/song';

defineProps<{
  song: Song | null;
  active: SongState | null;
}>();

function loadedLabel(active: SongState | null) {
  const version = active?.versions.find((item) => item.id === active.loadedVersionId);
  return version ? `v${version.version_number}` : 'Draft';
}

function timestamp(active: SongState | null) {
  const version = active?.versions.find((item) => item.id === active.loadedVersionId);
  return version ? new Date(version.updated_at).toLocaleString() : 'Not saved yet';
}
</script>

<template>
  <footer class="status-bar">
    <span>{{ song?.name ?? 'No song selected' }}</span>
    <span>{{ loadedLabel(active) }}{{ active?.dirty ? ' • Unsaved' : '' }}</span>
    <span>{{ timestamp(active) }}</span>
  </footer>
</template>
