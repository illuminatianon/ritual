<script setup lang="ts">
defineProps<{ activeMode: 'songs' }>();
defineEmits<{ select: [mode: 'songs'] }>();
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
  </nav>
</template>
