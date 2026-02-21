export default defineNuxtConfig({
  modules: ['@nuxt/content'],

  vite: {
    optimizeDeps: {
      include: [
        '@logicflow/core',
        '@logicflow/extension',
        '@logicflow/vue-node-registry'
      ],
      exclude: ['yys-editor']
    },
    ssr: {
      noExternal: [
        'yys-editor',
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
