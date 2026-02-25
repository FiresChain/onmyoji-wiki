<script setup lang="ts">
import { h, nextTick, onBeforeUnmount, onMounted, ref, render, shallowRef, watch } from 'vue'
import '@milkdown/theme-nord/style.css'

type GraphData = {
  nodes: any[]
  edges: any[]
}

type InlineFlowBlockPayload = {
  blockIndex: number
  graphData: GraphData
  error: string
}

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
  (event: 'open-flow-block', payload: InlineFlowBlockPayload): void
}>()

const root = ref<HTMLDivElement | null>(null)
const booting = ref(true)
const bootError = ref('')
const flowPreviewComponent = shallowRef<any>(null)

let editor: any = null
let getMarkdown: (() => string) | null = null
let replaceAll: ((markdown: string) => any) | null = null
let insertMarkdown: ((markdown: string, inline?: boolean) => any) | null = null
let callCommand: ((slice: any, payload?: any) => any) | null = null
let internalPatch = false
let lastMarkdownFromEditor: string | null = null
const commandKeys: Record<string, any> = {}

const normalizeMarkdown = (value: string): string => value.replace(/\r\n/g, '\n')
const EMPTY_GRAPH_DATA: GraphData = { nodes: [], edges: [] }

const normalizeGraphData = (input: any): GraphData => {
  if (!input || typeof input !== 'object') {
    return { nodes: [], edges: [] }
  }

  if (Array.isArray(input.fileList) && input.fileList.length > 0) {
    const graphRawData = input.fileList[0]?.graphRawData
    if (graphRawData && typeof graphRawData === 'object') {
      return {
        nodes: Array.isArray(graphRawData.nodes) ? graphRawData.nodes : [],
        edges: Array.isArray(graphRawData.edges) ? graphRawData.edges : []
      }
    }
  }

  return {
    nodes: Array.isArray(input.nodes) ? input.nodes : [],
    edges: Array.isArray(input.edges) ? input.edges : []
  }
}

const parseFlowGraphData = (raw: string): { graphData: GraphData; error: string } => {
  if (!raw.trim()) {
    return { graphData: EMPTY_GRAPH_DATA, error: '' }
  }

  try {
    return { graphData: normalizeGraphData(JSON.parse(raw)), error: '' }
  } catch {
    return {
      graphData: EMPTY_GRAPH_DATA,
      error: '流程块 JSON 解析失败，点击“编辑流程块”后可重新保存覆盖。'
    }
  }
}

const isFlowCodeBlock = (node: any): boolean => {
  if (!node || node.type?.name !== 'code_block') {
    return false
  }
  const language = typeof node.attrs?.language === 'string' ? node.attrs.language.trim().toLowerCase() : ''
  return language === 'yys-flow'
}

const resolveFlowBlockIndex = (doc: any, targetPos: number): number => {
  if (!doc || typeof doc.descendants !== 'function') {
    return -1
  }

  let blockIndex = 0
  let foundIndex = -1
  doc.descendants((node: any, pos: number) => {
    if (!isFlowCodeBlock(node)) {
      return true
    }
    if (pos === targetPos) {
      foundIndex = blockIndex
      return false
    }
    blockIndex += 1
    return false
  })
  return foundIndex
}

class FlowBlockNodeView {
  dom: HTMLDivElement
  private readonly previewHost: HTMLDivElement
  private readonly statusNode: HTMLParagraphElement
  private readonly editButton: HTMLButtonElement
  private node: any
  private readonly view: any
  private readonly getPos: boolean | (() => number | undefined)

  constructor(node: any, view: any, getPos: boolean | (() => number | undefined)) {
    this.node = node
    this.view = view
    this.getPos = getPos

    this.dom = document.createElement('section')
    this.dom.className = 'flow-nodeview'

    const header = document.createElement('header')
    header.className = 'flow-nodeview-header'

    const title = document.createElement('strong')
    title.textContent = '流程块'
    header.appendChild(title)

    this.editButton = document.createElement('button')
    this.editButton.type = 'button'
    this.editButton.className = 'flow-nodeview-action'
    this.editButton.textContent = '编辑流程块'
    this.editButton.addEventListener('click', this.handleEdit)
    header.appendChild(this.editButton)

    this.previewHost = document.createElement('div')
    this.previewHost.className = 'flow-nodeview-preview'

    this.statusNode = document.createElement('p')
    this.statusNode.className = 'flow-nodeview-status'

    this.dom.appendChild(header)
    this.dom.appendChild(this.previewHost)
    this.dom.appendChild(this.statusNode)

    this.renderNode(node)
  }

  update(nextNode: any): boolean {
    if (!isFlowCodeBlock(nextNode)) {
      return false
    }
    this.node = nextNode
    this.renderNode(nextNode)
    return true
  }

  selectNode() {
    this.dom.classList.add('is-selected')
  }

  deselectNode() {
    this.dom.classList.remove('is-selected')
  }

  stopEvent(event: Event): boolean {
    const target = event.target as HTMLElement | null
    return !!target?.closest('.flow-nodeview-action')
  }

  ignoreMutation(): boolean {
    return true
  }

  destroy() {
    this.editButton.removeEventListener('click', this.handleEdit)
    render(null, this.previewHost)
  }

  private readonly handleEdit = () => {
    const pos = typeof this.getPos === 'function' ? this.getPos() : -1
    if (typeof pos !== 'number' || pos < 0) {
      return
    }

    const blockIndex = resolveFlowBlockIndex(this.view?.state?.doc, pos)
    if (blockIndex < 0) {
      return
    }

    const parsed = parseFlowGraphData(this.node?.textContent ?? '')
    emit('open-flow-block', {
      blockIndex,
      graphData: parsed.graphData,
      error: parsed.error
    })
  }

  private renderNode(node: any) {
    const parsed = parseFlowGraphData(node?.textContent ?? '')
    if (!flowPreviewComponent.value) {
      this.previewHost.textContent = '流程图组件加载中...'
      if (parsed.error) {
        this.statusNode.textContent = parsed.error
        this.statusNode.style.display = 'block'
      } else {
        this.statusNode.textContent = ''
        this.statusNode.style.display = 'none'
      }
      return
    }

    render(
      h(flowPreviewComponent.value, {
        mode: 'preview',
        capability: 'render-only',
        data: parsed.graphData,
        height: 260
      }),
      this.previewHost
    )

    if (parsed.error) {
      this.statusNode.textContent = parsed.error
      this.statusNode.style.display = 'block'
    } else {
      this.statusNode.textContent = ''
      this.statusNode.style.display = 'none'
    }
  }
}

onMounted(async () => {
  try {
    await nextTick()
    if (!root.value) {
      throw new Error('Milkdown root element not found.')
    }

    if (import.meta.client) {
      const [{ YysEditorPreview }] = await Promise.all([
        import('yys-editor'),
        import('yys-editor/style.css')
      ])
      flowPreviewComponent.value = YysEditorPreview
    }

    const [
      { Editor, rootCtx, defaultValueCtx, nodeViewCtx },
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
        ctx.update(nodeViewCtx, (entries: [string, any][]) => {
          const otherViews = entries.filter(([nodeId]) => nodeId !== 'code_block')
          return [
            ...otherViews,
            ['code_block', (node: any, view: any, getPos: boolean | (() => number | undefined)) => {
              if (!isFlowCodeBlock(node)) {
                return undefined
              }
              return new FlowBlockNodeView(node, view, getPos)
            }]
          ]
        })
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

:deep(.flow-nodeview) {
  margin: 10px 0;
  border: 1px solid #cdd6e6;
  border-radius: 10px;
  overflow: hidden;
  background: #f8fbff;
}

:deep(.flow-nodeview.is-selected) {
  border-color: #0f766e;
  box-shadow: 0 0 0 2px rgba(15, 118, 110, 0.16);
}

:deep(.flow-nodeview-header) {
  padding: 10px 12px;
  border-bottom: 1px solid #d8e0ee;
  background: #eef4fb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

:deep(.flow-nodeview-action) {
  border: 1px solid #0f766e;
  background: #0f766e;
  color: #fff;
  border-radius: 6px;
  padding: 6px 10px;
  cursor: pointer;
}

:deep(.flow-nodeview-preview) {
  min-height: 180px;
  background: #fff;
}

:deep(.flow-nodeview-status) {
  margin: 0;
  padding: 8px 12px 10px;
  color: #b42318;
  font-size: 13px;
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
