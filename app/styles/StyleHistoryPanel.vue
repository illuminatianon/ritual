<script setup lang="ts">
import type { StyleVersion } from '../../shared/types/api';
defineProps<{ versions: StyleVersion[]; selectedId: string | null }>();
defineEmits<{ select: [id: string] }>();
</script>
<template><aside class="diff-panel"><div class="panel-head"><div><p class="eyebrow">History</p><h2>Versions</h2></div></div><div class="version-list"><button v-for="version in versions" :key="version.id" class="version-row" :class="{ active: version.id === selectedId }" type="button" @click="$emit('select', version.id)"><span>v{{ version.version_number }}</span><small>{{ new Date(version.created_at).toLocaleString() }}</small></button></div></aside></template>
