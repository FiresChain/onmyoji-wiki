export default defineNuxtConfig({
  modules: ['@nuxt/content'],
  components: [
    {
      path: '~/components'
    },
    {
      path: '~/components/layout',
      pathPrefix: false
    }
  ],
  css: ['~/assets/css/theme.css'],
  app: {
    baseURL: process.env.NUXT_APP_BASE_URL || '/'
  },
  mdc: {
    rehypePlugins: {
      // Windows 下避免生成 `D:/...` 绝对路径导入（会触发 ERR_UNSUPPORTED_ESM_URL_SCHEME）
      highlight: {
        src: '@nuxtjs/mdc/dist/runtime/highlighter/rehype-nuxt'
      }
    }
  },

  vite: {
    optimizeDeps: {
      include: [
        '@fireschain/onmyoji-flow',
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
        '@fireschain/onmyoji-flow',
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
          // 允许访问 onmyoji-flow（file: 依赖联调）
          '../onmyoji-flow',
          // monorepo 联调时，允许访问工作区根 node_modules（如 milkdown 样式）
          '../node_modules'
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
