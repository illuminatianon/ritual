<script setup lang="ts">
definePageMeta({ layout: false });
</script>

<template>
  <main class="login-page">
    <section class="login-card">
      <p class="eyebrow">Ritual</p>
      <h1>Lyrics, in focus.</h1>
      <p>Sign in with your approved Google account to open your song library.</p>
      <a class="login-button" href="/auth/google">Continue with Google</a>
    </section>
  </main>
</template>

<style scoped>
.login-page { min-height: 100vh; display: grid; place-items: center; background: #11100f; color: #f5f1eb; padding: 2rem; }
.login-card { width: min(100%, 26rem); border: 1px solid #39332d; background: #1c1917; padding: 2.5rem; }
.eyebrow { color: #d69f5f; letter-spacing: .12em; text-transform: uppercase; font-size: .75rem; }
h1 { margin: .5rem 0 1rem; font-size: 2rem; }
p { color: #c8beb3; line-height: 1.5; }
.login-button { display: block; margin-top: 2rem; padding: .8rem 1rem; background: #d69f5f; color: #1c1917; text-align: center; font-weight: 700; text-decoration: none; }
</style>
