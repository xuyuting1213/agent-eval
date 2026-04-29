// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss'],

  app: {
    head: {
      title: '比言',
      meta: [
        {
          name: 'description',
          content:
            '对齐同一批追问，对比各模型回答，按统一维度自动打分并留痕；支持工作台单模型、横评多模型与管理用例。',
        },
      ],
    },
  },

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
