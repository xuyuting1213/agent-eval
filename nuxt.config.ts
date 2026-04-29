// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss'],

  runtimeConfig: {
    // Server-only runtime config.
    apiSecret: process.env.NUXT_API_SECRET || '',

    // Exposed to client and server.
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || '/api'
    }
  },

  nitro:
    process.env.NODE_ENV === 'development' && process.env.NUXT_DEV_PROXY_TARGET
      ? {
          devProxy: {
            '/api': {
              target: process.env.NUXT_DEV_PROXY_TARGET,
              changeOrigin: true
            }
          }
        }
      : {}
})
