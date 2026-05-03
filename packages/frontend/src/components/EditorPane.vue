<script setup lang="ts">
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { createLyricsExtensions, setWordChips } from '../editor/extensions';
import { useSongStore } from '../stores/song';

const props = defineProps<{
  songId: number;
  initialDocument: string;
  showWordAnnotations: boolean;
}>();

const songStore = useSongStore();
const editorRoot = ref<HTMLDivElement | null>(null);
let editorView: EditorView | null = null;

function createEditorState(doc: string) {
  return EditorState.create({
    doc,
    extensions: createLyricsExtensions({
      showWordAnnotations: props.showWordAnnotations,
      onDirty: (dirty) => songStore.markDirty(props.songId, dirty),
      onActivity: () => songStore.markActivity(props.songId),
    }),
  });
}

onMounted(() => {
  if (!editorRoot.value) {
    return;
  }

  editorView = new EditorView({
    parent: editorRoot.value,
    state: createEditorState(props.initialDocument),
  });

  songStore.registerView(props.songId, editorView, (lyrics) => {
    editorView?.setState(createEditorState(lyrics));
  });
});

watch(
  () => props.showWordAnnotations,
  (enabled) => {
    if (editorView) {
      setWordChips(editorView, enabled);
    }
  },
);

onBeforeUnmount(() => {
  songStore.unregisterView(props.songId);
  editorView?.destroy();
});
</script>

<template>
  <div ref="editorRoot" class="editor-pane" />
</template>
