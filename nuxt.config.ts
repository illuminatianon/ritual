export default defineNuxtConfig({
  ssr: false,
  modules: ['@pinia/nuxt', 'nuxt-auth-utils'],
  css: ['~/styles.css'],
  nitro: {
    preset: 'node-server',
  },
  runtimeConfig: {
    ritualAuthMode: 'allowlist',
    ritualAllowedEmails: '',
  },
  typescript: {
    strict: true,
  },
});
