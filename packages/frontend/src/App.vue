<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue';
import DiffPanel from './components/DiffPanel.vue';
import EditorPane from './components/EditorPane.vue';
import Sidebar from './components/Sidebar.vue';
import StatusBar from './components/StatusBar.vue';
import Toolbar from './components/Toolbar.vue';
import { usePrefsStore } from './stores/prefs';
import { useSongStore } from './stores/song';
import { useSongsStore } from './stores/songs';

const songsStore = useSongsStore();
const songStore = useSongStore();
const prefsStore = usePrefsStore();

const activeSong = computed(() => songsStore.activeSong);
const activeState = computed(() => songStore.active);
const activeVersion = computed(() => songStore.activeVersion);
const initialDocument = computed(() => activeVersion.value?.lyrics ?? '');

onMounted(async () => {
  await songsStore.loadAll();
  if (songsStore.activeSongId != null) {
    await songStore.open(songsStore.activeSongId);
  }
  window.addEventListener('keydown', handleShortcuts);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleShortcuts);
});

watch(
  () => songsStore.activeSongId,
  async (songId) => {
    if (songId != null) {
      await songStore.open(songId);
    }
  },
);

async function createSong() {
  if (!(await confirmDirtyTransition())) {
    return;
  }
  const name = window.prompt('Song name', 'Untitled song');
  if (name == null) {
    return;
  }
  const song = await songsStore.create(name);
  await songStore.open(song.id);
}

async function selectSong(songId: number) {
  if (songId === songsStore.activeSongId) {
    return;
  }
  if (await confirmDirtyTransition()) {
    songsStore.setActive(songId);
  }
}

async function renameSong() {
  if (!activeSong.value) {
    return;
  }
  const name = window.prompt('Rename song', activeSong.value.name);
  if (name != null) {
    await songsStore.rename(activeSong.value.id, name);
  }
}

async function archiveSong() {
  if (!activeSong.value || !(await confirmDirtyTransition())) {
    return;
  }
  if (window.confirm(`Archive "${activeSong.value.name}"?`)) {
    await songsStore.archive(activeSong.value.id);
  }
}

async function saveNewVersion() {
  if (!activeState.value) {
    return;
  }
  const label = window.prompt('Optional version label', '') ?? undefined;
  await songStore.saveBumpVersion(activeState.value.songId, label);
}

async function overwriteVersion() {
  if (!activeState.value) {
    return;
  }

  const headId = activeState.value.versions.at(-1)?.id ?? null;
  if (activeState.value.loadedVersionId && activeState.value.loadedVersionId !== headId) {
    const loaded = activeState.value.versions.find((version) => version.id === activeState.value?.loadedVersionId);
    if (!window.confirm(`Overwrite v${loaded?.version_number}? This rewrites history.`)) {
      return;
    }
  }

  await songStore.overwriteCurrentVersion(activeState.value.songId);
}

async function loadVersion(versionId: number) {
  if (!activeState.value) {
    return;
  }
  if (await confirmDirtyTransition()) {
    await songStore.loadVersion(activeState.value.songId, versionId);
  }
}

async function deleteVersion(versionId: number) {
  if (!activeState.value || !window.confirm('Delete the loaded version?')) {
    return;
  }
  await songStore.deleteVersion(activeState.value.songId, versionId);
}

async function restoreSong(songId: number) {
  if (!(await confirmDirtyTransition())) {
    return;
  }
  const song = await songsStore.restore(songId);
  await songStore.open(song.id);
}

async function deletePermanent(songId: number) {
  if (window.confirm('Permanently delete this archived song and all versions?')) {
    await songsStore.deletePermanent(songId);
  }
}

async function copyLyrics() {
  const text = currentLyrics();
  if (text) {
    await navigator.clipboard.writeText(text);
  }
}

function currentLyrics() {
  return activeState.value ? songStore.getCurrentText(activeState.value.songId) : '';
}

async function confirmDirtyTransition() {
  if (!activeState.value?.dirty) {
    return true;
  }

  const answer = window.prompt('Unsaved changes: type "save", "discard", or "cancel".', 'save');
  if (answer === 'save') {
    await saveNewVersion();
    return true;
  }
  return answer === 'discard';
}

function handleShortcuts(event: KeyboardEvent) {
  const saveKey = event.key.toLowerCase() === 's' && (event.metaKey || event.ctrlKey);
  if (!saveKey) {
    return;
  }

  event.preventDefault();
  if (event.shiftKey) {
    void overwriteVersion();
  } else if (!event.altKey) {
    void saveNewVersion();
  }
}
</script>

<template>
  <main class="app-shell">
    <Sidebar
      :songs="songsStore.songs"
      :archived="songsStore.archived"
      :active-song-id="songsStore.activeSongId"
      :archive-open="songsStore.archiveOpen"
      @create="createSong"
      @select="selectSong"
      @toggle-archive="
        songsStore.archiveOpen = !songsStore.archiveOpen;
        songsStore.archiveOpen && songsStore.loadArchived()
      "
      @restore="(song) => restoreSong(song.id)"
      @delete-permanent="(song) => deletePermanent(song.id)"
    />

    <section class="workspace">
      <Toolbar
        :active="activeState"
        :show-word-annotations="prefsStore.showWordAnnotations"
        @save-new="saveNewVersion"
        @overwrite="overwriteVersion"
        @copy-suno="copyLyrics"
        @copy-chat="copyLyrics"
        @toggle-words="prefsStore.setShowWordAnnotations"
      />

      <div class="song-header">
        <div>
          <p class="eyebrow">Editor</p>
          <h2>{{ activeSong?.name ?? 'No song selected' }}</h2>
        </div>
        <div class="song-actions" v-if="activeSong">
          <button type="button" @click="renameSong">Rename</button>
          <button type="button" class="danger" @click="archiveSong">Archive</button>
        </div>
      </div>

      <EditorPane
        v-if="activeState && songsStore.activeSongId"
        :key="songsStore.activeSongId"
        :song-id="songsStore.activeSongId"
        :initial-document="initialDocument"
        :show-word-annotations="prefsStore.showWordAnnotations"
      />
      <div v-else class="empty-editor">
        <h2>Create a song to start writing.</h2>
        <button type="button" class="primary-action" @click="createSong">New song</button>
      </div>

      <StatusBar :song="activeSong" :active="activeState" />
    </section>

    <DiffPanel :active="activeState" @load-version="loadVersion" @delete-version="deleteVersion" />
  </main>
</template>
