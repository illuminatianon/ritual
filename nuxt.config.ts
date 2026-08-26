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
    openrouterApiKey: '',
    openrouterModel: 'openai/gpt-4o-mini',
    openrouterSiteUrl: '',
    openrouterAppName: 'Ritual',
  },
  typescript: {
    strict: true,
  },
});
