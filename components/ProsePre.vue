<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import FlowPreview from '~/components/FlowPreview.vue'
import { parseOnmyojiEditorFenceInfo } from '~/utils/onmyoji-editor-syntax'

const props = withDefaults(defineProps<{
  code?: string
  language?: string | null
  filename?: string | null
  highlights?: number[]
  meta?: string | null
  class?: string | null
}>(), {
  code: '',
  language: null,
  filename: null,
  highlights: () => [],
  meta: null,
  class: null
})

const attrs = useAttrs()
const fenceInfoRaw = computed(() => {
  const language = props.language || ''
  const meta = props.meta || ''
  return `${language}${meta ? ` ${meta}` : ''}`.trim()
})

const fenceInfo = computed(() => parseOnmyojiEditorFenceInfo(fenceInfoRaw.value))
const parsedBlockPayload = computed<Record<string, unknown> | null>(() => {
  if (!fenceInfo.value.isOnmyojiEditor || fenceInfo.value.type !== 'block') {
    return null
  }
  try {
    const parsed = JSON.parse(props.code || '{}')
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, unknown>
    }
    return null
  } catch {
    return null
  }
})

const resolvedHeight = computed<number>(() => {
  if (fenceInfo.value.height && fenceInfo.value.height > 0) {
    return fenceInfo.value.height
  }
  const payloadHeight = parsedBlockPayload.value?.height
  if (typeof payloadHeight === 'number' && Number.isFinite(payloadHeight) && payloadHeight > 0) {
    return payloadHeight
  }
  return 400
})

const canRenderFileFlow = computed(() => (
  fenceInfo.value.isOnmyojiEditor
  && fenceInfo.value.type === 'file'
  && !!fenceInfo.value.src
))

const canRenderBlockFlow = computed(() => (
  fenceInfo.value.isOnmyojiEditor
  && fenceInfo.value.type === 'block'
  && !!parsedBlockPayload.value
))
</script>

<template>
  <FlowPreview
    v-if="canRenderFileFlow"
    type="file"
    :src="fenceInfo.src"
    :height="resolvedHeight"
  />
  <FlowPreview
    v-else-if="canRenderBlockFlow"
    type="block"
    :data="parsedBlockPayload"
    :height="resolvedHeight"
  />
  <pre v-else v-bind="attrs" :class="$props.class">
    <slot />
  </pre>
</template>

