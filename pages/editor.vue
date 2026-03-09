<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, nextTick, ref, watch } from 'vue'
import MilkdownEditor, { type MilkdownEditorHandle } from '~/components/editor/MilkdownEditor.client.vue'
import { YysEditorPreview } from '@rookie4show/onmyoji-flow'
import '@rookie4show/onmyoji-flow/style.css'
import JSZip from 'jszip'
import { FileSystemEditorStorageAdapter } from '~/utils/editor-storage/file-system'
import { LOCAL_STORAGE_BACKUP_KEY, LOCAL_STORAGE_KEY, LocalStorageEditorStorageAdapter } from '~/utils/editor-storage/local-storage'
import { normalizeGraphData, resolveGraphBounds, type GraphData } from '~/utils/flow-preview'
import { validateGraphGroupRules } from '~/utils/flow-rules'
import { collectFlowAssetIssues } from '~/utils/flow-assets'
import {
  ONMYOJI_EDITOR_BLOCK_REGEX,
  ONMYOJI_EDITOR_LANGUAGE,
  buildOnmyojiEditorBlockFence,
  buildOnmyojiEditorFileFence,
  parseOnmyojiEditorFenceInfo
} from '~/utils/onmyoji-editor-syntax'

definePageMeta({
  path: '/:locale(zh|zh-tw|ja|vi|ko|en)/editor'
})

type FlowBlock = {
  key: string
  blockIndex: number
  graphData: GraphData
  rawPayload: any
  previewHeight: number
  isAutoHeight: boolean
  error: string
}

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

type FlowBundleReference = {
  blockIndex: number
  filePath: string
  previewHeight: number | 'auto'
}

type EditorViewMode = 'visual' | 'markdown' | 'split'
const DEBUG_TOOLBAR = true
const MAX_EDITOR_READY_RETRY = 30

const DEFAULT_MARKDOWN = `# Onmyoji Wiki Editor

欢迎使用所见即所得编辑器。

- 默认会自动保存到 localStorage
- 支持导入/导出 markdown 与 json
- 支持 File System Access API 直接读写本地 markdown 文件

点击上方“插入流程块”后，可在正文中直接预览并点击“编辑流程块”进行可视化编辑。
`

const EMPTY_GRAPH_DATA: GraphData = { nodes: [], edges: [] }
const FLOW_BLOCK_REGEX = ONMYOJI_EDITOR_BLOCK_REGEX
const DEFAULT_FLOW_PREVIEW_HEIGHT = 260
const FLOW_DEBUG_MIN_CANVAS_WIDTH = 360
const FLOW_DEBUG_MIN_CANVAS_HEIGHT = 220
const FLOW_DEBUG_GRAPH_PADDING = 120
const MODAL_FIT_VERTICAL_OFFSET = 56
const MODAL_FIT_HORIZONTAL_OFFSET = 96
const MODAL_FIT_RETRY_LIMIT = 8
const MODAL_FIT_RETRY_DELAY_MS = 50

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
const editingPreviewHeight = ref(DEFAULT_FLOW_PREVIEW_HEIGHT)
const editingAutoHeight = ref(true)
const flowEditorRef = ref<any>(null)
const flowModalBodyRef = ref<HTMLElement | null>(null)
const flowEditorWidth = ref('0px')
const flowEditorHeight = ref('0px')
const flowEditorViewportWidth = ref(0)
const flowEditorViewportHeight = ref(0)
const milkdownRef = ref<MilkdownEditorHandle | null>(null)
const editorViewMode = ref<EditorViewMode>('visual')
const runtimeConfig = useRuntimeConfig()
const flowClipboardMarkdown = ref('')
const route = useRoute()

const importInput = ref<HTMLInputElement | null>(null)
let autosaveTimer: ReturnType<typeof setTimeout> | null = null
let flowResizeInterval: ReturnType<typeof setInterval> | null = null
let flowModalResizeObserver: ResizeObserver | null = null
let flowModalFitRetryTimer: ReturnType<typeof setTimeout> | null = null
let flowModalFitVerifyTimer: ReturnType<typeof setTimeout> | null = null
let hydrated = false

const isTruthyDebugQuery = (value: unknown): boolean => {
  const normalized = String(value ?? '').trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

const flowDebugEnabled = computed(() => {
  const raw = route.query.flowDebug ?? route.query.flow_debug
  const first = Array.isArray(raw) ? raw[0] : raw
  return isTruthyDebugQuery(first)
})

const editingGraphBounds = computed(() => resolveGraphBounds(normalizeGraphData(editingGraphData.value)))
const editingEstimatedCanvasWidth = computed(() => {
  const bounds = editingGraphBounds.value
  if (!bounds) {
    return FLOW_DEBUG_MIN_CANVAS_WIDTH
  }
  const boundsBasedWidth = bounds.width + FLOW_DEBUG_GRAPH_PADDING
  const originBasedWidth = bounds.maxX + FLOW_DEBUG_GRAPH_PADDING
  return Math.max(FLOW_DEBUG_MIN_CANVAS_WIDTH, Math.ceil(Math.max(boundsBasedWidth, originBasedWidth)))
})
const editingEstimatedCanvasHeight = computed(() => {
  const bounds = editingGraphBounds.value
  if (!bounds) {
    return FLOW_DEBUG_MIN_CANVAS_HEIGHT
  }
  const boundsBasedHeight = bounds.height + FLOW_DEBUG_GRAPH_PADDING
  const originBasedHeight = bounds.maxY + FLOW_DEBUG_GRAPH_PADDING
  return Math.max(FLOW_DEBUG_MIN_CANVAS_HEIGHT, Math.ceil(Math.max(boundsBasedHeight, originBasedHeight)))
})
const parsePixelDimension = (input: string): number => {
  const matched = /^\s*(\d+(?:\.\d+)?)px\s*$/i.exec(input || '')
  if (!matched) {
    return 0
  }
  const parsed = Number.parseFloat(matched[1] || '')
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}
const modalHostWidth = computed(() => {
  if (flowEditorViewportWidth.value > 0) {
    return flowEditorViewportWidth.value
  }
  return parsePixelDimension(flowEditorWidth.value)
})
const modalHostHeight = computed(() => {
  if (flowEditorViewportHeight.value > 0) {
    return flowEditorViewportHeight.value
  }
  return parsePixelDimension(flowEditorHeight.value)
})
const modalEditorRenderWidth = computed(() => {
  return parsePixelDimension(flowEditorWidth.value)
})
const modalWidthScale = computed(() => {
  const hostWidth = modalEditorRenderWidth.value > 0 ? modalEditorRenderWidth.value : modalHostWidth.value
  if (hostWidth <= 0) {
    return 1
  }
  if (editingEstimatedCanvasWidth.value <= hostWidth) {
    return 1
  }
  return hostWidth / editingEstimatedCanvasWidth.value
})
const modalScaledHeight = computed(() => Math.ceil(editingEstimatedCanvasHeight.value * modalWidthScale.value))
const editingBlockSnapshot = computed(() => {
  if (editingBlockIndex.value === null) {
    return null
  }
  return flowBlocks.value.find((block) => block.blockIndex === editingBlockIndex.value) || null
})

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

const clearFlowModalFitRetryTimer = () => {
  if (flowModalFitRetryTimer) {
    clearTimeout(flowModalFitRetryTimer)
    flowModalFitRetryTimer = null
  }
}

const clearFlowModalFitVerifyTimer = () => {
  if (flowModalFitVerifyTimer) {
    clearTimeout(flowModalFitVerifyTimer)
    flowModalFitVerifyTimer = null
  }
}

const scheduleFlowModalFitRetry = (attempt: number) => {
  if (attempt >= MODAL_FIT_RETRY_LIMIT) {
    clearFlowModalFitRetryTimer()
    return
  }
  clearFlowModalFitRetryTimer()
  flowModalFitRetryTimer = setTimeout(() => {
    applyFlowModalFitView(attempt + 1)
  }, MODAL_FIT_RETRY_DELAY_MS)
}

const applyFlowModalFitView = (attempt = 0) => {
  if (typeof window === 'undefined' || !flowEditorVisible.value || !editingAutoHeight.value) {
    clearFlowModalFitRetryTimer()
    return
  }

  const preview = flowEditorRef.value as any
  const resizeCanvasAvailable = !!(preview && typeof preview.resizeCanvas === 'function')
  const fitViewAvailable = !!(preview && typeof preview.fitView === 'function')
  const resetZoomAvailable = !!(preview && typeof preview.resetZoom === 'function')
  const resetTranslateAvailable = !!(preview && typeof preview.resetTranslate === 'function')
  const translateCenterAvailable = !!(preview && typeof preview.translateCenter === 'function')
  const getTransformAvailable = !!(preview && typeof preview.getTransform === 'function')
  const getGraphDataAvailable = !!(preview && typeof preview.getGraphData === 'function')

  if (!preview || (!fitViewAvailable && !translateCenterAvailable)) {
    scheduleFlowModalFitRetry(attempt)
    return
  }

  const graphData = getGraphDataAvailable ? preview.getGraphData() : null
  const graphNodeCount = Array.isArray(graphData?.nodes) ? graphData.nodes.length : -1
  if (graphNodeCount === 0) {
    scheduleFlowModalFitRetry(attempt)
    return
  }

  window.requestAnimationFrame(() => {
    if (!flowEditorVisible.value || !editingAutoHeight.value) {
      clearFlowModalFitRetryTimer()
      return
    }

    if (resizeCanvasAvailable) {
      preview.resizeCanvas()
    }
    if (resetZoomAvailable) {
      preview.resetZoom()
    }
    if (resetTranslateAvailable) {
      preview.resetTranslate()
    }

    let fitViewApplied = false
    if (fitViewAvailable) {
      fitViewApplied = preview.fitView(MODAL_FIT_VERTICAL_OFFSET, MODAL_FIT_HORIZONTAL_OFFSET)
    }
    if (!fitViewApplied && translateCenterAvailable) {
      fitViewApplied = preview.translateCenter()
    }

    const transformSnapshot = getTransformAvailable ? preview.getTransform() : null
    if (flowDebugEnabled.value) {
      console.info('[Editor][flow-debug][modal-fit]', {
        blockIndex: editingBlockIndex.value,
        fitViewAttempt: attempt + 1,
        autoFitEnabled: editingAutoHeight.value,
        resizeCanvasAvailable,
        fitViewAvailable,
        fitViewApplied,
        resetZoomAvailable,
        resetTranslateAvailable,
        translateCenterAvailable,
        getTransformAvailable,
        transformSnapshot,
        getGraphDataAvailable,
        graphNodeCount
      })
    }

  if (!fitViewApplied) {
      scheduleFlowModalFitRetry(attempt)
      return
    }

    const appliedScale = Number(transformSnapshot?.SCALE_X ?? NaN)
    clearFlowModalFitVerifyTimer()
    flowModalFitVerifyTimer = setTimeout(() => {
      if (!flowEditorVisible.value || !editingAutoHeight.value) {
        clearFlowModalFitVerifyTimer()
        return
      }
      const currentTransform = getTransformAvailable ? preview.getTransform() : null
      const currentScale = Number(currentTransform?.SCALE_X ?? NaN)
      if (flowDebugEnabled.value) {
        console.info('[Editor][flow-debug][modal-fit-verify]', {
          blockIndex: editingBlockIndex.value,
          appliedScale,
          currentScale,
          currentTransform
        })
      }
      if (
        Number.isFinite(appliedScale)
        && Number.isFinite(currentScale)
        && currentScale > appliedScale + 0.03
      ) {
        applyFlowModalFitView(0)
      }
      clearFlowModalFitVerifyTimer()
    }, 180)

    clearFlowModalFitRetryTimer()
  })
}

const triggerFlowEditorResize = () => {
  if (typeof window === 'undefined') {
    return
  }
  const runResize = () => {
    flowEditorRef.value?.resizeCanvas?.()
    window.dispatchEvent(new Event('resize'))
    if (editingAutoHeight.value) {
      window.requestAnimationFrame(() => {
        applyFlowModalFitView(0)
      })
      setTimeout(() => {
        applyFlowModalFitView(0)
      }, 80)
    }
  }

  nextTick(() => {
    runResize()
    window.requestAnimationFrame(() => runResize())
    setTimeout(() => runResize(), 120)
    setTimeout(() => runResize(), 320)
    setTimeout(() => runResize(), 700)
  })

  if (flowResizeInterval) {
    clearInterval(flowResizeInterval)
    flowResizeInterval = null
  }

  let attempts = 0
  flowResizeInterval = setInterval(() => {
    if (!flowEditorVisible.value) {
      if (flowResizeInterval) {
        clearInterval(flowResizeInterval)
        flowResizeInterval = null
      }
      return
    }
    attempts += 1
    runResize()
    if (attempts >= 8) {
      if (flowResizeInterval) {
        clearInterval(flowResizeInterval)
        flowResizeInterval = null
      }
    }
  }, 150)
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

const showVisualPane = computed(() => editorViewMode.value === 'visual' || editorViewMode.value === 'split')
const showMarkdownPane = computed(() => editorViewMode.value === 'markdown' || editorViewMode.value === 'split')
const canUseVisualCommands = computed(() => showVisualPane.value)
const canPasteFlowBlock = computed(() => flowClipboardMarkdown.value.trim().length > 0)

const updateFlowEditorViewportSize = () => {
  const host = flowModalBodyRef.value
  if (!host) {
    flowEditorViewportWidth.value = 0
    flowEditorViewportHeight.value = 0
    flowEditorWidth.value = '0px'
    flowEditorHeight.value = '0px'
    return
  }
  const width = Math.max(0, Math.round(host.clientWidth))
  const height = Math.max(0, Math.round(host.clientHeight))
  flowEditorViewportWidth.value = width
  flowEditorViewportHeight.value = height
  flowEditorWidth.value = width > 0 ? `${width}px` : '0px'
  flowEditorHeight.value = height > 0 ? `${height}px` : '0px'
}

const setupFlowModalResizeObserver = () => {
  if (typeof ResizeObserver === 'undefined' || !flowModalBodyRef.value) {
    return
  }
  flowModalResizeObserver?.disconnect()
  flowModalResizeObserver = new ResizeObserver(() => {
    updateFlowEditorViewportSize()
    triggerFlowEditorResize()
  })
  flowModalResizeObserver.observe(flowModalBodyRef.value)
}

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

const resolveIsAutoHeight = (input: any): boolean => {
  if (!input || typeof input !== 'object') {
    return true
  }
  const rawHeight = (input as Record<string, unknown>).height
  if (typeof rawHeight === 'string') {
    const normalized = rawHeight.trim().toLowerCase()
    if (normalized === 'auto') {
      return true
    }
    const parsed = Number(normalized)
    return !(Number.isFinite(parsed) && parsed > 0)
  }
  if (typeof rawHeight === 'number') {
    return !(Number.isFinite(rawHeight) && rawHeight > 0)
  }
  return true
}

const parseFlowBlock = (raw: string): { data: GraphData; rawPayload: any; previewHeight: number; isAutoHeight: boolean; error: string } => {
  if (!raw.trim()) {
    return { data: EMPTY_GRAPH_DATA, rawPayload: null, previewHeight: DEFAULT_FLOW_PREVIEW_HEIGHT, isAutoHeight: true, error: '' }
  }

  try {
    const parsed = JSON.parse(raw)
    return {
      data: normalizeGraphData(parsed),
      rawPayload: parsed,
      previewHeight: resolvePreviewHeight(parsed),
      isAutoHeight: resolveIsAutoHeight(parsed),
      error: ''
    }
  } catch {
    return {
      data: EMPTY_GRAPH_DATA,
      rawPayload: null,
      previewHeight: DEFAULT_FLOW_PREVIEW_HEIGHT,
      isAutoHeight: true,
      error: '流程块 JSON 解析失败，打开编辑器后可重新保存覆盖。'
    }
  }
}

const isOnmyojiBlockFenceHeader = (header: string): boolean => {
  const info = parseOnmyojiEditorFenceInfo(`${ONMYOJI_EDITOR_LANGUAGE}${header || ''}`)
  return info.isOnmyojiEditor && info.type === 'block'
}

const parseFlowBlocks = (source: string): FlowBlock[] => {
  const blocks: FlowBlock[] = []
  const regex = new RegExp(FLOW_BLOCK_REGEX)
  let blockIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(source)) !== null) {
    const header = match[1] || ''
    if (!isOnmyojiBlockFenceHeader(header)) {
      continue
    }
    const raw = (match[2] || '').trim()
    const parsed = parseFlowBlock(raw)

    blocks.push({
      key: `flow-${blockIndex}`,
      blockIndex,
      graphData: parsed.data,
      rawPayload: parsed.rawPayload,
      previewHeight: parsed.previewHeight,
      isAutoHeight: parsed.isAutoHeight,
      error: parsed.error
    })

    blockIndex += 1
  }

  return blocks
}

const flowBlocks = computed(() => parseFlowBlocks(markdown.value))
const flowRuleWarnings = computed(() => (
  flowBlocks.value.flatMap((block) => (
    validateGraphGroupRules(block.graphData).map((warning) => ({
      ...warning,
      blockIndex: block.blockIndex
    }))
  ))
))
const flowAssetWarnings = computed(() => {
  const baseURL = runtimeConfig.app.baseURL || '/'
  return flowBlocks.value.flatMap((block) => (
    collectFlowAssetIssues(block.graphData, baseURL).map((issue) => ({
      ...issue,
      blockIndex: block.blockIndex
    }))
  ))
})

const replaceFlowBlock = (source: string, targetIndex: number, replacement: string): string => {
  const regex = new RegExp(FLOW_BLOCK_REGEX)
  let blockIndex = 0
  return source.replace(regex, (fullMatch, header: string) => {
    if (!isOnmyojiBlockFenceHeader(header || '')) {
      return fullMatch
    }
    if (blockIndex === targetIndex) {
      blockIndex += 1
      return replacement
    }
    blockIndex += 1
    return fullMatch
  })
}

const collectFlowBlockMatches = (source: string): string[] => {
  const regex = new RegExp(FLOW_BLOCK_REGEX)
  const matches: string[] = []
  let match: RegExpExecArray | null
  while ((match = regex.exec(source)) !== null) {
    const header = match[1] || ''
    if (!isOnmyojiBlockFenceHeader(header)) {
      continue
    }
    matches.push(match[0] || '')
  }
  return matches
}

const resolveFlowBlockMarkdown = (source: string, blockIndex: number): string => {
  if (blockIndex < 0) {
    return ''
  }
  const matches = collectFlowBlockMatches(source)
  return matches[blockIndex] || ''
}

const reorderFlowBlocks = (source: string, fromIndex: number, toIndex: number): string => {
  if (fromIndex === toIndex) {
    return source
  }
  const matches = collectFlowBlockMatches(source)
  if (
    fromIndex < 0
    || toIndex < 0
    || fromIndex >= matches.length
    || toIndex >= matches.length
  ) {
    return source
  }

  const reordered = [...matches]
  const [moved] = reordered.splice(fromIndex, 1)
  reordered.splice(toIndex, 0, moved)

  let replaceIndex = 0
  const regex = new RegExp(FLOW_BLOCK_REGEX)
  return source.replace(regex, (fullMatch, header: string) => {
    if (!isOnmyojiBlockFenceHeader(header || '')) {
      return fullMatch
    }
    return reordered[replaceIndex++] || ''
  })
}

const deepClone = <T>(input: T): T => {
  return JSON.parse(JSON.stringify(input)) as T
}

const toFlowDemoLikePayload = (graphData: GraphData, previewHeight: number | 'auto' = 'auto'): Record<string, unknown> => ({
  height: previewHeight,
  schemaVersion: 1,
  fileList: [
    {
      id: 'flow-1',
      label: 'File 1',
      name: 'File 1',
      visible: true,
      type: 'FLOW',
      graphRawData: graphData
    }
  ],
  activeFileId: 'flow-1',
  activeFile: 'File 1'
})

const serializeFlowPayload = (rawPayload: any, graphData: GraphData, previewHeight: number | 'auto' = 'auto'): string => {
  if (rawPayload && typeof rawPayload === 'object' && Array.isArray(rawPayload.fileList) && rawPayload.fileList.length > 0) {
    const nextPayload = deepClone(rawPayload) as Record<string, any>
    nextPayload.height = previewHeight
    const fileList = Array.isArray(nextPayload.fileList) ? nextPayload.fileList : []
    const activeFileId = typeof nextPayload.activeFileId === 'string' ? nextPayload.activeFileId : ''
    const activeIndex = fileList.findIndex((item: any) => item?.id === activeFileId)
    const targetIndex = activeIndex >= 0 ? activeIndex : 0
    const targetFile = fileList[targetIndex] || {}
    fileList[targetIndex] = {
      ...targetFile,
      graphRawData: graphData
    }
    nextPayload.fileList = fileList
    return JSON.stringify(nextPayload, null, 2)
  }

  const normalizedPayload = toFlowDemoLikePayload(graphData, previewHeight)
  return JSON.stringify(normalizedPayload, null, 2)
}

const wrapFlowPayloadCodeBlock = (payload: string): string => (
  buildOnmyojiEditorBlockFence(payload)
)

const buildFlowPreviewReferenceBlock = (filePath: string, previewHeight: number | 'auto'): string => (
  buildOnmyojiEditorFileFence(`./${filePath}`, previewHeight)
)

const toBundleReferenceMarkdown = (source: string, references: FlowBundleReference[]): string => {
  if (references.length === 0) {
    return source
  }

  const referenceMap = new Map<number, FlowBundleReference>()
  references.forEach((item) => referenceMap.set(item.blockIndex, item))

  let blockIndex = 0
  const regex = new RegExp(FLOW_BLOCK_REGEX)
  return source.replace(regex, (fullMatch, header: string) => {
    if (!isOnmyojiBlockFenceHeader(header || '')) {
      return fullMatch
    }
    const reference = referenceMap.get(blockIndex)
    blockIndex += 1
    if (!reference) {
      return fullMatch
    }
    return buildFlowPreviewReferenceBlock(reference.filePath, reference.previewHeight)
  })
}

const normalizeBundleSrcPath = (src: string): string => {
  return src
    .split(/[?#]/, 1)[0]
    .replace(/\\/g, '/')
    .trim()
}

const resolveZipFlowEntryPath = (src: string, zip: JSZip): string | null => {
  const normalized = normalizeBundleSrcPath(src)
  if (!normalized) {
    return null
  }

  const stripped = normalized
    .replace(/^(\.\/)+/, '')
    .replace(/^\/+/, '')
  const fileName = stripped.split('/').filter(Boolean).pop() || ''
  const candidates = Array.from(new Set([
    stripped,
    stripped.replace(/^data\//, ''),
    stripped.replace(/^onmyoji-wiki\//, ''),
    fileName ? `flows/${fileName}` : ''
  ].filter(Boolean)))

  for (const candidate of candidates) {
    if (zip.file(candidate)) {
      return candidate
    }
  }
  return null
}

const restoreInlineFlowBlocksFromReferenceMarkdown = async (source: string, zip: JSZip): Promise<string> => {
  const regex = new RegExp(FLOW_BLOCK_REGEX)
  let result = ''
  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(source)) !== null) {
    const fullMatch = match[0] || ''
    const header = match[1] || ''
    const info = parseOnmyojiEditorFenceInfo(`${ONMYOJI_EDITOR_LANGUAGE}${header}`)
    let replacement = fullMatch

    if (info.isOnmyojiEditor && info.type === 'file' && info.src) {
      const entryPath = resolveZipFlowEntryPath(info.src, zip)
      const entry = entryPath ? zip.file(entryPath) : null
      if (entry) {
        try {
          const rawJson = await entry.async('string')
          const payload = JSON.parse(rawJson) as Record<string, unknown>
          if (payload && typeof payload === 'object' && !('height' in payload)) {
            if (info.height === 'auto') {
              payload.height = 'auto'
            } else {
              const parsedHeight = typeof info.height === 'number' ? info.height : NaN
              if (Number.isFinite(parsedHeight) && parsedHeight > 0) {
                payload.height = parsedHeight
              }
            }
          }
          replacement = buildOnmyojiEditorBlockFence(JSON.stringify(payload, null, 2))
        } catch {
          replacement = fullMatch
        }
      }
    }

    result += source.slice(cursor, match.index) + replacement
    cursor = match.index + fullMatch.length
  }

  if (cursor === 0) {
    return source
  }
  result += source.slice(cursor)
  return result
}

const normalizeMarkdownText = (value: string): string => value.replace(/\r\n/g, '\n')

const appendFlowBlockToDocEnd = (blockMarkdown: string): boolean => {
  const normalizedBlock = blockMarkdown.trim()
  if (!normalizedBlock) {
    return false
  }
  const source = markdown.value.trimEnd()
  markdown.value = source.length > 0
    ? `${source}\n\n${normalizedBlock}\n`
    : `${normalizedBlock}\n`
  return true
}

const writeTextToClipboard = async (text: string): Promise<boolean> => {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    return false
  }
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

const clearMessages = () => {
  operationMessage.value = ''
  operationError.value = ''
}

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

const setEditorViewMode = (mode: EditorViewMode) => {
  clearMessages()
  editorViewMode.value = mode
}

const preventToolbarMouseDown = (event: MouseEvent) => {
  event.preventDefault()
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

const runEditorAction = (action: (editor: MilkdownEditorHandle) => void, retryCount = 0) => {
  if (DEBUG_TOOLBAR) {
    console.info('[editor toolbar] click', {
      mode: editorViewMode.value,
      retryCount,
      activeElement: resolveActiveElementInfo()
    })
  }
  clearMessages()
  if (!canUseVisualCommands.value) {
    if (DEBUG_TOOLBAR) {
      console.warn('[editor toolbar] blocked by mode', { mode: editorViewMode.value })
    }
    operationError.value = '请先切换到“可视编辑”或“双栏”模式再使用格式工具。'
    return
  }
  const editor = ensureEditor()
  if (!editor) {
    if (DEBUG_TOOLBAR) {
      console.warn('[editor toolbar] no editor instance')
    }
    return
  }
  if (!editor.isReady()) {
    if (DEBUG_TOOLBAR) {
      console.warn('[editor toolbar] editor not ready', { retryCount })
    }
    if (retryCount < MAX_EDITOR_READY_RETRY && typeof window !== 'undefined') {
      window.setTimeout(() => runEditorAction(action, retryCount + 1), 120)
      return
    }
    operationError.value = '编辑器正在初始化，请稍后再试。'
    return
  }
  if (DEBUG_TOOLBAR) {
    console.info('[editor toolbar] execute action', {
      mode: editorViewMode.value,
      activeElement: resolveActiveElementInfo()
    })
  }
  editor.focus()
  action(editor)
}

const insertFlowBlock = () => {
  runEditorAction((editor) => {
    editor.insertFlowBlock()
    operationMessage.value = '已插入流程块，可在正文中直接预览并点击“编辑流程块”进入可视化编辑。'
  })
}

const pasteFlowBlock = () => {
  runEditorAction((editor) => {
    const blockMarkdown = flowClipboardMarkdown.value.trim()
    if (!blockMarkdown) {
      operationError.value = '当前会话暂无可粘贴的流程块，请先剪切一个流程块。'
      return
    }

    const before = normalizeMarkdownText(editor.getMarkdown())
    editor.insertText(`\n${blockMarkdown}\n`)
    const after = normalizeMarkdownText(editor.getMarkdown())
    if (before !== after) {
      operationMessage.value = '已在当前光标位置粘贴流程块。'
      return
    }

    if (appendFlowBlockToDocEnd(blockMarkdown)) {
      operationMessage.value = '未检测到有效光标，已将流程块追加到文档末尾。'
      return
    }
    operationError.value = '粘贴失败：流程块内容为空。'
  })
}

const resetToDefaultTemplate = () => {
  clearMessages()
  markdown.value = DEFAULT_MARKDOWN
  if (typeof window !== 'undefined') {
    localStorage.removeItem(LOCAL_STORAGE_KEY)
    localStorage.removeItem(LOCAL_STORAGE_BACKUP_KEY)
  }
  autosaveLabel.value = '已重置，等待自动保存'
  operationMessage.value = '已重置为默认模板，并清除 localStorage 草稿。'
}

const openFlowBlockEditor = (block: FlowBlock) => {
  clearMessages()
  editingBlockIndex.value = block.blockIndex
  editingGraphData.value = JSON.parse(JSON.stringify(block.graphData))
  editingPreviewHeight.value = block.previewHeight
  editingAutoHeight.value = true
  if (block.error) {
    operationMessage.value = `${block.error} 打开后可重新编辑并保存。`
  }
  flowEditorVisible.value = true
}

const handleInlineFlowBlockEdit = (payload: InlineFlowBlockPayload) => {
  const currentBlock = flowBlocks.value.find((item) => item.blockIndex === payload.blockIndex)
  openFlowBlockEditor({
    key: `flow-${payload.blockIndex}`,
    blockIndex: payload.blockIndex,
    graphData: normalizeGraphData(payload.graphData),
    rawPayload: currentBlock?.rawPayload || null,
    previewHeight: currentBlock?.previewHeight || payload.previewHeight,
    isAutoHeight: currentBlock?.isAutoHeight ?? true,
    error: payload.error || currentBlock?.error || ''
  })
}

const removeFlowBlock = (blockIndex: number, options?: { message?: string }) => {
  markdown.value = replaceFlowBlock(markdown.value, blockIndex, '').replace(/\n{3,}/g, '\n\n')
  if (editingBlockIndex.value !== null) {
    if (editingBlockIndex.value === blockIndex) {
      flowEditorVisible.value = false
      editingBlockIndex.value = null
    } else if (editingBlockIndex.value > blockIndex) {
      editingBlockIndex.value -= 1
    }
  }
  operationMessage.value = options?.message || `流程块 #${blockIndex + 1} 已删除。`
}

const handleInlineFlowBlockDelete = (payload: InlineFlowBlockDeletePayload) => {
  clearMessages()
  removeFlowBlock(payload.blockIndex)
}

const cutFlowBlock = async (blockIndex: number) => {
  clearMessages()
  const targetMarkdown = resolveFlowBlockMarkdown(markdown.value, blockIndex)
  if (!targetMarkdown) {
    operationError.value = `剪切失败：未找到流程块 #${blockIndex + 1}。`
    return
  }

  flowClipboardMarkdown.value = targetMarkdown
  const copied = await writeTextToClipboard(targetMarkdown)
  removeFlowBlock(blockIndex, {
    message: copied
      ? `流程块 #${blockIndex + 1} 已剪切，可在任意位置粘贴（已同步系统剪贴板）。`
      : `流程块 #${blockIndex + 1} 已剪切，可在当前会话中粘贴。`
  })
}

const handleInlineFlowBlockCut = async (payload: InlineFlowBlockCutPayload) => {
  await cutFlowBlock(payload.blockIndex)
}

const moveFlowBlock = (blockIndex: number, direction: 'up' | 'down') => {
  const targetIndex = direction === 'up' ? blockIndex - 1 : blockIndex + 1
  const total = flowBlocks.value.length
  if (targetIndex < 0 || targetIndex >= total) {
    return
  }

  markdown.value = reorderFlowBlocks(markdown.value, blockIndex, targetIndex)
  if (editingBlockIndex.value === blockIndex) {
    editingBlockIndex.value = targetIndex
  } else if (editingBlockIndex.value === targetIndex) {
    editingBlockIndex.value = blockIndex
  }
  operationMessage.value = `流程块 #${blockIndex + 1} 已${direction === 'up' ? '上移' : '下移'}。`
}

const handleInlineFlowBlockMove = (payload: InlineFlowBlockMovePayload) => {
  clearMessages()
  moveFlowBlock(payload.blockIndex, payload.direction)
}

const closeFlowBlockEditor = () => {
  flowEditorVisible.value = false
  editingBlockIndex.value = null
  editingPreviewHeight.value = DEFAULT_FLOW_PREVIEW_HEIGHT
  editingAutoHeight.value = true
  flowEditorViewportWidth.value = 0
  flowEditorViewportHeight.value = 0
  flowEditorWidth.value = '0px'
  flowEditorHeight.value = '0px'
}

const waitForEditorFlush = async () => {
  if (typeof window === 'undefined') {
    return
  }
  await nextTick()
  await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
  await new Promise<void>((resolve) => window.setTimeout(() => resolve(), 40))
}

const applyFlowBlockChanges = async () => {
  if (editingBlockIndex.value === null) {
    return
  }

  const activeElement = document.activeElement as HTMLElement | null
  if (activeElement && typeof activeElement.blur === 'function') {
    activeElement.blur()
  }
  await waitForEditorFlush()

  const graphData = flowEditorRef.value?.getGraphData?.()
  const normalizedGraphData = normalizeGraphData(graphData)
  editingAutoHeight.value = true
  const currentBlock = flowBlocks.value.find((item) => item.blockIndex === editingBlockIndex.value) || null
  const flowPayload = serializeFlowPayload(currentBlock?.rawPayload, normalizedGraphData, 'auto')
  const serialized = wrapFlowPayloadCodeBlock(flowPayload)
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

const parseImportedContent = async (file: File): Promise<string> => {
  const lowerName = file.name.toLowerCase()
  if (lowerName.endsWith('.zip')) {
    const zip = await JSZip.loadAsync(await file.arrayBuffer())
    const primaryEntry = zip.file('wiki-editor.md')
    const fallbackEntry = zip.file(/\.md$/i)[0]
    const targetEntry = primaryEntry || fallbackEntry
    if (!targetEntry) {
      throw new Error('zip 中未找到可导入的 markdown 文件。')
    }
    const importedMarkdown = await targetEntry.async('string')
    return restoreInlineFlowBlocksFromReferenceMarkdown(importedMarkdown, zip)
  }

  const text = await file.text()
  if (lowerName.endsWith('.json')) {
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
    markdown.value = await parseImportedContent(file)
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

const exportBundleZip = async () => {
  await withErrorHandling(async () => {
    const zip = new JSZip()
    const exportedAt = new Date().toISOString()
    const blockManifest: Array<Record<string, unknown>> = []
    const flowReferences: FlowBundleReference[] = []

    flowBlocks.value.forEach((block) => {
      const blockHeight: number | 'auto' = block.isAutoHeight ? 'auto' : block.previewHeight
      const payload = block.rawPayload && typeof block.rawPayload === 'object'
        ? deepClone(block.rawPayload)
        : toFlowDemoLikePayload(block.graphData, blockHeight)
      if (!('height' in payload)) {
        payload.height = blockHeight
      }
      const fileName = `flows/flow-${block.blockIndex + 1}.json`
      zip.file(fileName, JSON.stringify(payload, null, 2))
      flowReferences.push({
        blockIndex: block.blockIndex,
        filePath: fileName,
        previewHeight: blockHeight
      })
      blockManifest.push({
        blockIndex: block.blockIndex,
        height: blockHeight,
        file: fileName,
        hasParseError: !!block.error
      })
    })

    zip.file('wiki-editor.md', toBundleReferenceMarkdown(markdown.value, flowReferences))
    zip.file('manifest.json', JSON.stringify({
      version: 1,
      exportedAt,
      flowBlockCount: flowBlocks.value.length,
      files: blockManifest
    }, null, 2))

    const blob = await zip.generateAsync({ type: 'blob' })
    downloadBlob(blob, `wiki-editor-bundle-${Date.now()}.zip`)
    operationMessage.value = '已导出协作包（zip）。'
  })
}

onMounted(async () => {
  isFsSupported.value = fileSystemAdapter.isSupported()
  capabilityMessage.value = isFsSupported.value
    ? '检测到 File System Access API，可使用目录模式打开并保存 markdown 文件。'
    : '当前浏览器不支持 File System Access API，已回退到 localStorage 模式。'

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
    clearFlowModalFitRetryTimer()
    clearFlowModalFitVerifyTimer()
    lockBodyScroll()
    nextTick(() => {
      updateFlowEditorViewportSize()
      setupFlowModalResizeObserver()
      triggerFlowEditorResize()
    })
    triggerFlowEditorResize()
    return
  }
  flowModalResizeObserver?.disconnect()
  flowModalResizeObserver = null
  if (flowResizeInterval) {
    clearInterval(flowResizeInterval)
    flowResizeInterval = null
  }
  clearFlowModalFitRetryTimer()
  clearFlowModalFitVerifyTimer()
  unlockBodyScroll()
})

watch(
  [flowEditorVisible, editingAutoHeight, flowEditorWidth, flowEditorHeight],
  ([visible, autoHeight]) => {
    if (!visible || !autoHeight) {
      clearFlowModalFitRetryTimer()
      clearFlowModalFitVerifyTimer()
      return
    }
    nextTick(() => {
      applyFlowModalFitView(0)
    })
  }
)

watch(
  () => editingGraphData.value,
  () => {
    if (!flowEditorVisible.value || !editingAutoHeight.value) {
      return
    }
    nextTick(() => {
      applyFlowModalFitView(0)
    })
  },
  { deep: true }
)

watch(editorViewMode, async (mode) => {
  if (mode !== 'visual' && mode !== 'split') {
    return
  }
  await nextTick()
  if (!milkdownRef.value?.isReady()) {
    return
  }
  milkdownRef.value.focus()
})

watch(
  [
    flowDebugEnabled,
    flowEditorVisible,
    editingBlockIndex,
    editingPreviewHeight,
    editingAutoHeight,
    flowEditorWidth,
    flowEditorHeight,
    editingEstimatedCanvasWidth,
    editingEstimatedCanvasHeight,
    modalWidthScale,
    modalScaledHeight
  ],
  () => {
    if (!import.meta.client || !flowDebugEnabled.value || !flowEditorVisible.value) {
      return
    }
    if (modalHostWidth.value <= 0 || modalHostHeight.value <= 0) {
      return
    }

    const modalPreview = flowEditorRef.value as any
    const getGraphDataAvailable = !!(modalPreview && typeof modalPreview.getGraphData === 'function')
    const graphData = getGraphDataAvailable ? modalPreview.getGraphData() : null

    console.info('[Editor][flow-debug][modal]', {
      blockIndex: editingBlockIndex.value,
      sourceHeight: editingBlockSnapshot.value?.isAutoHeight ? 'auto' : editingBlockSnapshot.value?.previewHeight,
      editingHeightInput: editingAutoHeight.value ? 'auto' : editingPreviewHeight.value,
      hostWidth: modalHostWidth.value,
      hostHeight: modalHostHeight.value,
      editorRenderWidth: modalEditorRenderWidth.value,
      estimatedCanvasWidth: editingEstimatedCanvasWidth.value,
      estimatedCanvasHeight: editingEstimatedCanvasHeight.value,
      widthScale: Number(modalWidthScale.value.toFixed(4)),
      scaledHeight: modalScaledHeight.value,
      graphBounds: editingGraphBounds.value,
      autoFitEnabled: editingAutoHeight.value,
      resizeCanvasAvailable: !!(modalPreview && typeof modalPreview.resizeCanvas === 'function'),
      fitViewAvailable: !!(modalPreview && typeof modalPreview.fitView === 'function'),
      resetZoomAvailable: !!(modalPreview && typeof modalPreview.resetZoom === 'function'),
      resetTranslateAvailable: !!(modalPreview && typeof modalPreview.resetTranslate === 'function'),
      translateCenterAvailable: !!(modalPreview && typeof modalPreview.translateCenter === 'function'),
      getTransformAvailable: !!(modalPreview && typeof modalPreview.getTransform === 'function'),
      transformSnapshot: !!(modalPreview && typeof modalPreview.getTransform === 'function')
        ? modalPreview.getTransform()
        : null,
      getGraphDataAvailable,
      graphNodeCount: Array.isArray(graphData?.nodes) ? graphData.nodes.length : -1
    })
  },
  { immediate: true }
)

watch(flowDebugEnabled, (enabled) => {
  if (!import.meta.client || !enabled) {
    return
  }
  console.info('[Editor][flow-debug] enabled. Open a flow block editor modal to inspect layout metrics.')
}, { immediate: true })

onBeforeUnmount(() => {
  unlockBodyScroll()
  flowModalResizeObserver?.disconnect()
  flowModalResizeObserver = null
  clearFlowModalFitRetryTimer()
  clearFlowModalFitVerifyTimer()
  if (flowResizeInterval) {
    clearInterval(flowResizeInterval)
    flowResizeInterval = null
  }
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
          <button type="button" @click="exportBundleZip">导出协作包(zip)</button>
          <button type="button" @click="resetToDefaultTemplate">重置默认模板</button>
        </div>
        <div class="right">
          <span class="mode">当前模式：{{ activeMode }}</span>
          <span class="autosave">{{ autosaveLabel }}</span>
        </div>
      </div>

      <div class="editor-tools" @mousedown="preventToolbarMouseDown">
        <button type="button" :disabled="!canUseVisualCommands" @click="runEditorAction((editor) => editor.toggleBold())"><strong>B</strong></button>
        <button type="button" :disabled="!canUseVisualCommands" @click="runEditorAction((editor) => editor.toggleItalic())"><em>I</em></button>
        <button type="button" :disabled="!canUseVisualCommands" @click="runEditorAction((editor) => editor.setHeading(2))">H2</button>
        <button type="button" :disabled="!canUseVisualCommands" @click="runEditorAction((editor) => editor.setHeading(3))">H3</button>
        <button type="button" :disabled="!canUseVisualCommands" @click="runEditorAction((editor) => editor.setBulletList())">无序列表</button>
        <button type="button" :disabled="!canUseVisualCommands" @click="runEditorAction((editor) => editor.setOrderedList())">有序列表</button>
        <button type="button" :disabled="!canUseVisualCommands" @click="runEditorAction((editor) => editor.setCodeBlock())">代码块</button>
        <button type="button" :disabled="!canUseVisualCommands" @click="runEditorAction((editor) => editor.undo())">撤销</button>
        <button type="button" :disabled="!canUseVisualCommands" @click="runEditorAction((editor) => editor.redo())">重做</button>
        <button type="button" class="primary" :disabled="!canUseVisualCommands" @click="insertFlowBlock">插入流程块</button>
        <button type="button" class="primary" :disabled="!canUseVisualCommands || !canPasteFlowBlock" @click="pasteFlowBlock">粘贴流程块</button>
      </div>

      <div class="view-switch">
        <span>视图模式</span>
        <button type="button" :class="{ active: editorViewMode === 'visual' }" @click="setEditorViewMode('visual')">可视编辑</button>
        <button type="button" :class="{ active: editorViewMode === 'markdown' }" @click="setEditorViewMode('markdown')">Markdown</button>
        <button type="button" :class="{ active: editorViewMode === 'split' }" @click="setEditorViewMode('split')">双栏</button>
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
          placeholder="输入或选择 markdown 文件名，例如 test.md"
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

      <div class="workspace" :class="`mode-${editorViewMode}`">
        <section v-if="showMarkdownPane" class="workspace-pane">
          <h2>Markdown 源码</h2>
          <textarea v-model="markdown" class="markdown-source" spellcheck="false" />
        </section>

        <section v-if="showVisualPane" class="workspace-pane">
          <h2>所见即所得编辑</h2>
          <MilkdownEditor
            ref="milkdownRef"
            v-model="markdown"
            @open-flow-block="handleInlineFlowBlockEdit"
            @delete-flow-block="handleInlineFlowBlockDelete"
            @cut-flow-block="handleInlineFlowBlockCut"
            @move-flow-block="handleInlineFlowBlockMove"
          />
        </section>
      </div>

      <section class="flow-manager">
        <header class="flow-manager-header">
          <h2>流程块管理</h2>
          <span class="flow-count">{{ flowBlocks.length }} 个</span>
        </header>
        <p class="flow-manager-tip">流程块已支持在正文内直接渲染与编辑，下方列表用于快速定位和兜底管理。</p>
        <div v-if="flowRuleWarnings.length" class="flow-rule-warnings">
          <strong>规则检查提示（按分组）</strong>
          <ul>
            <li v-for="(warning, index) in flowRuleWarnings" :key="`${warning.blockIndex}-${warning.groupId}-${warning.code}-${index}`">
              块 #{{ warning.blockIndex + 1 }} [{{ warning.groupId }}] {{ warning.message }}
            </li>
          </ul>
        </div>
        <div v-if="flowAssetWarnings.length" class="flow-rule-warnings">
          <strong>资产兼容提示</strong>
          <ul>
            <li v-for="(warning, index) in flowAssetWarnings" :key="`${warning.blockIndex}-${warning.code}-${index}`">
              块 #{{ warning.blockIndex + 1 }} {{ warning.message }}
            </li>
          </ul>
        </div>

        <div v-if="flowBlocks.length === 0" class="flow-empty">
          暂无流程块，点击上方“插入流程块”即可创建。
        </div>

        <div v-else class="flow-list">
          <article v-for="block in flowBlocks" :key="block.key" class="flow-row">
	            <div class="flow-row-main">
	              <strong>流程块 #{{ block.blockIndex + 1 }}</strong>
	              <p class="flow-meta">预览高度: auto</p>
	              <p v-if="block.error" class="flow-error">{{ block.error }}</p>
	            </div>
            <div class="flow-row-actions">
              <button type="button" :disabled="block.blockIndex === 0" @click="moveFlowBlock(block.blockIndex, 'up')">上移</button>
              <button type="button" :disabled="block.blockIndex === flowBlocks.length - 1" @click="moveFlowBlock(block.blockIndex, 'down')">下移</button>
              <button type="button" @click="cutFlowBlock(block.blockIndex)">剪切</button>
              <button type="button" @click="openFlowBlockEditor(block)">编辑</button>
              <button type="button" class="danger" @click="removeFlowBlock(block.blockIndex)">删除</button>
            </div>
          </article>
        </div>
      </section>

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
        <div ref="flowModalBodyRef" class="flow-modal-body">
          <div class="flow-modal-editor-host">
            <ClientOnly>
              <YysEditorPreview
                v-if="modalHostWidth > 0 && modalHostHeight > 0"
                ref="flowEditorRef"
                class="flow-modal-editor"
                mode="edit"
                capability="interactive"
                :data="editingGraphData"
                :height="flowEditorHeight"
                :width="flowEditorWidth"
              />
              <div v-else class="flow-modal-editor-loading">正在计算画布尺寸...</div>
            </ClientOnly>
          </div>
        </div>
      </section>
    </div>

    <input
      ref="importInput"
      type="file"
      accept=".md,.markdown,.json,.zip,text/markdown,application/json,application/zip"
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
  color: #1f2937;
  --color-foreground: #1f2937;
  --color-muted: #6b7280;
  --color-border: #d1d5db;
  --color-surface: #ffffff;
  --color-surface-soft: #f3f4f6;
}

.panel {
  max-width: 1280px;
  margin: 0 auto;
  background: #fff;
  border: 1px solid #d8dde8;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 18px 30px rgba(15, 23, 42, 0.08);
  color: #1f2937;
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
  background: #f3f4f6;
  border-color: #cfd8e6;
}

.view-switch {
  margin-top: 12px;
  padding: 10px 12px;
  border: 1px solid #d8dde8;
  border-radius: 8px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  background: #f8fafc;
}

.view-switch span {
  font-size: 13px;
  color: #334155;
  margin-right: 2px;
}

.view-switch button.active {
  background: #0f766e;
  border-color: #0f766e;
  color: #fff;
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

.editor-tools button {
  min-width: 42px;
  height: 34px;
  padding: 6px 10px;
  border-color: #c9d3e0;
  background: #ffffff;
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
  grid-template-columns: minmax(0, 1fr);
  gap: 14px;
}

.workspace.mode-split {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.workspace-pane {
  min-width: 0;
}

.workspace-pane h2 {
  margin: 0 0 10px;
  font-size: 16px;
}

.markdown-source {
  width: 100%;
  min-height: 520px;
  border: 1px solid #d7dce8;
  border-radius: 10px;
  padding: 12px;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  line-height: 1.5;
  resize: vertical;
}

.flow-manager {
  margin-top: 14px;
  border: 1px solid #d8dde8;
  border-radius: 10px;
  padding: 12px;
  background: #fbfdff;
}

.flow-manager-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.flow-manager-header h2 {
  margin: 0;
  font-size: 16px;
}

.flow-count {
  font-size: 12px;
  color: #64748b;
}

.flow-manager-tip {
  margin: 8px 0 0;
  color: #475569;
  font-size: 13px;
}

.flow-rule-warnings {
  margin-top: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid #fed7aa;
  background: #fff7ed;
  color: #9a3412;
  font-size: 13px;
}

.flow-rule-warnings ul {
  margin: 6px 0 0;
  padding-left: 18px;
}

.flow-empty {
  margin-top: 10px;
  padding: 10px;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  color: #64748b;
}

.flow-list {
  margin-top: 10px;
  display: grid;
  gap: 8px;
}

.flow-row {
  border: 1px solid #d7deed;
  border-radius: 8px;
  background: #fff;
  padding: 8px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.flow-row-main {
  min-width: 0;
}

.flow-meta {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 12px;
}

.flow-row-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

button.danger {
  border-color: #b42318;
  color: #b42318;
}

button.danger:hover {
  background: #fef2f2;
}

.flow-error {
  margin: 4px 0 0;
  color: #b42318;
  font-size: 13px;
}

.flow-modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.52);
  display: grid;
  place-items: center;
  padding: 8px;
  z-index: 2000;
}

.flow-modal {
  width: calc(100vw - 16px);
  height: calc(100vh - 16px);
  max-width: none;
  max-height: none;
  background: #fff;
  border-radius: 10px;
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
  min-width: 0;
  min-height: 0;
  display: flex;
  overflow: hidden;
}

.flow-modal-editor-host {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  overflow: hidden;
}

.flow-modal-editor {
  flex: 1;
  min-width: 0;
  min-height: 0;
  width: 100%;
  height: 100%;
  display: block;
}

.flow-modal-editor-loading {
  flex: 1;
  display: grid;
  place-items: center;
  color: #64748b;
  font-size: 13px;
  background: #f8fafc;
}

.flow-modal-header h3 {
  margin: 0;
}

.flow-modal-actions {
  display: flex;
  align-items: center;
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
    padding: 4px;
  }

  .flow-modal {
    width: calc(100vw - 8px);
    height: calc(100vh - 8px);
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



