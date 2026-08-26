<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import ActivityBar from '../workbench/ActivityBar.vue';
import WorkbenchShell from '../workbench/WorkbenchShell.vue';
import DiffPanel from './DiffPanel.vue';
import EditorPane from './EditorPane.vue';
import Sidebar from './Sidebar.vue';
import StatusBar from './StatusBar.vue';
import type { Version } from '../../shared/types/api';
import { usePrefsStore } from '../stores/prefs';
import { useSongStore } from '../stores/song';
import { useSongsStore } from '../stores/songs';

const songsStore = useSongsStore();
const route = useRoute();
const router = useRouter();
const songStore = useSongStore();
const prefsStore = usePrefsStore();

const sidebarOpen = computed({
  get: () => !prefsStore.sidebarCollapsed,
  set: (open: boolean) => prefsStore.setSidebarCollapsed(!open),
});

const activeSong = computed(() => songsStore.activeSong);
const activeState = computed(() => songStore.active);
const activeVersion = computed(() => songStore.activeVersion);
const initialDocument = computed(() => activeVersion.value?.lyrics ?? '');
const diffBaselineLyrics = computed(() => {
  const active = activeState.value;

  if (!active?.diffTargetVersionId) {
    return null;
  }

  return active.versions.find((version) => version.id === active.diffTargetVersionId)?.lyrics ?? null;
});

const editorVersionLabel = computed(() => {
  if (!activeState.value) {
    return 'No version loaded';
  }

  const version = activeVersion.value;
  const base = version ? `v${version.version_number}` : 'Draft';
  if (!activeState.value.dirty) {
    return base;
  }

  return `${base} → v${activeSong.value?.next_version_number ?? 1}*`;
});

const nextVersionNum = computed(() => activeSong.value?.next_version_number ?? 1);

const loadedVersionLabel = computed(() => {
  if (!activeState.value) return 'draft';
  const v = activeState.value.versions.find((ver) => ver.id === activeState.value?.loadedVersionId);
  return v ? `v${v.version_number}` : 'draft';
});

const appTitle = computed(() => {
  if (!activeSong.value) {
    return 'Ritual';
  }

  return `${activeSong.value.name} - ${editorVersionLabel.value} - Ritual`;
});

type DialogState =
  | {
      kind: 'text';
      title: string;
      message?: string;
      value: string;
      placeholder?: string;
      selectValue?: boolean;
      resolve: (value: string | null) => void;
    }
  | {
      kind: 'choice';
      title: string;
      message?: string;
      choices: Array<{ label: string; value: string; tone?: 'primary' | 'danger' }>;
      resolve: (value: string | null) => void;
    };

const dialog = ref<DialogState | null>(null);
const dialogInput = ref('');
const dialogTextInput = ref<HTMLInputElement | null>(null);
const notice = ref<string | null>(null);
let noticeTimeout: number | null = null;
onMounted(async () => {
  await songsStore.loadAll();
  const routeSongId = route.params.songId;
  if (typeof routeSongId === 'string' && songsStore.songs.some((song) => song.id === routeSongId)) {
    songsStore.setActive(routeSongId);
  }
  if (songsStore.activeSongId != null) {
    await songStore.open(songsStore.activeSongId);
  }
  window.addEventListener('keydown', handleShortcuts);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleShortcuts);
  if (noticeTimeout != null) {
    window.clearTimeout(noticeTimeout);
  }
});

watch(
  () => songsStore.activeSongId,
  async (songId) => {
    if (songId != null) {
      await songStore.open(songId);
    }
  },
);

watch(() => route.params.songId, (songId) => {
  if (typeof songId === 'string' && songsStore.songs.some((song) => song.id === songId) && songId !== songsStore.activeSongId) {
    songsStore.setActive(songId);
  }
});

watch(appTitle, (title) => {
  document.title = title;
}, { immediate: true });

async function createSong() {
  if (!(await confirmDirtyTransition())) {
    return;
  }
  const song = await songsStore.create('Untitled Song');
  await songStore.open(song.id);
  await router.push(`/songs/${song.id}`);
}

async function selectSong(songId: string) {
  if (songId === songsStore.activeSongId) {
    return;
  }
  if (await confirmDirtyTransition()) {
    songsStore.setActive(songId);
    await router.push(`/songs/${songId}`);
  }
}

async function renameSong() {
  if (!activeSong.value) {
    return;
  }
  const name = await askText({ title: 'Rename song', value: activeSong.value.name });
  if (name != null) {
    await songsStore.rename(activeSong.value.id, name);
  }
}

async function archiveSong() {
  if (!activeSong.value || !(await confirmDirtyTransition())) {
    return;
  }
  if (await askConfirm(`Archive "${activeSong.value.name}"?`, 'Archived songs can be restored later.')) {
    await songsStore.archive(activeSong.value.id);
  }
}

async function saveNewVersion(): Promise<Version | null> {
  if (!activeState.value || !activeSong.value) {
    return null;
  }
  try {
    if (activeSong.value.name === 'Untitled Song' && activeState.value.versions.length === 0) {
      const name = await askText({
        title: 'Name song',
        message: 'Name this song before saving its first version.',
        value: activeSong.value.name,
        selectValue: true,
      });
      if (name == null) {
        return null;
      }
      await songsStore.rename(activeSong.value.id, name);
    }
    const label = await askText({
      title: 'Save new version',
      message: 'Add an optional label for this snapshot.',
      value: '',
      placeholder: 'tightened chorus',
    });
    if (label == null) {
      return null;
    }
    const version = await songStore.saveBumpVersion(activeState.value.songId, label || undefined);
    showNotice(`Saved v${version.version_number}`);
    return version;
  } catch {
    showNotice('Could not save version. Your edits are still in the editor.');
    return null;
  }
}

async function overwriteVersion() {
  if (!activeState.value) {
    return;
  }

  const headId = activeState.value.versions.at(-1)?.id ?? null;
  if (activeState.value.loadedVersionId && activeState.value.loadedVersionId !== headId) {
    const loaded = activeState.value.versions.find((version) => version.id === activeState.value?.loadedVersionId);
    if (!(await askConfirm(`Overwrite v${loaded?.version_number}?`, 'This rewrites history for the loaded version.'))) {
      return;
    }
  }

  try {
    await songStore.overwriteCurrentVersion(activeState.value.songId);
    showNotice('Version updated');
  } catch {
    showNotice('Could not update version. Your edits are still in the editor.');
  }
}

async function loadVersion(versionId: string) {
  if (!activeState.value) {
    return;
  }
  if (await confirmDirtyTransition()) {
    await songStore.loadVersion(activeState.value.songId, versionId);
  }
}

async function deleteVersion(versionId: string) {
  if (!activeState.value || !(await askConfirm('Delete the loaded version?', 'This removes the snapshot from history.'))) {
    return;
  }
  try {
    await songStore.deleteVersion(activeState.value.songId, versionId);
    showNotice('Version deleted');
  } catch {
    showNotice('Could not delete version.');
  }
}

async function restoreSong(songId: string) {
  if (!(await confirmDirtyTransition())) {
    return;
  }
  const song = await songsStore.restore(songId);
  await songStore.open(song.id);
}

async function deletePermanent(songId: string) {
  if (await askConfirm('Permanently delete this archived song?', 'All versions for this song will be deleted.')) {
    await songsStore.deletePermanent(songId);
  }
}

async function copyLyrics() {
  const text = currentLyrics();
  if (text) {
    await navigator.clipboard.writeText(text);
    showNotice('Lyrics copied');
  } else {
    showNotice('Nothing to copy');
  }
}

function currentLyrics() {
  return activeState.value ? songStore.getCurrentText(activeState.value.songId) : '';
}

async function confirmDirtyTransition() {
  if (!activeState.value?.dirty) {
    return true;
  }

  const answer = await askChoice({
    title: 'Unsaved changes',
    message: 'Save a new version before leaving this song?',
    choices: [
      { label: 'Save', value: 'save', tone: 'primary' },
      { label: 'Discard', value: 'discard', tone: 'danger' },
      { label: 'Cancel', value: 'cancel' },
    ],
  });
  if (answer === 'save') {
    return (await saveNewVersion()) != null;
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

function askText(args: { title: string; message?: string; value: string; placeholder?: string; selectValue?: boolean }) {
  dialogInput.value = args.value;
  return new Promise<string | null>((resolve) => {
    dialog.value = {
      kind: 'text',
      title: args.title,
      message: args.message,
      value: args.value,
      placeholder: args.placeholder,
      selectValue: args.selectValue,
      resolve,
    };
    void nextTick(() => {
      dialogTextInput.value?.focus();
      if (args.selectValue) {
        dialogTextInput.value?.select();
      }
    });
  });
}

function askChoice(args: {
  title: string;
  message?: string;
  choices: Array<{ label: string; value: string; tone?: 'primary' | 'danger' }>;
}) {
  return new Promise<string | null>((resolve) => {
    dialog.value = {
      kind: 'choice',
      title: args.title,
      message: args.message,
      choices: args.choices,
      resolve,
    };
  });
}

async function askConfirm(title: string, message?: string) {
  const answer = await askChoice({
    title,
    message,
    choices: [
      { label: 'Confirm', value: 'confirm', tone: 'primary' },
      { label: 'Cancel', value: 'cancel' },
    ],
  });
  return answer === 'confirm';
}

function submitDialog() {
  if (!dialog.value) {
    return;
  }

  if (dialog.value.kind === 'text') {
    dialog.value.resolve(dialogInput.value);
  }
  dialog.value = null;
}

function chooseDialog(value: string) {
  if (dialog.value?.kind === 'choice') {
    dialog.value.resolve(value);
    dialog.value = null;
  }
}

function cancelDialog() {
  dialog.value?.resolve(null);
  dialog.value = null;
}

function showNotice(message: string) {
  notice.value = message;
  if (noticeTimeout != null) {
    window.clearTimeout(noticeTimeout);
  }
  noticeTimeout = window.setTimeout(() => {
    notice.value = null;
    noticeTimeout = null;
  }, 2200);
}
</script>

<template>
  <WorkbenchShell :class="{ 'sidebar-closed': !sidebarOpen }">
    <template #activity>
      <ActivityBar active-mode="songs" @select="(mode) => router.push(mode === 'songs' ? '/songs' : '/styles')" />
    </template>
    <template #primary>
    <Sidebar
      :collapsed="!sidebarOpen"
      :songs="songsStore.songs"
      :archived="songsStore.archived"
      :active-song-id="songsStore.activeSongId"
      :archive-open="songsStore.archiveOpen"
      @create="createSong"
      @select="selectSong"
      @collapse="sidebarOpen = false"
      @expand="sidebarOpen = true"
      @toggle-archive="
        songsStore.archiveOpen = !songsStore.archiveOpen;
        songsStore.archiveOpen && songsStore.loadArchived()
      "
      @restore="(song) => restoreSong(song.id)"
      @delete-permanent="(song) => deletePermanent(song.id)"
    />
    </template>

    <template #workspace>
    <section class="workspace">
      <div class="editor-header">
        <div class="editor-title">
          <span class="song-name">{{ activeSong?.name ?? 'No song selected' }}</span>
          <span v-if="activeState" class="version-chip">{{ editorVersionLabel }}</span>
        </div>

        <div v-if="activeState" class="editor-actions">
          <button type="button" class="primary-action" @click="saveNewVersion">
            Save v{{ nextVersionNum }}
          </button>
          <button type="button" @click="overwriteVersion">↑ {{ loadedVersionLabel }}</button>

          <div class="action-sep" />

          <button type="button" @click="copyLyrics">Suno</button>
          <button type="button" @click="copyLyrics">Chat</button>
          <label class="toggle">
            <input
              type="checkbox"
              :checked="prefsStore.showWordAnnotations"
              @change="prefsStore.setShowWordAnnotations(($event.target as HTMLInputElement).checked)"
            />
            Words
          </label>

          <div class="action-sep" />

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
        :baseline-lyrics="diffBaselineLyrics"
      />
      <div v-else class="empty-editor">
        <h2>Create a song to start writing.</h2>
        <button type="button" class="primary-action" @click="createSong">New song</button>
      </div>

    </section>
    </template>

    <template #secondary>
      <DiffPanel :active="activeState" @load-version="loadVersion" @delete-version="deleteVersion" />

    </template>

    <template #status>
      <StatusBar :active="activeState" />
    </template>

    <div v-if="notice" class="toast" role="status">{{ notice }}</div>

    <div v-if="dialog" class="dialog-backdrop" @click.self="cancelDialog">
      <form v-if="dialog.kind === 'text'" class="dialog" @submit.prevent="submitDialog">
        <div>
          <p class="eyebrow">Ritual</p>
          <h2>{{ dialog.title }}</h2>
          <p v-if="dialog.message" class="dialog-message">{{ dialog.message }}</p>
        </div>
        <input ref="dialogTextInput" v-model="dialogInput" :placeholder="dialog.placeholder" autofocus />
        <div class="dialog-actions">
          <button type="button" @click="cancelDialog">Cancel</button>
          <button type="submit" class="primary-action">OK</button>
        </div>
      </form>

      <div v-else class="dialog" role="dialog" aria-modal="true">
        <div>
          <p class="eyebrow">Ritual</p>
          <h2>{{ dialog.title }}</h2>
          <p v-if="dialog.message" class="dialog-message">{{ dialog.message }}</p>
        </div>
        <div class="dialog-actions">
          <button
            v-for="choice in dialog.choices"
            :key="choice.value"
            type="button"
            :class="{ 'primary-action': choice.tone === 'primary', danger: choice.tone === 'danger' }"
            @click="chooseDialog(choice.value)"
          >
            {{ choice.label }}
          </button>
        </div>
      </div>
    </div>
  </WorkbenchShell>
</template>
