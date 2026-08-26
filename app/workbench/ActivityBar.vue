<script setup lang="ts">
defineProps<{ activeMode: 'songs' | 'styles' }>();
defineEmits<{ select: [mode: 'songs' | 'styles'] }>();
</script>

<template>
  <nav class="activity-bar" aria-label="Workbench mode">
    <button
      class="activity-item"
      :class="{ active: activeMode === 'songs' }"
      type="button"
      aria-label="Songs"
      title="Songs"
      @click="$emit('select', 'songs')"
    >
      ♪<span>Songs</span>
    </button>
    <button
      class="activity-item"
      :class="{ active: activeMode === 'styles' }"
      type="button"
      aria-label="Styles"
      title="Styles"
      @click="$emit('select', 'styles')"
    >
      ✦<span>Styles</span>
    </button>
  </nav>
</template>
