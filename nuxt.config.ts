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
      noExternal: ['yys-editor']
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
