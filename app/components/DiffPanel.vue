<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { computeLyricsDiff, type DiffRow } from '../diff/compute';
import { useSongStore, type SongState } from '../stores/song';

const props = defineProps<{
  active: SongState | null;
}>();

const emit = defineEmits<{
  loadVersion: [versionId: string];
  deleteVersion: [versionId: string];
}>();

const songStore = useSongStore();
const rows = ref<DiffRow[]>([]);
const pickerOpen = ref(false);
let intervalId: number | null = null;
let lastActivityAt = 0;

const versionsNewestFirst = computed(() => [...(props.active?.versions ?? [])].reverse());

const targetVersion = computed(() => {
  if (!props.active?.diffTargetVersionId) {
    return versionsNewestFirst.value[0] ?? null;
  }
  return (
    props.active.versions.find((version) => version.id === props.active?.diffTargetVersionId) ??
    versionsNewestFirst.value[0] ??
    null
  );
});

const menuVersions = computed(() =>
  versionsNewestFirst.value.filter((version) => version.id !== targetVersion.value?.id),
);

function versionTitle(version: { version_number: number; label: string | null }) {
  return `v${version.version_number}${version.label ? `: ${version.label}` : ''}`;
}

function versionDate(version: { updated_at: string; created_at: string }) {
  return new Date(version.updated_at || version.created_at).toLocaleString();
}

function recompute() {
  if (!props.active || !props.active.documentReady || !targetVersion.value) {
    rows.value = [];
    return;
  }

  rows.value = computeLyricsDiff(targetVersion.value.lyrics, songStore.getCurrentText(props.active.songId));
}

function selectBaseline(versionId: string) {
  if (!props.active) {
    return;
  }
  songStore.setDiffTarget(props.active.songId, versionId);
  pickerOpen.value = false;
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
  () => {
    pickerOpen.value = false;
    recompute();
  },
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
    <div v-if="active && targetVersion" class="baseline-picker">
      <button class="baseline-selected" type="button" @click="pickerOpen = !pickerOpen">
        <span>{{ versionTitle(targetVersion) }}</span>
        <span class="baseline-caret">v</span>
        <small>{{ versionDate(targetVersion) }}</small>
      </button>

      <div v-if="pickerOpen" class="baseline-menu">
        <button
          v-for="version in menuVersions"
          :key="version.id"
          type="button"
          class="baseline-option"
          @click="selectBaseline(version.id)"
        >
          <span>{{ versionTitle(version) }}</span>
          <small>{{ versionDate(version) }}</small>
        </button>
        <p v-if="menuVersions.length === 0" class="empty-note">No earlier versions.</p>
      </div>
    </div>

    <div class="diff-output">
      <p v-if="!active" class="empty-note">Create or select a song to begin.</p>
      <p v-else-if="!targetVersion" class="empty-note">Save a version to compare changes.</p>
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
