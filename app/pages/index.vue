<script setup lang="ts">
import RitualApp from '../components/RitualApp.vue';

definePageMeta({ middleware: 'auth' });

const { clear, loggedIn, user } = useUserSession();
async function logout() {
  await clear();
  await navigateTo('/login');
}
</script>

<template>
  <div class="ritual-page">
    <button v-if="loggedIn" class="logout" type="button" :title="`Sign out ${user?.email ?? ''}`" @click="logout">Sign out</button>
    <RitualApp v-if="loggedIn" />
  </div>
</template>

<style scoped>
.ritual-page { min-height: 100vh; }
.logout { position: fixed; z-index: 10; right: 1rem; bottom: 1rem; border: 1px solid #595149; background: #211e1a; color: #d8d0c5; padding: .45rem .7rem; cursor: pointer; }
.logout:hover { border-color: #d69f5f; color: #fff; }
</style>
