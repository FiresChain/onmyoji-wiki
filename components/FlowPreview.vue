<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { YysEditorPreview } from 'yys-editor'
import 'yys-editor/style.css'

const props = defineProps({
  data: {
    type: Object,
    default: () => ({ nodes: [], edges: [] })
  },
  src: {
    type: String,
    default: ''
  },
  height: {
    type: Number,
    default: 400
  },
  showMiniMap: {
    type: Boolean,
    default: false
  }
})

const flowData = ref(props.data)
const loading = ref(false)

// 从外部加载数据
onMounted(async () => {
  if (props.src) {
    loading.value = true
    try {
      const response = await fetch(props.src)
      const data = await response.json()

      // 如果是完整的编辑器数据格式，提取 graphRawData
      if (data.fileList && data.fileList.length > 0) {
        flowData.value = data.fileList[0].graphRawData
      } else {
        flowData.value = data
      }
    } catch (error) {
      console.error('Failed to load flow data:', error)
    } finally {
      loading.value = false
    }
  }
})

// 导出数据
const previewRef = ref()
const exportData = () => {
  if (previewRef.value) {
    const data = previewRef.value.getGraphData()
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
      <YysEditorPreview
        v-else
        ref="previewRef"
        mode="preview"
        :data="flowData"
        :height="height"
        :show-mini-map="showMiniMap"
      />
      <div class="flow-actions">
        <button @click="exportData" class="export-btn">
          📥 导出
        </button>
      </div>
    </div>
    <template #fallback>
      <div class="flow-preview-placeholder" :style="{ height: `${height}px` }">
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
