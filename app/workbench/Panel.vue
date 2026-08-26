<script setup lang="ts">
defineProps<{ className?: string }>();
</script>

<template><aside :class="className"><slot /></aside></template>
