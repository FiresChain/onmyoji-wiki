export default defineNuxtConfig({
  modules: ['@nuxt/content'],
  app: {
    baseURL: process.env.NUXT_APP_BASE_URL || '/'
  },

  vite: {
    optimizeDeps: {
      include: [
        'yys-editor',
        'element-plus',
        'dayjs',
        '@logicflow/core',
        '@logicflow/extension',
        '@logicflow/vue-node-registry'
      ],
      exclude: []
    },
    ssr: {
      noExternal: [
        'yys-editor',
        'element-plus',
        'dayjs',
        '@logicflow/core',
        '@logicflow/extension',
        '@logicflow/vue-node-registry'
      ]
    },
    server: {
      fs: {
        allow: [
          // 允许访问 yys-editor（npm link 时需要）
          '../yys-editor'
        ]
      }
    }
  },

  content: {
    highlight: {
      theme: 'github-dark'
    },
    markdown: {
      toc: {
        depth: 3,
        searchDepth: 3
      }
    }
  },

  devtools: { enabled: true },
  compatibilityDate: '2024-04-03',
})
