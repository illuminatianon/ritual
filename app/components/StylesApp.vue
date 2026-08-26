<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import ActivityBar from '../workbench/ActivityBar.vue';
import WorkbenchShell from '../workbench/WorkbenchShell.vue';
import StyleHistoryPanel from '../styles/StyleHistoryPanel.vue';
import StyleLibrary from '../styles/StyleLibrary.vue';
import StyleWorkspace from '../styles/StyleWorkspace.vue';
import { useStylesStore } from '../stores/styles';

const stylesStore = useStylesStore();
const route = useRoute();
const router = useRouter();
const selectedVersionId = ref<string | null>(null);
const dialogOpen = ref(false);
const editing = ref(false);
const form = ref({ name: '', positive_prompt: '', negative_prompt: '' });
const notice = ref<string | null>(null);
const active = computed(() => stylesStore.activeStyle);
const selectedVersion = computed(() => active.value?.versions.find((version) => version.id === selectedVersionId.value) ?? active.value?.current_version ?? null);

async function openFromRoute() {
  const id = route.params.styleId;
  if (typeof id === 'string') { await stylesStore.open(id); selectedVersionId.value = stylesStore.activeStyle?.current_version_id ?? null; }
}
onMounted(async () => { await stylesStore.load(); await openFromRoute(); });
watch(() => route.params.styleId, () => { void openFromRoute(); });

function showCreate() { editing.value = false; form.value = { name: '', positive_prompt: '', negative_prompt: '' }; dialogOpen.value = true; }
function showEdit() { if (!active.value || !selectedVersion.value) return; editing.value = true; form.value = { name: active.value.name, positive_prompt: selectedVersion.value.positive_prompt, negative_prompt: selectedVersion.value.negative_prompt }; dialogOpen.value = true; }
async function save() {
  try {
    const detail = editing.value && active.value
      ? await stylesStore.append({ styleId: active.value.id, ...form.value })
      : await stylesStore.create(form.value);
    selectedVersionId.value = detail.current_version_id;
    dialogOpen.value = false;
    await router.push(`/styles/${detail.id}`);
    notify(editing.value ? `Saved v${detail.current_version.version_number}` : 'Style created');
  } catch { notify('Could not save style. Check all required fields.'); }
}
async function select(id: string) { await router.push(`/styles/${id}`); }
async function remove() { if (active.value && window.confirm(`Delete "${active.value.name}"?`)) { await stylesStore.remove(active.value.id); await router.push('/styles'); notify('Style deleted'); } }
async function copy(text: string) { try { await navigator.clipboard.writeText(text); notify('Prompt copied'); } catch { notify('Clipboard is unavailable.'); } }
function notify(message: string) { notice.value = message; window.setTimeout(() => { if (notice.value === message) notice.value = null; }, 2200); }
function switchMode(mode: 'songs' | 'styles') { void router.push(mode === 'songs' ? '/songs' : '/styles'); }
</script>
<template>
  <WorkbenchShell>
    <template #activity><ActivityBar active-mode="styles" @select="switchMode" /></template>
    <template #primary><StyleLibrary :styles="stylesStore.styles" :active-id="active?.id ?? null" :loading="stylesStore.loading" @create="showCreate" @select="select" /></template>
    <template #workspace><StyleWorkspace :name="active?.name ?? null" :version="selectedVersion" @create="showCreate" @edit="showEdit" @remove="remove" @copy="copy" /></template>
    <template #secondary><StyleHistoryPanel :versions="active?.versions ?? []" :selected-id="selectedVersion?.id ?? null" @select="selectedVersionId = $event" /></template>
    <template #status><footer class="status-bar"><span>{{ selectedVersion ? `Version ${selectedVersion.version_number}` : 'No style selected' }}</span></footer></template>
    <div v-if="notice" class="toast" role="status">{{ notice }}</div>
    <div v-if="dialogOpen" class="dialog-backdrop" @click.self="dialogOpen = false"><form class="dialog style-dialog" @submit.prevent="save"><div><p class="eyebrow">Style</p><h2>{{ editing ? 'Save new version' : 'New style' }}</h2></div><label>Name<input v-model="form.name" maxlength="120" required /></label><label>Positive prompt<textarea v-model="form.positive_prompt" maxlength="1000" required /></label><label>Negative prompt<textarea v-model="form.negative_prompt" maxlength="1000" /></label><div class="dialog-actions"><button type="button" @click="dialogOpen = false">Cancel</button><button class="primary-action" type="submit">Save</button></div></form></div>
  </WorkbenchShell>
</template>
