<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, nextTick, ref, watch } from 'vue'
import MarkdownIt from 'markdown-it'
import MilkdownEditor, { type MilkdownEditorHandle } from '~/components/editor/MilkdownEditor.client.vue'
import { YysEditorPreview } from 'yys-editor'
import 'yys-editor/style.css'
import { FileSystemEditorStorageAdapter } from '~/utils/editor-storage/file-system'
import { LocalStorageEditorStorageAdapter } from '~/utils/editor-storage/local-storage'

type GraphData = {
  nodes: any[]
  edges: any[]
}

type FlowSegment = {
  type: 'flow'
  key: string
  blockIndex: number
  graphData: GraphData
  raw: string
  error: string
}

type MarkdownSegment = {
  type: 'markdown'
  key: string
  content: string
  html: string
}

type PreviewSegment = FlowSegment | MarkdownSegment

const DEFAULT_MARKDOWN = `# Onmyoji Wiki Editor

欢迎使用编辑器 MVP。

- 默认会自动保存到 localStorage
- 支持导入 / 导出 markdown 与 json
- 在支持 File System Access API 的浏览器中，可选择本地目录并回写原文件

点击上方“插入流程块”后，可在右侧预览点击流程块并打开 yys-editor 进行可视化编辑。
`

const EMPTY_GRAPH_DATA: GraphData = { nodes: [], edges: [] }
const FLOW_BLOCK_REGEX = /```yys-flow[^\r\n]*\r?\n([\s\S]*?)```/g
const markdownRenderer = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: true
})

const markdown = ref(DEFAULT_MARKDOWN)
const localAdapter = new LocalStorageEditorStorageAdapter()
const fileSystemAdapter = new FileSystemEditorStorageAdapter()

const isFsSupported = ref(false)
const activeMode = ref<'local-storage' | 'file-system'>('local-storage')
const capabilityMessage = ref('')
const operationMessage = ref('')
const operationError = ref('')

const markdownFiles = ref<string[]>([])
const selectedFile = ref('')
const autosaveLabel = ref('未保存')
const importing = ref(false)
const savingToFile = ref(false)
const flowEditorVisible = ref(false)
const editingBlockIndex = ref<number | null>(null)
const editingGraphData = ref<GraphData>(EMPTY_GRAPH_DATA)
const flowEditorRef = ref<any>(null)
const milkdownRef = ref<MilkdownEditorHandle | null>(null)

const importInput = ref<HTMLInputElement | null>(null)
let autosaveTimer: ReturnType<typeof setTimeout> | null = null
let hydrated = false

const lockBodyScroll = () => {
  if (typeof window === 'undefined') {
    return
  }
  const body = document.body
  const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth)
  body.style.overflow = 'hidden'
  body.style.paddingRight = scrollbarWidth > 0 ? `${scrollbarWidth}px` : ''
}

const unlockBodyScroll = () => {
  if (typeof window === 'undefined') {
    return
  }
  const body = document.body
  body.style.overflow = ''
  body.style.paddingRight = ''
}

const triggerFlowEditorResize = () => {
  if (typeof window === 'undefined') {
    return
  }
  nextTick(() => {
    flowEditorRef.value?.resizeCanvas?.()
    window.dispatchEvent(new Event('resize'))
    setTimeout(() => {
      flowEditorRef.value?.resizeCanvas?.()
      window.dispatchEvent(new Event('resize'))
    }, 120)
  })
}

const canOpenFile = computed(() => (
  isFsSupported.value && fileSystemAdapter.hasDirectory() && selectedFile.value.trim().length > 0
))

const canSaveToFile = computed(() => (
  isFsSupported.value && fileSystemAdapter.hasDirectory() && !!fileSystemAdapter.getCurrentFileName()
))

const canRefreshFiles = computed(() => (
  isFsSupported.value && fileSystemAdapter.hasDirectory()
))

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

const parseFlowBlock = (raw: string): { data: GraphData; error: string } => {
  if (!raw.trim()) {
    return { data: EMPTY_GRAPH_DATA, error: '' }
  }

  try {
    return { data: normalizeGraphData(JSON.parse(raw)), error: '' }
  } catch {
    return {
      data: EMPTY_GRAPH_DATA,
      error: '流程块 JSON 解析失败，仍可点击后在编辑器中重建并覆盖。'
    }
  }
}

const parsePreviewSegments = (source: string): PreviewSegment[] => {
  const segments: PreviewSegment[] = []
  const regex = new RegExp(FLOW_BLOCK_REGEX)
  let lastIndex = 0
  let blockIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(source)) !== null) {
    const start = match.index
    const end = regex.lastIndex
    const raw = (match[1] || '').trim()
    const parsed = parseFlowBlock(raw)

    if (start > lastIndex) {
      const markdownContent = source.slice(lastIndex, start)
      segments.push({
        type: 'markdown',
        key: `md-${segments.length}`,
        content: markdownContent,
        html: markdownRenderer.render(markdownContent)
      })
    }

    segments.push({
      type: 'flow',
      key: `flow-${blockIndex}`,
      blockIndex,
      graphData: parsed.data,
      raw,
      error: parsed.error
    })

    blockIndex += 1
    lastIndex = end
  }

  if (lastIndex < source.length) {
    const markdownContent = source.slice(lastIndex)
    segments.push({
      type: 'markdown',
      key: `md-${segments.length}`,
      content: markdownContent,
      html: markdownRenderer.render(markdownContent)
    })
  }

  if (segments.length === 0) {
    segments.push({
      type: 'markdown',
      key: 'md-empty',
      content: source,
      html: markdownRenderer.render(source)
    })
  }

  return segments
}

const previewSegments = computed(() => parsePreviewSegments(markdown.value))

const replaceFlowBlock = (source: string, targetIndex: number, replacement: string): string => {
  const regex = new RegExp(FLOW_BLOCK_REGEX)
  let blockIndex = 0
  const output = source.replace(regex, (fullMatch) => {
    if (blockIndex === targetIndex) {
      blockIndex += 1
      return replacement
    }
    blockIndex += 1
    return fullMatch
  })
  return output
}

const clearMessages = () => {
  operationMessage.value = ''
  operationError.value = ''
}

const withErrorHandling = async (task: () => Promise<void>) => {
  clearMessages()
  try {
    await task()
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      return
    }
    operationError.value = error?.message || '操作失败，请重试。'
  }
}

const ensureEditor = (): MilkdownEditorHandle | null => {
  if (!milkdownRef.value) {
    operationError.value = '编辑器尚未准备完成，请稍后重试。'
    return null
  }
  return milkdownRef.value
}

const runEditorAction = (action: (editor: MilkdownEditorHandle) => void) => {
  clearMessages()
  const editor = ensureEditor()
  if (!editor) {
    return
  }
  action(editor)
}

const insertFlowBlock = () => {
  runEditorAction((editor) => {
    editor.insertFlowBlock()
    operationMessage.value = '已插入流程块。可在右侧预览点击流程块打开 yys-editor。'
  })
}

const openFlowBlockEditor = (segment: FlowSegment) => {
  clearMessages()
  editingBlockIndex.value = segment.blockIndex
  editingGraphData.value = JSON.parse(JSON.stringify(segment.graphData))
  if (segment.error) {
    operationMessage.value = `${segment.error} 打开后可重新编辑并保存。`
  }
  flowEditorVisible.value = true
}

const closeFlowBlockEditor = () => {
  flowEditorVisible.value = false
  editingBlockIndex.value = null
}

const applyFlowBlockChanges = () => {
  if (editingBlockIndex.value === null) {
    return
  }

  const graphData = flowEditorRef.value?.getGraphData?.()
  const normalizedGraphData = normalizeGraphData(graphData)
  const serialized = `\`\`\`yys-flow\n${JSON.stringify(normalizedGraphData, null, 2)}\n\`\`\``
  markdown.value = replaceFlowBlock(markdown.value, editingBlockIndex.value, serialized)
  flowEditorVisible.value = false
  operationMessage.value = `流程块 #${editingBlockIndex.value + 1} 已更新。`
}

const chooseDirectory = async () => {
  await withErrorHandling(async () => {
    const files = await fileSystemAdapter.pickDirectory()
    markdownFiles.value = files
    selectedFile.value = files[0] || ''
    activeMode.value = 'file-system'
    operationMessage.value = files.length > 0
      ? `目录已连接，共发现 ${files.length} 个 markdown 文件。`
      : '目录已连接，但未发现 markdown 文件。'
  })
}

const refreshDirectoryFiles = async () => {
  if (!canRefreshFiles.value) {
    return
  }

  await withErrorHandling(async () => {
    const files = await fileSystemAdapter.listFiles()
    markdownFiles.value = files
    if (!selectedFile.value && files.length > 0) {
      selectedFile.value = files[0]
    }
    operationMessage.value = files.length > 0
      ? `目录已刷新，共发现 ${files.length} 个 markdown 文件。`
      : '目录已刷新，但未发现 markdown 文件。'
  })
}

const openSelectedFile = async () => {
  if (!canOpenFile.value) {
    return
  }
  await withErrorHandling(async () => {
    const content = await fileSystemAdapter.openFile(selectedFile.value)
    selectedFile.value = selectedFile.value.trim()
    markdown.value = content
    activeMode.value = 'file-system'
    operationMessage.value = `已打开 ${selectedFile.value}。`
  })
}

const saveToSourceFile = async () => {
  if (!canSaveToFile.value) {
    return
  }

  savingToFile.value = true
  await withErrorHandling(async () => {
    await fileSystemAdapter.saveMarkdown(markdown.value)
    operationMessage.value = `已回写 ${fileSystemAdapter.getCurrentFileName()}。`
  })
  savingToFile.value = false
}

const triggerImport = () => {
  importInput.value?.click()
}

const parseImportedContent = (name: string, text: string): string => {
  if (name.toLowerCase().endsWith('.json')) {
    const parsed = JSON.parse(text) as Record<string, unknown>
    if (typeof parsed.markdown === 'string') {
      return parsed.markdown
    }
    throw new Error('JSON 文件缺少 markdown 字段。')
  }
  return text
}

const handleImport = async (event: Event) => {
  if (importing.value) {
    return
  }

  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) {
    return
  }

  importing.value = true
  await withErrorHandling(async () => {
    const text = await file.text()
    markdown.value = parseImportedContent(file.name, text)
    operationMessage.value = `已导入 ${file.name}。`
    activeMode.value = 'local-storage'
  })
  importing.value = false
  target.value = ''
}

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

const exportMarkdown = () => {
  const blob = new Blob([markdown.value], { type: 'text/markdown;charset=utf-8' })
  downloadBlob(blob, 'wiki-editor.md')
  operationMessage.value = '已导出 markdown 文件。'
}

const exportJson = () => {
  const payload = {
    version: 1,
    markdown: markdown.value,
    exportedAt: new Date().toISOString()
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
  downloadBlob(blob, 'wiki-editor.json')
  operationMessage.value = '已导出 JSON 文件。'
}

onMounted(async () => {
  isFsSupported.value = fileSystemAdapter.isSupported()
  capabilityMessage.value = isFsSupported.value
    ? '检测到 File System Access API，可使用目录模式打开并保存 markdown 文件。'
    : '当前浏览器不支持 File System Access API，已自动回退到 localStorage 模式。'

  const restored = await localAdapter.loadInitialMarkdown()
  if (restored) {
    markdown.value = restored
    operationMessage.value = '已从 localStorage 恢复上次草稿。'
  }

  hydrated = true
})

watch(markdown, (nextValue) => {
  if (!hydrated) {
    return
  }

  if (autosaveTimer) {
    clearTimeout(autosaveTimer)
  }

  autosaveTimer = setTimeout(async () => {
    await localAdapter.saveMarkdown(nextValue)
    autosaveLabel.value = `localStorage 已保存 ${new Date().toLocaleTimeString('zh-CN')}`
  }, 500)
})

watch(flowEditorVisible, (visible) => {
  if (visible) {
    lockBodyScroll()
    triggerFlowEditorResize()
    return
  }
  unlockBodyScroll()
})

onBeforeUnmount(() => {
  unlockBodyScroll()
  if (autosaveTimer) {
    clearTimeout(autosaveTimer)
  }
})
</script>

<template>
  <main class="editor-page">
    <section class="panel">
      <header class="panel-header">
        <h1>/editor</h1>
        <p class="subtitle">Milkdown + 双存储 MVP（localStorage 默认，File System Access API 可选）</p>
      </header>

      <div class="toolbar">
        <div class="left">
          <button type="button" @click="triggerImport">导入 markdown/json</button>
          <button type="button" @click="exportMarkdown">导出 markdown</button>
          <button type="button" @click="exportJson">导出 json</button>
        </div>
        <div class="right">
          <span class="mode">当前模式：{{ activeMode }}</span>
          <span class="autosave">{{ autosaveLabel }}</span>
        </div>
      </div>

      <div class="editor-tools">
        <button type="button" @click="runEditorAction((editor) => editor.toggleBold())"><strong>B</strong></button>
        <button type="button" @click="runEditorAction((editor) => editor.toggleItalic())"><em>I</em></button>
        <button type="button" @click="runEditorAction((editor) => editor.setHeading(2))">H2</button>
        <button type="button" @click="runEditorAction((editor) => editor.setHeading(3))">H3</button>
        <button type="button" @click="runEditorAction((editor) => editor.setBulletList())">无序列表</button>
        <button type="button" @click="runEditorAction((editor) => editor.setOrderedList())">有序列表</button>
        <button type="button" @click="runEditorAction((editor) => editor.setCodeBlock())">代码块</button>
        <button type="button" @click="runEditorAction((editor) => editor.undo())">撤销</button>
        <button type="button" @click="runEditorAction((editor) => editor.redo())">重做</button>
        <button type="button" class="primary" @click="insertFlowBlock">插入流程块</button>
      </div>

      <div class="capability">
        {{ capabilityMessage }}
      </div>

      <div v-if="isFsSupported" class="fsa-tools">
        <button type="button" @click="chooseDirectory">选择目录</button>
        <button type="button" :disabled="!canRefreshFiles" @click="refreshDirectoryFiles">刷新文件列表</button>
        <input
          v-model="selectedFile"
          list="markdown-file-options"
          placeholder="输入或选择 markdown 文件名，如 test.md"
        >
        <datalist id="markdown-file-options">
          <option v-for="file in markdownFiles" :key="file" :value="file" />
        </datalist>
        <button type="button" :disabled="!canOpenFile" @click="openSelectedFile">打开文件</button>
        <button type="button" :disabled="!canSaveToFile || savingToFile" @click="saveToSourceFile">
          {{ savingToFile ? '保存中...' : '保存回原文件' }}
        </button>
      </div>

      <p v-if="operationMessage" class="message">{{ operationMessage }}</p>
      <p v-if="operationError" class="error">{{ operationError }}</p>

      <div class="workspace">
        <section class="workspace-pane">
          <h2>Markdown 编辑</h2>
          <MilkdownEditor ref="milkdownRef" v-model="markdown" />
        </section>

        <section class="workspace-pane preview-pane">
          <h2>渲染预览（点击流程块可编辑）</h2>
          <div class="preview-content">
            <template v-for="segment in previewSegments" :key="segment.key">
              <div v-if="segment.type === 'markdown'" class="markdown-block" v-html="segment.html" />

              <article v-else class="flow-block" @click="openFlowBlockEditor(segment)">
                <header class="flow-block-header">
                  <span>流程块 #{{ segment.blockIndex + 1 }}</span>
                  <button type="button" @click.stop="openFlowBlockEditor(segment)">编辑</button>
                </header>

                <p v-if="segment.error" class="flow-error">{{ segment.error }}</p>
                <ClientOnly>
                  <YysEditorPreview
                    mode="preview"
                    capability="render-only"
                    :data="segment.graphData"
                    :height="280"
                    :show-mini-map="false"
                  />
                  <template #fallback>
                    <div class="flow-fallback">流程图加载中...</div>
                  </template>
                </ClientOnly>
                <p class="flow-tip">点击块可打开 yys-editor 进行可视化编辑并回写 markdown。</p>
              </article>
            </template>
          </div>
        </section>
      </div>
    </section>

    <div v-if="flowEditorVisible" class="flow-modal-mask" @click.self="closeFlowBlockEditor">
      <section class="flow-modal">
        <header class="flow-modal-header">
          <h3>编辑流程块 #{{ (editingBlockIndex ?? 0) + 1 }}</h3>
          <div class="flow-modal-actions">
            <button type="button" @click="closeFlowBlockEditor">取消</button>
            <button type="button" class="primary" @click="applyFlowBlockChanges">应用到块</button>
          </div>
        </header>
        <div class="flow-modal-body">
          <ClientOnly>
            <YysEditorPreview
              ref="flowEditorRef"
              class="flow-modal-editor"
              mode="edit"
              capability="interactive"
              :data="editingGraphData"
              height="100%"
            />
          </ClientOnly>
        </div>
      </section>
    </div>

    <input
      ref="importInput"
      type="file"
      accept=".md,.markdown,.json,text/markdown,application/json"
      class="hidden-input"
      @change="handleImport"
    >
  </main>
</template>

<style scoped>
.editor-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #f6f8fb 0%, #eef2f8 100%);
  padding: 24px 16px 48px;
}

.panel {
  max-width: 1280px;
  margin: 0 auto;
  background: #fff;
  border: 1px solid #d8dde8;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 18px 30px rgba(15, 23, 42, 0.08);
}

.panel-header h1 {
  margin: 0;
  font-size: 28px;
}

.subtitle {
  margin: 6px 0 0;
  color: #4a5568;
}

.toolbar,
.editor-tools {
  margin-top: 16px;
  padding: 12px;
  border: 1px solid #d8dde8;
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  background: #f8fafc;
}

.editor-tools {
  justify-content: flex-start;
}

.left,
.right,
.fsa-tools {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

button,
select,
input {
  border: 1px solid #c4cddc;
  border-radius: 6px;
  background: #fff;
  padding: 8px 10px;
  font-size: 14px;
}

input {
  min-width: 260px;
}

button {
  cursor: pointer;
}

button.primary {
  background: #0f766e;
  border-color: #0f766e;
  color: #fff;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.mode,
.autosave {
  font-size: 13px;
  color: #334155;
}

.capability {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #fff8e1;
  color: #8a5a00;
  border: 1px solid #f3d391;
}

.fsa-tools {
  margin-top: 12px;
}

.message {
  color: #0f5132;
  margin-top: 10px;
}

.error {
  color: #b42318;
  margin-top: 10px;
}

.workspace {
  margin-top: 16px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.workspace-pane h2 {
  margin: 0 0 10px;
  font-size: 16px;
}

.preview-pane {
  border: 1px solid #d8dde8;
  border-radius: 10px;
  padding: 12px;
  background: #fbfdff;
}

.preview-content {
  max-height: 760px;
  overflow: auto;
}

.markdown-block :deep(*) {
  max-width: 100%;
}

.flow-block {
  margin: 14px 0;
  border: 1px solid #d7deed;
  border-radius: 10px;
  background: #fff;
  padding: 8px;
  cursor: pointer;
}

.flow-block-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 13px;
  color: #334155;
}

.flow-block-header button {
  padding: 4px 8px;
  font-size: 12px;
}

.flow-tip {
  margin: 8px 0 0;
  font-size: 12px;
  color: #64748b;
}

.flow-error {
  margin: 4px 0 8px;
  color: #b42318;
  font-size: 13px;
}

.flow-fallback {
  border: 1px dashed #c4cddc;
  border-radius: 8px;
  min-height: 120px;
  display: grid;
  place-items: center;
  color: #64748b;
}

.flow-modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.52);
  display: grid;
  place-items: center;
  padding: 16px;
  z-index: 2000;
}

.flow-modal {
  width: min(1320px, 100%);
  height: min(92vh, 900px);
  max-height: calc(100vh - 32px);
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #c7d2fe;
  display: flex;
  flex-direction: column;
}

.flow-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-bottom: 1px solid #dbe3f2;
  background: #f8fafc;
}

.flow-modal-body {
  flex: 1;
  min-height: 0;
}

.flow-modal-editor {
  width: 100%;
  height: 100%;
  display: block;
}

.flow-modal-header h3 {
  margin: 0;
}

.flow-modal-actions {
  display: flex;
  gap: 8px;
}

.hidden-input {
  display: none;
}

@media (max-width: 960px) {
  .workspace {
    grid-template-columns: 1fr;
  }

  .flow-modal-mask {
    padding: 10px;
  }

  .flow-modal {
    width: 100%;
    height: calc(100vh - 20px);
    max-height: calc(100vh - 20px);
  }
}

@media (max-width: 720px) {
  .panel {
    padding: 14px;
  }

  .panel-header h1 {
    font-size: 24px;
  }

  .flow-modal-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .flow-modal-actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
