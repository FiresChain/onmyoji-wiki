<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import '@milkdown/theme-nord/style.css'

export type MilkdownEditorHandle = {
  toggleBold: () => void
  toggleItalic: () => void
  setHeading: (level: number) => void
  setBulletList: () => void
  setOrderedList: () => void
  setCodeBlock: () => void
  undo: () => void
  redo: () => void
  insertFlowBlock: () => void
  insertText: (text: string, inline?: boolean) => void
  getMarkdown: () => string
}

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
let insertMarkdown: ((markdown: string, inline?: boolean) => any) | null = null
let callCommand: ((slice: any, payload?: any) => any) | null = null
let internalPatch = false
let lastMarkdownFromEditor: string | null = null
const commandKeys: Record<string, any> = {}

const normalizeMarkdown = (value: string): string => value.replace(/\r\n/g, '\n')

onMounted(async () => {
  try {
    await nextTick()
    if (!root.value) {
      throw new Error('Milkdown root element not found.')
    }

    const [
      { Editor, rootCtx, defaultValueCtx },
      {
        commonmark,
        toggleStrongCommand,
        toggleEmphasisCommand,
        wrapInHeadingCommand,
        wrapInBulletListCommand,
        wrapInOrderedListCommand,
        createCodeBlockCommand
      },
      { listener, listenerCtx },
      { history, undoCommand, redoCommand },
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
    insertMarkdown = (markdown: string, inline = false) => editor.action(utils.insert(markdown, inline))
    callCommand = utils.callCommand
    commandKeys.bold = toggleStrongCommand.key
    commandKeys.italic = toggleEmphasisCommand.key
    commandKeys.heading = wrapInHeadingCommand.key
    commandKeys.bulletList = wrapInBulletListCommand.key
    commandKeys.orderedList = wrapInOrderedListCommand.key
    commandKeys.codeBlock = createCodeBlockCommand.key
    commandKeys.undo = undoCommand.key
    commandKeys.redo = redoCommand.key

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

const executeCommand = (commandKey: any, payload?: unknown) => {
  if (!editor || !callCommand || !commandKey) {
    return
  }
  editor.action(callCommand(commandKey, payload))
}

const insertText = (text: string, inline = false) => {
  if (!editor || !insertMarkdown) {
    return
  }
  insertMarkdown(text, inline)
}

const insertFlowBlock = () => {
  insertText('\n```yys-flow\n{\n  "nodes": [],\n  "edges": []\n}\n```\n')
}

const getMarkdownContent = (): string => {
  if (!getMarkdown) {
    return ''
  }
  return normalizeMarkdown(getMarkdown())
}

defineExpose<MilkdownEditorHandle>({
  toggleBold: () => executeCommand(commandKeys.bold),
  toggleItalic: () => executeCommand(commandKeys.italic),
  setHeading: (level: number) => executeCommand(commandKeys.heading, level),
  setBulletList: () => executeCommand(commandKeys.bulletList),
  setOrderedList: () => executeCommand(commandKeys.orderedList),
  setCodeBlock: () => executeCommand(commandKeys.codeBlock),
  undo: () => executeCommand(commandKeys.undo),
  redo: () => executeCommand(commandKeys.redo),
  insertFlowBlock,
  insertText,
  getMarkdown: getMarkdownContent
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
