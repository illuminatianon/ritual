<script setup lang="ts">
import type { Style } from '../../shared/types/api';
defineProps<{ styles: Style[]; activeId: string | null; loading: boolean }>();
defineEmits<{ create: []; select: [id: string] }>();
</script>
<template>
  <aside class="sidebar">
    <div class="sidebar-head"><div class="brand-block"><h1>Ritual</h1><p class="eyebrow">Styles</p></div><button class="icon-button primary" type="button" title="New style" @click="$emit('create')">+</button></div>
    <div class="song-list"><button v-for="style in styles" :key="style.id" class="song-row" :class="{ active: style.id === activeId }" type="button" @click="$emit('select', style.id)"><span>{{ style.name }}</span><small>v{{ style.current_version.version_number }} · {{ new Date(style.updated_at).toLocaleDateString() }}</small></button><p v-if="!loading && styles.length === 0" class="empty-note">No styles yet.</p></div>
  </aside>
</template>
