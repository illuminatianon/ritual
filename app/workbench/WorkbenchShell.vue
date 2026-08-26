<template>
  <main class="workbench-shell">
    <slot name="activity" />
    <slot name="primary" />
    <section class="workbench-workspace"><slot name="workspace" /></section>
    <slot name="secondary" />
    <slot name="status" />
  </main>
</template>
