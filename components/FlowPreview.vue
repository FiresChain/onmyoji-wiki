<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { joinURL } from 'ufo'
import { YysEditorPreview } from '@rookie4show/onmyoji-flow'
import '@rookie4show/onmyoji-flow/style.css'
import { normalizeGraphData, normalizeGraphForPreview, resolveGraphBounds, type GraphData } from '~/utils/flow-preview'
import { collectFlowAssetIssues, rewriteFlowAssetUrls, type AssetRenderPolicy } from '~/utils/flow-assets'

type FlowCapabilityLevel = 'render-only' | 'interactive'
type FlowPreviewType = 'file' | 'block'
type FlowEmbedLocale = 'zh' | 'ja' | 'en'

const props = withDefaults(defineProps<{
  type?: FlowPreviewType
  data?: Record<string, any> | null
  src?: string
  height?: number | string
  autoScale?: boolean
  debugLayout?: boolean
  showMiniMap?: boolean
  capability?: FlowCapabilityLevel
  assetPolicy?: AssetRenderPolicy
}>(), {
  type: 'file',
  data: () => ({ nodes: [], edges: [] }),
  src: '',
  height: 'auto',
  autoScale: true,
  debugLayout: false,
  showMiniMap: false,
  assetPolicy: 'degrade'
})

const MIN_CANVAS_WIDTH = 360
const MIN_CANVAS_HEIGHT = 220
const GRAPH_PADDING = 120
const GRAPH_SAFE_PADDING = 48
const FITVIEW_VERTICAL_OFFSET = 56
const FITVIEW_HORIZONTAL_OFFSET = 96
const FITVIEW_RETRY_LIMIT = 6
const FITVIEW_RETRY_DELAY_MS = 30

const flowData = ref<GraphData>({ nodes: [], edges: [] })
const loading = ref(false)
const errorMessage = ref('')
const assetIssueMessage = ref('')
const canvasViewportRef = ref<HTMLElement | null>(null)
const viewportWidth = ref(0)
const runtimeConfig = useRuntimeConfig()
let viewportResizeObserver: ResizeObserver | null = null
let previewFitVerifyTimer: ReturnType<typeof setTimeout> | null = null
const route = useRoute()

const resolveFlowEmbedLocale = (value: unknown): FlowEmbedLocale => {
  if (typeof value !== 'string') {
    return 'zh'
  }
  const normalized = value.trim().toLowerCase().split('-')[0]
  if (normalized === 'ja') {
    return 'ja'
  }
  if (normalized === 'en') {
    return 'en'
  }
  return 'zh'
}

const baseURL = computed(() => runtimeConfig.app.baseURL || '/')
const resolvedCapability = computed<FlowCapabilityLevel>(() => {
  return props.capability || 'render-only'
})
const resolvedType = computed<FlowPreviewType>(() => {
  if (props.type === 'block') {
    return 'block'
  }
  return 'file'
})
const flowEmbedLocale = computed<FlowEmbedLocale>(() => resolveFlowEmbedLocale(route.params.locale))
const flowEmbedConfig = computed(() => ({ locale: flowEmbedLocale.value }))

const resolveSrcUrl = (src: string) => {
  if (!src) {
    return ''
  }
  if (/^https?:\/\//i.test(src) || src.startsWith('//')) {
    return src
  }
  if (src.startsWith('/')) {
    return joinURL(baseURL.value, src.slice(1))
  }
  return src
}

const applyData = (data: any) => {
  errorMessage.value = ''
  const normalized = normalizeGraphData(data)
  const issues = collectFlowAssetIssues(normalized, baseURL.value)
  if (issues.length > 0) {
    assetIssueMessage.value = issues[0]?.message || '检测到资产路径兼容问题。'
    if (props.assetPolicy === 'strict') {
      errorMessage.value = assetIssueMessage.value
      flowData.value = { nodes: [], edges: [] }
      return
    }
  } else {
    assetIssueMessage.value = ''
  }

  flowData.value = rewriteFlowAssetUrls(normalizeGraphForPreview(normalized), baseURL.value, props.assetPolicy)
  nextTick(() => {
    updateViewportWidth()
  })
}

const loadFromSrc = async (src: string) => {
  if (import.meta.server) {
    return
  }
  if (!src) {
    errorMessage.value = ''
    applyData(props.data)
    return
  }

  loading.value = true
  errorMessage.value = ''
  try {
    const response = await fetch(resolveSrcUrl(src))
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    const payload = await response.json()
    applyData(payload)
  } catch (error) {
    console.error('Failed to load flow data:', error)
    errorMessage.value = '流程图加载失败，请检查数据地址或格式。'
    applyData(props.data)
  } finally {
    loading.value = false
  }
}

if (import.meta.client) {
  watch([() => props.type, () => props.src], () => {
    if (resolvedType.value === 'block') {
      loading.value = false
      errorMessage.value = ''
      applyData(props.data)
      return
    }
    void loadFromSrc(props.src)
  }, { immediate: true })
}

watch(() => props.data, (newData) => {
  if (resolvedType.value === 'block' || !props.src) {
    applyData(newData)
  }
}, { deep: true })

const normalizeHeightMode = (input: unknown): 'auto' | number => {
  if (typeof input === 'number' && Number.isFinite(input) && input > 0) {
    return input
  }
  if (typeof input === 'string') {
    const trimmed = input.trim().toLowerCase()
    if (trimmed === 'auto') {
      return 'auto'
    }
    const parsed = Number(trimmed)
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed
    }
  }
  return 'auto'
}

const resolvedHeightMode = computed(() => normalizeHeightMode(props.height))
const isAutoHeight = computed(() => resolvedHeightMode.value === 'auto')
const fallbackHeight = computed(() => (
  typeof resolvedHeightMode.value === 'number' ? resolvedHeightMode.value : 400
))

const graphBounds = computed(() => resolveGraphBounds(flowData.value))
const estimatedCanvasWidth = computed(() => {
  const bounds = graphBounds.value
  if (!bounds) {
    return MIN_CANVAS_WIDTH
  }
  const boundsBasedWidth = bounds.width + GRAPH_PADDING + GRAPH_SAFE_PADDING
  const originBasedWidth = bounds.maxX + GRAPH_PADDING + GRAPH_SAFE_PADDING
  return Math.max(MIN_CANVAS_WIDTH, Math.ceil(Math.max(boundsBasedWidth, originBasedWidth)))
})
const estimatedCanvasHeight = computed(() => {
  const bounds = graphBounds.value
  if (!bounds) {
    return MIN_CANVAS_HEIGHT
  }
  const boundsBasedHeight = bounds.height + GRAPH_PADDING + GRAPH_SAFE_PADDING
  const originBasedHeight = bounds.maxY + GRAPH_PADDING + GRAPH_SAFE_PADDING
  return Math.max(MIN_CANVAS_HEIGHT, Math.ceil(Math.max(boundsBasedHeight, originBasedHeight)))
})

const resolvedCanvasWidth = computed(() => {
  const hostWidth = Math.max(1, viewportWidth.value || MIN_CANVAS_WIDTH)
  return hostWidth
})

const resolvedCanvasHeight = computed(() => {
  const manualHeight = fallbackHeight.value
  const targetHeight = isAutoHeight.value
    ? estimatedCanvasHeight.value
    : Math.max(manualHeight, estimatedCanvasHeight.value)
  return Math.max(MIN_CANVAS_HEIGHT, Math.ceil(targetHeight))
})

const estimatedWidthScale = computed(() => {
  if (!props.autoScale) {
    return 1
  }
  const hostWidth = Math.max(1, viewportWidth.value || MIN_CANVAS_WIDTH)
  if (estimatedCanvasWidth.value <= hostWidth) {
    return 1
  }
  const safeHostWidth = Math.max(1, hostWidth - 2)
  return safeHostWidth / estimatedCanvasWidth.value
})

const previewViewportHeight = computed(() => {
  const scaledHeight = resolvedCanvasHeight.value * estimatedWidthScale.value
  if (isAutoHeight.value) {
    return Math.ceil(scaledHeight)
  }
  return Math.ceil(Math.max(fallbackHeight.value, scaledHeight))
})

const previewHeight = computed(() => `${previewViewportHeight.value}px`)

const debugLayoutEnabled = computed(() => {
  if (props.debugLayout) {
    return true
  }
  const raw = route.query.flowDebug ?? route.query.flow_debug
  const first = Array.isArray(raw) ? raw[0] : raw
  const value = String(first || '').trim().toLowerCase()
  return value === '1' || value === 'true' || value === 'yes' || value === 'on'
})

const updateViewportWidth = () => {
  if (!canvasViewportRef.value) {
    viewportWidth.value = 0
    return
  }
  viewportWidth.value = Math.max(0, canvasViewportRef.value.clientWidth)
}

const setupViewportResizeObserver = () => {
  viewportResizeObserver?.disconnect()
  viewportResizeObserver = null

  if (typeof ResizeObserver === 'undefined' || !canvasViewportRef.value) {
    return
  }
  viewportResizeObserver = new ResizeObserver(() => {
    updateViewportWidth()
  })
  viewportResizeObserver.observe(canvasViewportRef.value)
  updateViewportWidth()
}

const clearPreviewFitVerifyTimer = () => {
  if (previewFitVerifyTimer) {
    clearTimeout(previewFitVerifyTimer)
    previewFitVerifyTimer = null
  }
}

const previewRef = ref<any>()

const applyPreviewFitView = (attempt = 0) => {
  if (!import.meta.client || !props.autoScale || loading.value || !!errorMessage.value) {
    clearPreviewFitVerifyTimer()
    return
  }
  const preview = previewRef.value as any
  const fitViewAvailable = !!(preview && typeof preview.fitView === 'function')
  const translateCenterAvailable = !!(preview && typeof preview.translateCenter === 'function')
  const getTransformAvailable = !!(preview && typeof preview.getTransform === 'function')
  if (!preview || (!fitViewAvailable && !translateCenterAvailable)) {
    if (attempt < FITVIEW_RETRY_LIMIT) {
      setTimeout(() => applyPreviewFitView(attempt + 1), FITVIEW_RETRY_DELAY_MS)
    }
    return
  }
  requestAnimationFrame(() => {
    const graphData = typeof preview.getGraphData === 'function' ? preview.getGraphData() : null
    const graphNodeCount = Array.isArray(graphData?.nodes) ? graphData.nodes.length : -1
    if (graphNodeCount === 0) {
      if (attempt < FITVIEW_RETRY_LIMIT) {
        setTimeout(() => applyPreviewFitView(attempt + 1), FITVIEW_RETRY_DELAY_MS)
      }
      return
    }

    if (typeof preview.resizeCanvas === 'function') {
      preview.resizeCanvas()
    }
    if (typeof preview.resetZoom === 'function') {
      preview.resetZoom()
    }
    if (typeof preview.resetTranslate === 'function') {
      preview.resetTranslate()
    }

    let applied = false
    if (fitViewAvailable) {
      applied = preview.fitView(FITVIEW_VERTICAL_OFFSET, FITVIEW_HORIZONTAL_OFFSET)
    }
    if (!applied && translateCenterAvailable) {
      applied = preview.translateCenter()
    }

    const targetScale = Math.min(1, Math.max(0.01, Number(estimatedWidthScale.value || 1)))
    let transformSnapshot = getTransformAvailable ? preview.getTransform() : null
    let transformScale = Number(transformSnapshot?.SCALE_X ?? NaN)
    if (
      applied
      && fitViewAvailable
      && targetScale < 0.999
      && Number.isFinite(transformScale)
      && transformScale > targetScale + 0.03
    ) {
      preview.fitView()
      transformSnapshot = getTransformAvailable ? preview.getTransform() : transformSnapshot
      transformScale = Number(transformSnapshot?.SCALE_X ?? NaN)
    }

    clearPreviewFitVerifyTimer()
    if (applied && getTransformAvailable && targetScale < 0.999) {
      previewFitVerifyTimer = setTimeout(() => {
        const currentPreview = previewRef.value as any
        if (!currentPreview || typeof currentPreview.getTransform !== 'function') {
          clearPreviewFitVerifyTimer()
          return
        }
        const currentTransform = currentPreview.getTransform()
        const currentScale = Number(currentTransform?.SCALE_X ?? NaN)
        if (debugLayoutEnabled.value) {
          console.info('[FlowPreview][layout-fit-verify]', {
            targetScale,
            appliedScale: Number.isFinite(transformScale) ? transformScale : null,
            currentScale: Number.isFinite(currentScale) ? currentScale : null,
            currentTransform
          })
        }
        if (Number.isFinite(currentScale) && currentScale > targetScale + 0.03) {
          applyPreviewFitView(0)
        }
        clearPreviewFitVerifyTimer()
      }, 180)
    }

    if (!applied && attempt < FITVIEW_RETRY_LIMIT) {
      setTimeout(() => applyPreviewFitView(attempt + 1), FITVIEW_RETRY_DELAY_MS)
    }
  })
}

onMounted(() => {
  nextTick(() => {
    setupViewportResizeObserver()
    applyPreviewFitView()
  })
})

watch([loading, errorMessage], () => {
  nextTick(() => {
    setupViewportResizeObserver()
    applyPreviewFitView()
  })
})

watch(
  [
    () => props.autoScale,
    viewportWidth,
    resolvedCanvasWidth,
    resolvedCanvasHeight,
    () => flowData.value
  ],
  () => {
    nextTick(() => {
      applyPreviewFitView()
    })
  },
  { deep: true }
)

watch(
  [
    debugLayoutEnabled,
    resolvedType,
    resolvedHeightMode,
    () => props.autoScale,
    viewportWidth,
    estimatedCanvasWidth,
    estimatedCanvasHeight,
    resolvedCanvasWidth,
    resolvedCanvasHeight,
    estimatedWidthScale,
    previewViewportHeight
  ],
  () => {
    if (!import.meta.client || !debugLayoutEnabled.value) {
      return
    }
    console.info('[FlowPreview][layout-debug]', {
      type: resolvedType.value,
      heightMode: resolvedHeightMode.value,
      autoScale: props.autoScale,
      viewportWidth: viewportWidth.value,
      estimatedCanvasWidth: estimatedCanvasWidth.value,
      estimatedCanvasHeight: estimatedCanvasHeight.value,
      resolvedCanvasWidth: resolvedCanvasWidth.value,
      resolvedCanvasHeight: resolvedCanvasHeight.value,
      estimatedWidthScale: Number(estimatedWidthScale.value.toFixed(4)),
      resizeCanvasAvailable: !!(previewRef.value && typeof (previewRef.value as any).resizeCanvas === 'function'),
      fitViewAvailable: !!(previewRef.value && typeof (previewRef.value as any).fitView === 'function'),
      resetZoomAvailable: !!(previewRef.value && typeof (previewRef.value as any).resetZoom === 'function'),
      resetTranslateAvailable: !!(previewRef.value && typeof (previewRef.value as any).resetTranslate === 'function'),
      translateCenterAvailable: !!(previewRef.value && typeof (previewRef.value as any).translateCenter === 'function'),
      transformSnapshot: !!(previewRef.value && typeof (previewRef.value as any).getTransform === 'function')
        ? (previewRef.value as any).getTransform()
        : null,
      graphNodeCount: (() => {
        const preview = previewRef.value as any
        if (!preview || typeof preview.getGraphData !== 'function') {
          return -1
        }
        const graphData = preview.getGraphData()
        return Array.isArray(graphData?.nodes) ? graphData.nodes.length : -1
      })(),
      previewViewportHeight: previewViewportHeight.value
    })
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  viewportResizeObserver?.disconnect()
  viewportResizeObserver = null
  clearPreviewFitVerifyTimer()
})

// 导出数据
const exportData = () => {
  if (previewRef.value) {
    const data = previewRef.value.getGraphData()
    if (!data) {
      return
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'flow-data.json'
    a.click()
    URL.revokeObjectURL(url)
  }
}
</script>

<template>
  <ClientOnly>
    <div class="flow-preview-wrapper">
      <div v-if="loading" class="loading">加载中...</div>
      <div v-else-if="errorMessage" class="error">{{ errorMessage }}</div>
      <div v-else-if="assetIssueMessage" class="asset-warning">{{ assetIssueMessage }}（已采用兼容渲染）</div>
      <div
        v-if="!loading && !errorMessage"
        ref="canvasViewportRef"
        class="flow-canvas-viewport"
        :style="{ height: previewHeight }"
      >
        <YysEditorPreview
          ref="previewRef"
          mode="preview"
          :capability="resolvedCapability"
          :config="flowEmbedConfig"
          :data="flowData"
          :width="resolvedCanvasWidth"
          :height="resolvedCanvasHeight"
          :show-mini-map="showMiniMap"
        />
      </div>
      <div v-if="!loading && !errorMessage" class="flow-actions">
        <button @click="exportData" class="export-btn">
          导出
        </button>
      </div>
    </div>
    <template #fallback>
      <div class="flow-preview-placeholder" :style="{ height: previewHeight }">
        <p>加载流程图组件中...</p>
      </div>
    </template>
  </ClientOnly>
</template>

<style scoped>
.flow-preview-wrapper {
  position: relative;
  margin: 20px 0;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
  background: #fff;
}

.flow-canvas-viewport {
  width: 100%;
  overflow: hidden;
}

.flow-preview-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 20px 0;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background: #f9f9f9;
  color: #666;
}

.loading {
  padding: 40px;
  text-align: center;
  color: #999;
}

.error {
  padding: 40px;
  text-align: center;
  color: #c62828;
}

.asset-warning {
  padding: 10px 12px;
  background: #fff7ed;
  color: #9a3412;
  border-bottom: 1px solid #fed7aa;
}

.flow-actions {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 10;
}

.export-btn {
  padding: 6px 12px;
  background: white;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.export-btn:hover {
  background: #f5f5f5;
}
</style>
