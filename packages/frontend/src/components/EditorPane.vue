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

onMounted(() => {
  if (!editorRoot.value) {
    return;
  }

  editorView = new EditorView({
    parent: editorRoot.value,
    state: EditorState.create({
      doc: props.initialDocument,
      extensions: createLyricsExtensions({
        showWordAnnotations: props.showWordAnnotations,
        onDirty: (dirty) => songStore.markDirty(props.songId, dirty),
        onActivity: () => songStore.markActivity(props.songId),
      }),
    }),
  });

  songStore.registerView(props.songId, editorView);
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
