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

type InlineFlowBlockDeletePayload = {
  blockIndex: number
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
  (event: 'delete-flow-block', payload: InlineFlowBlockDeletePayload): void
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
    const activeFileId = typeof input.activeFileId === 'string' ? input.activeFileId : ''
    const activeIndex = input.fileList.findIndex((item: any) => item?.id === activeFileId)
    const targetIndex = activeIndex >= 0 ? activeIndex : 0
    const graphRawData = input.fileList[targetIndex]?.graphRawData
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

const hashText = (input: string): string => {
  let hash = 5381
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash) + input.charCodeAt(i)
    hash &= 0x7fffffff
  }
  return `h${hash.toString(16)}`
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
  private readonly actionsNode: HTMLDivElement
  private readonly editButton: HTMLButtonElement
  private readonly deleteButton: HTMLButtonElement
  private node: any
  private readonly view: any
  private readonly getPos: boolean | (() => number | undefined)

  constructor(node: any, view: any, getPos: boolean | (() => number | undefined)) {
    this.node = node
    this.view = view
    this.getPos = getPos

    this.dom = document.createElement('section')
    this.dom.className = 'flow-nodeview'

    this.actionsNode = document.createElement('div')
    this.actionsNode.className = 'flow-nodeview-actions'

    this.editButton = document.createElement('button')
    this.editButton.type = 'button'
    this.editButton.className = 'flow-nodeview-action is-edit'
    this.editButton.textContent = '编辑'
    this.editButton.addEventListener('click', this.handleEdit)

    this.deleteButton = document.createElement('button')
    this.deleteButton.type = 'button'
    this.deleteButton.className = 'flow-nodeview-action is-delete'
    this.deleteButton.textContent = '删除'
    this.deleteButton.addEventListener('click', this.handleDelete)

    this.actionsNode.appendChild(this.editButton)
    this.actionsNode.appendChild(this.deleteButton)
    this.previewHost = document.createElement('div')
    this.previewHost.className = 'flow-nodeview-preview'

    this.statusNode = document.createElement('p')
    this.statusNode.className = 'flow-nodeview-status'

    this.dom.appendChild(this.actionsNode)
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
    this.deleteButton.removeEventListener('click', this.handleDelete)
    render(null, this.previewHost)
  }

  private resolveCurrentBlockIndex(): number {
    const pos = typeof this.getPos === 'function' ? this.getPos() : -1
    if (typeof pos !== 'number' || pos < 0) {
      return -1
    }
    return resolveFlowBlockIndex(this.view?.state?.doc, pos)
  }

  private readonly handleEdit = () => {
    const blockIndex = this.resolveCurrentBlockIndex()
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

  private readonly handleDelete = () => {
    const blockIndex = this.resolveCurrentBlockIndex()
    if (blockIndex < 0) {
      return
    }
    emit('delete-flow-block', { blockIndex })
  }

  private renderNode(node: any) {
    const rawText = node?.textContent ?? ''
    const parsed = parseFlowGraphData(rawText)
    const previewKey = hashText(rawText)
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
        key: previewKey,
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
  insertText('\n```yys-flow\n{\n  "schemaVersion": 1,\n  "fileList": [\n    {\n      "id": "flow-1",\n      "label": "File 1",\n      "name": "File 1",\n      "visible": true,\n      "type": "FLOW",\n      "graphRawData": {\n        "nodes": [],\n        "edges": []\n      }\n    }\n  ],\n  "activeFileId": "flow-1",\n  "activeFile": "File 1"\n}\n```\n')
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
  position: relative;
  margin: 12px 0;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
  background: #fff;
}

:deep(.flow-nodeview.is-selected) {
  border-color: #0f766e;
  box-shadow: 0 0 0 2px rgba(15, 118, 110, 0.16);
}

:deep(.flow-nodeview-actions) {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 20;
  display: flex;
  gap: 8px;
  opacity: 0;
  transform: translateY(-4px);
  transition: opacity 0.18s ease, transform 0.18s ease;
  pointer-events: none;
}

:deep(.flow-nodeview:hover .flow-nodeview-actions),
:deep(.flow-nodeview.is-selected .flow-nodeview-actions) {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

:deep(.flow-nodeview-action) {
  padding: 6px 12px;
  background: #fff;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  color: #1f2937;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

:deep(.flow-nodeview-action.is-edit:hover) {
  background: #f0fdf4;
  border-color: #0f766e;
  color: #0f766e;
}

:deep(.flow-nodeview-action.is-delete:hover) {
  background: #fef2f2;
  border-color: #b42318;
  color: #b42318;
}

:deep(.flow-nodeview-preview) {
  min-height: 220px;
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
