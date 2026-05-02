<script setup lang="ts">
import CodeEditor from './components/CodeEditor.vue';

const platform = window.ritual.platform;

const starterCode = `import { EditorView } from '@codemirror/view';

type Ritual = {
  name: string;
  cadence: 'daily' | 'weekly';
};

const ritual: Ritual = {
  name: 'Morning review',
  cadence: 'daily',
};

console.log(ritual);
`;
</script>

<template>
  <main class="shell">
    <section class="workspace">
      <div class="titlebar">
        <div>
          <p class="eyebrow">Electron + Vue 3 + CodeMirror</p>
          <h1>Ritual</h1>
        </div>
        <span class="platform">{{ platform }}</span>
      </div>
      <CodeEditor :initial-document="starterCode" />
    </section>
  </main>
</template>
