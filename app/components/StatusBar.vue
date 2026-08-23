<script setup lang="ts">
import type { SongState } from '../stores/song';

defineProps<{
  active: SongState | null;
}>();

function timestamp(active: SongState | null) {
  const version = active?.versions.find((item) => item.id === active.loadedVersionId);
  return version ? `Updated ${new Date(version.updated_at).toLocaleString()}` : 'Not saved yet';
}
</script>

<template>
  <footer class="status-bar">
    <span>{{ timestamp(active) }}</span>
  </footer>
</template>
