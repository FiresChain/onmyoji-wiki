<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import MilkdownEditor from '~/components/editor/MilkdownEditor.client.vue'
import { FileSystemEditorStorageAdapter } from '~/utils/editor-storage/file-system'
import { LocalStorageEditorStorageAdapter } from '~/utils/editor-storage/local-storage'

const DEFAULT_MARKDOWN = `# Onmyoji Wiki Editor

欢迎使用编辑器 MVP。

- 默认会自动保存到 localStorage
- 支持导入 / 导出 markdown 与 json
- 在支持 File System Access API 的浏览器中，可选择本地目录并回写原文件
`

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

const importInput = ref<HTMLInputElement | null>(null)
let autosaveTimer: ReturnType<typeof setTimeout> | null = null
let hydrated = false

const canOpenFile = computed(() => (
  isFsSupported.value && fileSystemAdapter.hasDirectory() && selectedFile.value.trim().length > 0
))

const canSaveToFile = computed(() => (
  isFsSupported.value && fileSystemAdapter.hasDirectory() && !!fileSystemAdapter.getCurrentFileName()
))

const canRefreshFiles = computed(() => (
  isFsSupported.value && fileSystemAdapter.hasDirectory()
))

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

const readFileText = async (file: File): Promise<string> => {
  return await file.text()
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
    const text = await readFileText(file)
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

      <MilkdownEditor v-model="markdown" />
    </section>

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
  max-width: 1100px;
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

.toolbar {
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

.hidden-input {
  display: none;
}

@media (max-width: 720px) {
  .panel {
    padding: 14px;
  }

  .panel-header h1 {
    font-size: 24px;
  }
}
</style>
