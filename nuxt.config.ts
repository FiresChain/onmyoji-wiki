const ONMYOJI_EDITOR_FENCE_REGEX = /```onmyoji-editor([^\r\n]*)\r?\n([\s\S]*?)```/g

const collectOnmyojiFenceHeaders = (source: string): string[] => {
  const headers: string[] = []
  const regex = new RegExp(ONMYOJI_EDITOR_FENCE_REGEX)
  let match: RegExpExecArray | null
  while ((match = regex.exec(source)) !== null) {
    headers.push((match[1] || '').trim())
  }
  return headers
}

const injectOnmyojiFenceMeta = (body: any, headers: string[]) => {
  if (!body || !Array.isArray(body.value) || headers.length === 0) {
    return
  }

  let headerIndex = 0
  const visit = (node: any) => {
    if (!Array.isArray(node) || node.length === 0) {
      return
    }
    const tag = node[0]
    const props = node[1]
    if (
      tag === 'pre'
      && props
      && typeof props === 'object'
      && props.language === 'onmyoji-editor'
      && headerIndex < headers.length
    ) {
      props.meta = headers[headerIndex]
      headerIndex += 1
    }

    for (let index = 2; index < node.length; index += 1) {
      visit(node[index])
    }
  }

  body.value.forEach((node: any) => visit(node))
}

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
    build: {
      markdown: {
        highlight: {
          theme: 'github-dark'
        },
        toc: {
          depth: 3,
          searchDepth: 3
        }
      }
    }
  },
  hooks: {
    'content:file:beforeParse': ({ file }) => {
      if (!file || file.extension !== '.md' || typeof file.body !== 'string') {
        return
      }
      file.body = file.body.replace(/```onmyoji-editor\s*\{([^\r\n}]*)\}/g, (_full, attrs: string) => {
        const trimmed = attrs.trim()
        return trimmed
          ? `\`\`\`onmyoji-editor ${trimmed}`
          : '```onmyoji-editor'
      })
    },
    'content:file:afterParse': ({ file, content }) => {
      if (!file || file.extension !== '.md' || typeof file.body !== 'string') {
        return
      }
      const headers = collectOnmyojiFenceHeaders(file.body)
      injectOnmyojiFenceMeta(content?.body, headers)
    }
  },

  devtools: { enabled: true },
  compatibilityDate: '2024-04-03',
})
