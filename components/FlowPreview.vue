<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { joinURL } from 'ufo'
import { YysEditorPreview } from 'yys-editor'
import 'yys-editor/style.css'

type GraphData = {
  nodes: any[]
  edges: any[]
}

type FlowCapabilityLevel = 'render-only' | 'interactive'

const props = withDefaults(defineProps<{
  data?: Record<string, any> | null
  src?: string
  height?: number | string
  showMiniMap?: boolean
  capability?: FlowCapabilityLevel
}>(), {
  data: () => ({ nodes: [], edges: [] }),
  src: '',
  height: 400,
  showMiniMap: false
})

const flowData = ref<GraphData>({ nodes: [], edges: [] })
const loading = ref(false)
const errorMessage = ref('')
const runtimeConfig = useRuntimeConfig()
const resolvedCapability = computed<FlowCapabilityLevel>(() => {
  return props.capability || 'render-only'
})

const resolveSrcUrl = (src: string) => {
  if (!src) {
    return ''
  }
  if (/^https?:\/\//i.test(src) || src.startsWith('//')) {
    return src
  }
  if (src.startsWith('/')) {
    return joinURL(runtimeConfig.app.baseURL || '/', src.slice(1))
  }
  return src
}

const resolveAssetUrl = (url: string) => {
  if (!url.startsWith('/assets/')) {
    return url
  }
  return joinURL(runtimeConfig.app.baseURL || '/', url.slice(1))
}

const rewriteAssetUrls = (input: any): any => {
  if (typeof input === 'string') {
    return resolveAssetUrl(input)
  }
  if (Array.isArray(input)) {
    return input.map((item) => rewriteAssetUrls(item))
  }
  if (input && typeof input === 'object') {
    const output: Record<string, any> = {}
    for (const [key, value] of Object.entries(input)) {
      output[key] = rewriteAssetUrls(value)
    }
    return output
  }
  return input
}

const normalizeData = (input: any): GraphData => {
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

const applyData = (data: any) => {
  flowData.value = rewriteAssetUrls(normalizeData(data))
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
  watch(() => props.src, (newSrc) => {
    void loadFromSrc(newSrc)
  }, { immediate: true })
}

watch(() => props.data, (newData) => {
  if (!props.src) {
    applyData(newData)
  }
}, { deep: true })

const previewHeight = computed(() => (
  typeof props.height === 'number' ? `${props.height}px` : props.height
))

// 导出数据
const previewRef = ref<any>()
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
      <YysEditorPreview
        v-else
        ref="previewRef"
        mode="preview"
        :capability="resolvedCapability"
        :data="flowData"
        :height="height"
        :show-mini-map="showMiniMap"
      />
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
