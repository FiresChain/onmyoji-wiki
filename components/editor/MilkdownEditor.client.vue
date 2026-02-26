<script setup lang="ts">
import { h, nextTick, onBeforeUnmount, onMounted, ref, render, shallowRef, watch } from 'vue'
import '@milkdown/theme-nord/style.css'
import '@milkdown/kit/prose/gapcursor/style/gapcursor.css'
import { normalizeGraphForPreview, normalizeGraphData, type GraphData } from '~/utils/flow-preview'

type InlineFlowBlockPayload = {
  blockIndex: number
  graphData: GraphData
  previewHeight: number
  error: string
}

type InlineFlowBlockDeletePayload = {
  blockIndex: number
}

type InlineFlowBlockCutPayload = {
  blockIndex: number
}

type InlineFlowBlockMovePayload = {
  blockIndex: number
  direction: 'up' | 'down'
}

export type MilkdownEditorHandle = {
  isReady: () => boolean
  focus: () => void
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
  (event: 'cut-flow-block', payload: InlineFlowBlockCutPayload): void
  (event: 'move-flow-block', payload: InlineFlowBlockMovePayload): void
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
let commandExecutor: ((commandKey: any, payload?: unknown) => unknown) | null = null
let internalPatch = false
let lastMarkdownFromEditor: string | null = null
const commandKeys: Record<string, any> = {}
const DEBUG_MILKDOWN_COMMAND = true

const resolveActiveElementInfo = (): string => {
  if (typeof document === 'undefined') {
    return 'no-document'
  }
  const active = document.activeElement as HTMLElement | null
  if (!active) {
    return 'none'
  }
  const className = typeof active.className === 'string' && active.className.trim()
    ? `.${active.className.trim().replace(/\s+/g, '.')}`
    : ''
  const id = active.id ? `#${active.id}` : ''
  return `${active.tagName}${id}${className}`
}

const isActiveInProseMirror = (proseMirror: HTMLElement | null): boolean => {
  if (typeof document === 'undefined') {
    return true
  }
  const active = document.activeElement as HTMLElement | null
  if (!active) {
    return false
  }
  if (proseMirror && active === proseMirror) {
    return true
  }
  return !!active.closest('.ProseMirror')
}

const resolveCommandKey = (command: any): any => {
  if (!command) {
    return undefined
  }
  if (typeof command === 'string') {
    return command
  }
  if (typeof command === 'function') {
    return (command as { key?: unknown }).key
  }
  if (typeof command === 'object' && 'key' in command) {
    return (command as { key?: unknown }).key
  }
  return undefined
}

const resolveCommandRunner = (command: any): ((payload?: unknown) => unknown) | null => {
  if (!command || typeof command !== 'function') {
    return null
  }
  const runner = (command as { run?: (payload?: unknown) => unknown }).run
  return typeof runner === 'function' ? runner : null
}

const isCommandUsable = (command: any): boolean => {
  return !!resolveCommandRunner(command) || !!resolveCommandKey(command)
}

const normalizeMarkdown = (value: string): string => value.replace(/\r\n/g, '\n')
const EMPTY_GRAPH_DATA: GraphData = { nodes: [], edges: [] }
const DEFAULT_FLOW_PREVIEW_HEIGHT = 260

const resolvePreviewHeight = (input: any, fallback = DEFAULT_FLOW_PREVIEW_HEIGHT): number => {
  if (!input || typeof input !== 'object') {
    return fallback
  }
  const rawHeight = (input as Record<string, unknown>).height
  if (typeof rawHeight === 'number' && Number.isFinite(rawHeight) && rawHeight > 0) {
    return rawHeight
  }
  if (typeof rawHeight === 'string') {
    const parsed = Number(rawHeight.trim())
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed
    }
  }
  return fallback
}

const parseFlowGraphData = (raw: string): { graphData: GraphData; previewHeight: number; error: string } => {
  if (!raw.trim()) {
    return { graphData: EMPTY_GRAPH_DATA, previewHeight: DEFAULT_FLOW_PREVIEW_HEIGHT, error: '' }
  }

  try {
    const parsed = JSON.parse(raw)
    return {
      graphData: normalizeGraphData(parsed),
      previewHeight: resolvePreviewHeight(parsed),
      error: ''
    }
  } catch {
    return {
      graphData: EMPTY_GRAPH_DATA,
      previewHeight: DEFAULT_FLOW_PREVIEW_HEIGHT,
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
    return true
  })
  return foundIndex
}

class FlowBlockNodeView {
  dom: HTMLDivElement
  private readonly previewHost: HTMLDivElement
  private readonly statusNode: HTMLParagraphElement
  private readonly actionsNode: HTMLDivElement
  private readonly editButton: HTMLButtonElement
  private readonly cutButton: HTMLButtonElement
  private readonly deleteButton: HTMLButtonElement
  private readonly moveUpButton: HTMLButtonElement
  private readonly moveDownButton: HTMLButtonElement
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

    this.cutButton = document.createElement('button')
    this.cutButton.type = 'button'
    this.cutButton.className = 'flow-nodeview-action is-cut'
    this.cutButton.textContent = '剪切'
    this.cutButton.addEventListener('click', this.handleCut)

    this.deleteButton = document.createElement('button')
    this.deleteButton.type = 'button'
    this.deleteButton.className = 'flow-nodeview-action is-delete'
    this.deleteButton.textContent = '删除'
    this.deleteButton.addEventListener('click', this.handleDelete)

    this.moveUpButton = document.createElement('button')
    this.moveUpButton.type = 'button'
    this.moveUpButton.className = 'flow-nodeview-action'
    this.moveUpButton.textContent = '上移'
    this.moveUpButton.addEventListener('click', this.handleMoveUp)

    this.moveDownButton = document.createElement('button')
    this.moveDownButton.type = 'button'
    this.moveDownButton.className = 'flow-nodeview-action'
    this.moveDownButton.textContent = '下移'
    this.moveDownButton.addEventListener('click', this.handleMoveDown)

    this.actionsNode.appendChild(this.moveUpButton)
    this.actionsNode.appendChild(this.moveDownButton)
    this.actionsNode.appendChild(this.cutButton)
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
    this.cutButton.removeEventListener('click', this.handleCut)
    this.deleteButton.removeEventListener('click', this.handleDelete)
    this.moveUpButton.removeEventListener('click', this.handleMoveUp)
    this.moveDownButton.removeEventListener('click', this.handleMoveDown)
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
      previewHeight: parsed.previewHeight,
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

  private readonly handleCut = () => {
    const blockIndex = this.resolveCurrentBlockIndex()
    if (blockIndex < 0) {
      return
    }
    emit('cut-flow-block', { blockIndex })
  }

  private readonly handleMoveUp = () => {
    const blockIndex = this.resolveCurrentBlockIndex()
    if (blockIndex < 0) {
      return
    }
    emit('move-flow-block', { blockIndex, direction: 'up' })
  }

  private readonly handleMoveDown = () => {
    const blockIndex = this.resolveCurrentBlockIndex()
    if (blockIndex < 0) {
      return
    }
    emit('move-flow-block', { blockIndex, direction: 'down' })
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
        data: normalizeGraphForPreview(parsed.graphData),
        height: parsed.previewHeight
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
      { Editor, rootCtx, defaultValueCtx, nodeViewCtx, commandsCtx },
      {
        commonmark,
        toggleStrongCommand,
        toggleEmphasisCommand,
        turnIntoTextCommand,
        wrapInHeadingCommand,
        wrapInBulletListCommand,
        wrapInOrderedListCommand,
        createCodeBlockCommand
      },
      { listener, listenerCtx },
      { history, undoCommand, redoCommand },
      { cursor },
      { trailing },
      { nord },
      utils
    ] = await Promise.all([
      import('@milkdown/kit/core'),
      import('@milkdown/kit/preset/commonmark'),
      import('@milkdown/kit/plugin/listener'),
      import('@milkdown/kit/plugin/history'),
      import('@milkdown/kit/plugin/cursor'),
      import('@milkdown/kit/plugin/trailing'),
      import('@milkdown/theme-nord'),
      import('@milkdown/kit/utils')
    ])

    getMarkdown = () => editor.action(utils.getMarkdown())
    replaceAll = (markdown: string) => editor.action(utils.replaceAll(markdown))
    insertMarkdown = (markdown: string, inline = false) => editor.action(utils.insert(markdown, inline))
    callCommand = utils.callCommand
    commandExecutor = (commandKey, payload) => {
      return editor.action((ctx: any) => {
        return ctx.get(commandsCtx).call(commandKey, payload)
      })
    }
    commandKeys.bold = toggleStrongCommand
    commandKeys.italic = toggleEmphasisCommand
    commandKeys.turnIntoText = turnIntoTextCommand
    commandKeys.heading = wrapInHeadingCommand
    commandKeys.bulletList = wrapInBulletListCommand
    commandKeys.orderedList = wrapInOrderedListCommand
    commandKeys.codeBlock = createCodeBlockCommand
    commandKeys.undo = undoCommand
    commandKeys.redo = redoCommand

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
      .use(cursor)
      .use(trailing)
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

const executeCommand = (commandKey: any, payload?: unknown, retryCount = 0) => {
  const commandRunner = resolveCommandRunner(commandKey)
  const resolvedCommandKey = resolveCommandKey(commandKey)
  if (!editor || (!commandRunner && !resolvedCommandKey)) {
    if (DEBUG_MILKDOWN_COMMAND) {
      console.warn('[milkdown command] skipped: editor or commandKey missing', {
        retryCount,
        commandKey,
        resolvedCommandKey,
        hasRunner: !!commandRunner
      })
    }
    return
  }
  const rootElement = root.value
  const proseMirror = rootElement?.querySelector('.ProseMirror') as HTMLElement | null
  proseMirror?.focus()
  const activeInProseMirror = isActiveInProseMirror(proseMirror)
  if (DEBUG_MILKDOWN_COMMAND) {
    console.info('[milkdown command] start', {
      retryCount,
      commandKey: resolvedCommandKey,
      payload,
      hasRunner: !!commandRunner,
      activeElement: resolveActiveElementInfo(),
      proseMirrorFound: !!proseMirror,
      activeInProseMirror
    })
  }
  if (!activeInProseMirror) {
    if (DEBUG_MILKDOWN_COMMAND) {
      console.warn('[milkdown command] precondition failed: activeElement not in ProseMirror', {
        retryCount,
        activeElement: resolveActiveElementInfo()
      })
    }
    if (retryCount < 2 && typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        executeCommand(commandKey, payload, retryCount + 1)
      })
    }
    return
  }

  const payloadCandidates = [payload]
  if (typeof payload === 'number') {
    payloadCandidates.length = 0
    payloadCandidates.push(payload)
    payloadCandidates.push({ level: payload })
  }

  const tryExecuteCandidates = (key: any): boolean => {
    for (const candidate of payloadCandidates) {
      try {
        let result: unknown
        if (commandRunner) {
          result = commandRunner(candidate)
        } else if (commandExecutor) {
          result = commandExecutor(key, candidate)
        } else if (callCommand) {
          result = editor.action(callCommand(key, candidate))
        } else {
          if (DEBUG_MILKDOWN_COMMAND) {
            console.warn('[milkdown command] no executor available')
          }
          continue
        }
        if (DEBUG_MILKDOWN_COMMAND) {
          console.info('[milkdown command] candidate result', { key, candidate, result })
        }
        if (result === true) {
          return true
        }
      } catch (error) {
        if (DEBUG_MILKDOWN_COMMAND) {
          console.warn('[milkdown command] candidate threw', { key, candidate, error })
        }
      }
    }
    return false
  }

  let succeeded = tryExecuteCandidates(resolvedCommandKey)
  const headingKey = resolveCommandKey(commandKeys.heading)
  const turnIntoTextKey = resolveCommandKey(commandKeys.turnIntoText)
  const turnIntoTextRunner = resolveCommandRunner(commandKeys.turnIntoText)
  if (!succeeded && resolvedCommandKey === headingKey && (turnIntoTextRunner || turnIntoTextKey)) {
    if (DEBUG_MILKDOWN_COMMAND) {
      console.warn('[milkdown command] heading fallback: turnIntoText then retry')
    }
    try {
      if (turnIntoTextRunner) {
        turnIntoTextRunner()
      } else if (commandExecutor && turnIntoTextKey) {
        commandExecutor(turnIntoTextKey)
      } else if (callCommand && turnIntoTextKey) {
        editor.action(callCommand(turnIntoTextKey))
      }
    } catch {
      // 忽略转段落失败
    }
    succeeded = tryExecuteCandidates(resolvedCommandKey)
  }

  if (succeeded) {
    if (DEBUG_MILKDOWN_COMMAND) {
      console.info('[milkdown command] success', { commandKey: resolvedCommandKey, retryCount })
    }
    return
  }

  if (!succeeded && retryCount < 2 && typeof window !== 'undefined') {
    if (DEBUG_MILKDOWN_COMMAND) {
      console.warn('[milkdown command] retry on next frame', { commandKey: resolvedCommandKey, retryCount })
    }
    window.requestAnimationFrame(() => {
      executeCommand(commandKey, payload, retryCount + 1)
    })
    return
  }

  if (DEBUG_MILKDOWN_COMMAND) {
    console.warn('[milkdown command] failed', { commandKey: resolvedCommandKey, payload, retryCount })
  }
}

const insertText = (text: string, inline = false) => {
  if (!editor || !insertMarkdown) {
    return
  }
  insertMarkdown(text, inline)
}

const focusEditor = () => {
  const rootElement = root.value
  const proseMirror = rootElement?.querySelector('.ProseMirror') as HTMLElement | null
  proseMirror?.focus()
}

const insertFlowBlock = () => {
  insertText('\n```yys-flow\n{\n  "height": 260,\n  "schemaVersion": 1,\n  "fileList": [\n    {\n      "id": "flow-1",\n      "label": "File 1",\n      "name": "File 1",\n      "visible": true,\n      "type": "FLOW",\n      "graphRawData": {\n        "nodes": [],\n        "edges": []\n      }\n    }\n  ],\n  "activeFileId": "flow-1",\n  "activeFile": "File 1"\n}\n```\n')
}

const getMarkdownContent = (): string => {
  if (!getMarkdown) {
    return ''
  }
  return normalizeMarkdown(getMarkdown())
}

const isEditorReady = (): boolean => {
  if (!editor || booting.value || !!bootError.value || !getMarkdown) {
    return false
  }
  const requiredCommands = [
    commandKeys.bold,
    commandKeys.italic,
    commandKeys.heading,
    commandKeys.bulletList,
    commandKeys.orderedList,
    commandKeys.codeBlock,
    commandKeys.undo,
    commandKeys.redo
  ]
  if (requiredCommands.some((command) => !isCommandUsable(command))) {
    return false
  }
  try {
    getMarkdown()
    return true
  } catch {
    return false
  }
}

defineExpose<MilkdownEditorHandle>({
  isReady: isEditorReady,
  focus: focusEditor,
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

:deep(.flow-nodeview-action.is-cut:hover) {
  background: #f0f9ff;
  border-color: #0c4a6e;
  color: #0c4a6e;
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
