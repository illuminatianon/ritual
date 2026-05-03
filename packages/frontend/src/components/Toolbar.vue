<script setup lang="ts">
import type { SongState } from '../stores/song';

defineProps<{
  active: SongState | null;
  showWordAnnotations: boolean;
}>();

defineEmits<{
  saveNew: [];
  overwrite: [];
  copySuno: [];
  copyChat: [];
  toggleWords: [enabled: boolean];
}>();

function nextVersion(active: SongState | null) {
  const latest = active?.versions.at(-1)?.version_number ?? 0;
  return latest + 1;
}

function loadedVersion(active: SongState | null) {
  return active?.versions.find((version) => version.id === active.loadedVersionId)?.version_number ?? null;
}
</script>

<template>
  <div class="toolbar">
    <div class="toolbar-group">
      <button type="button" class="primary-action" :disabled="!active" @click="$emit('saveNew')">
        Save new v{{ nextVersion(active) }}
      </button>
      <button type="button" :disabled="!active" @click="$emit('overwrite')">
        Update {{ loadedVersion(active) ? `v${loadedVersion(active)}` : 'draft' }}
      </button>
    </div>

    <div class="toolbar-group">
      <button type="button" :disabled="!active" @click="$emit('copySuno')">Copy to Suno</button>
      <button type="button" :disabled="!active" @click="$emit('copyChat')">Copy for chat</button>
      <label class="toggle">
        <input
          type="checkbox"
          :checked="showWordAnnotations"
          @change="$emit('toggleWords', ($event.target as HTMLInputElement).checked)"
        />
        Word counts
      </label>
    </div>
  </div>
</template>
