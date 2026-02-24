<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import '@milkdown/theme-nord/style.css'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
}>()

const root = ref<HTMLDivElement | null>(null)
const booting = ref(true)
const bootError = ref('')

let editor: any = null
let getMarkdown: (() => string) | null = null
let replaceAll: ((markdown: string) => any) | null = null
let internalPatch = false
let lastMarkdownFromEditor: string | null = null

const normalizeMarkdown = (value: string): string => value.replace(/\r\n/g, '\n')

onMounted(async () => {
  try {
    await nextTick()
    if (!root.value) {
      throw new Error('Milkdown root element not found.')
    }

    const [
      { Editor, rootCtx, defaultValueCtx },
      { commonmark },
      { listener, listenerCtx },
      { history },
      { nord },
      utils
    ] = await Promise.all([
      import('@milkdown/kit/core'),
      import('@milkdown/kit/preset/commonmark'),
      import('@milkdown/kit/plugin/listener'),
      import('@milkdown/kit/plugin/history'),
      import('@milkdown/theme-nord'),
      import('@milkdown/kit/utils')
    ])

    getMarkdown = () => editor.action(utils.getMarkdown())
    replaceAll = (markdown: string) => editor.action(utils.replaceAll(markdown))

    editor = await Editor.make()
      .config(nord)
      .config((ctx) => {
        ctx.set(rootCtx, root.value)
        ctx.set(defaultValueCtx, props.modelValue)
      })
      .config((ctx) => {
        const manager = ctx.get(listenerCtx)
        manager.markdownUpdated((_ctx, markdown: string, prevMarkdown: string) => {
          if (markdown === prevMarkdown || internalPatch) {
            return
          }
          const normalized = normalizeMarkdown(markdown)
          lastMarkdownFromEditor = normalized
          emit('update:modelValue', normalized)
        })
      })
      .use(commonmark)
      .use(listener)
      .use(history)
      .create()
  } catch (error) {
    console.error('Milkdown init failed:', error)
    bootError.value = 'Milkdown 初始化失败，请刷新页面重试。'
  } finally {
    booting.value = false
  }
})

watch(() => props.modelValue, (nextValue) => {
  if (!editor || !getMarkdown || !replaceAll) {
    return
  }

  const normalizedNextValue = normalizeMarkdown(nextValue || '')
  if (lastMarkdownFromEditor !== null && normalizedNextValue === lastMarkdownFromEditor) {
    lastMarkdownFromEditor = null
    return
  }

  const currentValue = normalizeMarkdown(getMarkdown())
  if (currentValue === normalizedNextValue) {
    return
  }

  internalPatch = true
  try {
    replaceAll(normalizedNextValue)
  } finally {
    internalPatch = false
  }
})

onBeforeUnmount(() => {
  editor?.destroy?.()
})
</script>

<template>
  <div class="milkdown-editor">
    <div ref="root" class="milkdown-root" :class="{ 'is-hidden': !!bootError }" />
    <div v-if="booting" class="booting">编辑器加载中...</div>
    <div v-if="bootError" class="error">{{ bootError }}</div>
  </div>
</template>

<style scoped>
.milkdown-editor {
  position: relative;
  border: 1px solid #d7d7d7;
  border-radius: 10px;
  background: #fff;
  overflow: hidden;
}

.milkdown-root {
  min-height: 520px;
  padding: 12px;
}

.milkdown-root.is-hidden {
  visibility: hidden;
}

.booting,
.error {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.9);
  color: #666;
  padding: 12px;
}

.error {
  color: #b42318;
}
</style>
