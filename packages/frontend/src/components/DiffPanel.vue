<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { computeLyricsDiff, type DiffRow } from '../diff/compute';
import { useSongStore, type SongState } from '../stores/song';

const props = defineProps<{
  active: SongState | null;
}>();

const emit = defineEmits<{
  loadVersion: [versionId: number];
  deleteVersion: [versionId: number];
}>();

const songStore = useSongStore();
const rows = ref<DiffRow[]>([]);
let intervalId: number | null = null;
let lastActivityAt = 0;

const targetVersion = computed(() => {
  if (!props.active?.diffTargetVersionId) {
    return null;
  }
  return props.active.versions.find((version) => version.id === props.active?.diffTargetVersionId) ?? null;
});

function recompute() {
  if (!props.active || !targetVersion.value) {
    rows.value = [];
    return;
  }

  rows.value = computeLyricsDiff(targetVersion.value.lyrics, songStore.getCurrentText(props.active.songId));
}

function onActivity() {
  lastActivityAt = Date.now();
  if (intervalId == null) {
    recompute();
    intervalId = window.setInterval(() => {
      if (Date.now() - lastActivityAt > 15_000) {
        window.clearInterval(intervalId!);
        intervalId = null;
        return;
      }
      recompute();
    }, 2000);
  }
}

watch(
  () => [props.active?.songId, props.active?.diffTargetVersionId, props.active?.loadedVersionId],
  () => recompute(),
  { immediate: true },
);

watch(
  () => props.active?.activity,
  () => onActivity(),
);

onBeforeUnmount(() => {
  if (intervalId != null) {
    window.clearInterval(intervalId);
  }
});
</script>

<template>
  <aside class="diff-panel">
    <div class="panel-head">
      <div>
        <p class="eyebrow">Diff</p>
        <h2>Against previous</h2>
      </div>
      <select
        v-if="active && active.versions.length > 0"
        :value="active.diffTargetVersionId ?? ''"
        @change="songStore.setDiffTarget(active.songId, Number(($event.target as HTMLSelectElement).value) || null)"
      >
        <option value="">No target</option>
        <option v-for="version in active.versions" :key="version.id" :value="version.id">
          v{{ version.version_number }}{{ version.label ? `: ${version.label}` : '' }}
        </option>
      </select>
    </div>

    <div v-if="active" class="version-list">
      <button
        v-for="version in active.versions"
        :key="version.id"
        type="button"
        class="version-row"
        :class="{ active: version.id === active.loadedVersionId }"
        @click="emit('loadVersion', version.id)"
      >
        <span>v{{ version.version_number }}</span>
        <small>{{ version.label || new Date(version.created_at).toLocaleString() }}</small>
      </button>
    </div>

    <div class="diff-output">
      <p v-if="!active" class="empty-note">Create or select a song to begin.</p>
      <p v-else-if="!targetVersion" class="empty-note">Save another version to compare changes.</p>
      <pre v-else-if="rows.length === 0" class="empty-note">No changes.</pre>
      <pre v-for="row in rows" v-else :key="row.id" class="diff-row" :class="row.type"><template
        v-for="(part, index) in row.parts"
        :key="index"
      ><span :class="part.type">{{ part.text }}</span></template></pre>
    </div>

    <button
      v-if="active?.loadedVersionId"
      type="button"
      class="danger wide"
      @click="emit('deleteVersion', active.loadedVersionId)"
    >
      Delete loaded version
    </button>
  </aside>
</template>
