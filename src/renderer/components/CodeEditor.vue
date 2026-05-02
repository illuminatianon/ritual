<script setup lang="ts">
import { javascript } from '@codemirror/lang-javascript';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { onBeforeUnmount, onMounted, ref } from 'vue';

const props = defineProps<{
  initialDocument: string;
}>();

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
      extensions: [
        lineNumbers(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        javascript({ typescript: true }),
        EditorView.lineWrapping,
      ],
    }),
  });
});

onBeforeUnmount(() => {
  editorView?.destroy();
});
</script>

<template>
  <div ref="editorRoot" class="editor" />
</template>
