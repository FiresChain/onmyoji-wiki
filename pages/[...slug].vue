<script setup lang="ts">
import { loadSearchIndex } from '~/utils/search-index'

type SearchIndexItem = {
  path: string
  title: string
  summary?: string
  lang: 'zh' | 'en'
  categoryL1: string
  categoryL2: string
  authorId: string
  authorName: string
  tags?: string[]
  updatedAt: string
  stage?: string | number
}

type ContentPage = {
  path?: string
  lang?: 'zh' | 'en'
  title?: string
  summary?: string
  description?: string
  categoryL1?: string
  categoryL2?: string
  body?: unknown
  __missing?: boolean
}

const route = useRoute()
const router = useRouter()

const { data: page } = await useAsyncData<ContentPage>(
  () => `content-page-${route.path}`,
  async () => {
    try {
      const doc = await queryCollection('content').path(route.path).first()
      if (doc) {
        return {
          ...(doc as ContentPage),
          __missing: false
        }
      }
      return { __missing: true, path: route.path }
    } catch (error) {
      console.error('[content] failed to load page', route.path, error)
      return { __missing: true, path: route.path }
    }
  },
  { watch: [() => route.path] }
)

const pathSegments = computed(() => route.path.split('/').filter(Boolean))
const locale = computed<'zh' | 'en'>(() => {
  const lang = String(page.value?.lang || pathSegments.value[0] || 'zh')
  return lang === 'en' ? 'en' : 'zh'
})

const isStageHub = computed(() => {
  if (!page.value?.categoryL1 || !page.value?.categoryL2) {
    return false
  }
  return pathSegments.value.length === 3
})

const selectedStage = ref(typeof route.query.stage === 'string' ? route.query.stage : 'all')

watch(
  () => route.query.stage,
  (queryStage) => {
    selectedStage.value = typeof queryStage === 'string' ? queryStage : 'all'
  }
)

const { data: stageIndexItems } = await useAsyncData(
  () => `stage-index-${locale.value}`,
  () => loadSearchIndex<SearchIndexItem>(locale.value),
  { watch: [locale] }
)

const topicEntries = computed<SearchIndexItem[]>(() => {
  if (!isStageHub.value || !page.value) {
    return []
  }

  return (stageIndexItems.value ?? []).filter((item) => {
    return item.lang === locale.value
      && item.categoryL1 === page.value.categoryL1
      && item.categoryL2 === page.value.categoryL2
  })
})

const stageOptions = computed<Array<string | number>>(() => {
  const values = new Set<string | number>()

  topicEntries.value.forEach((item) => {
    if (item.stage !== undefined) {
      values.add(item.stage)
    }
  })

  return Array.from(values).sort((a, b) => {
    const aNum = Number(a)
    const bNum = Number(b)
    const aIsNum = Number.isFinite(aNum)
    const bIsNum = Number.isFinite(bNum)

    if (aIsNum && bIsNum) {
      return aNum - bNum
    }
    if (aIsNum) return -1
    if (bIsNum) return 1
    return String(a).localeCompare(String(b), 'zh-Hans-CN')
  })
})

const stageFilteredEntries = computed<SearchIndexItem[]>(() => {
  if (!topicEntries.value.length) {
    return []
  }

  const stage = selectedStage.value
  if (stage === 'all') {
    const dedup = new Map<string, SearchIndexItem>()

    for (const item of topicEntries.value) {
      const basePath = item.path.split('#')[0]
      const key = `${item.lang}|${basePath}`
      const existing = dedup.get(key)

      if (!existing || item.updatedAt > existing.updatedAt) {
        dedup.set(key, { ...item, path: basePath })
      }
    }

    return Array.from(dedup.values()).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
  }

  return topicEntries.value
    .filter((item) => String(item.stage) === stage)
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
})

watch([selectedStage, isStageHub], () => {
  if (!isStageHub.value) {
    return
  }

  const nextStage = selectedStage.value
  const currentStage = typeof route.query.stage === 'string' ? route.query.stage : 'all'

  if (nextStage === currentStage) {
    return
  }

  const nextQuery: Record<string, string> = {}
  for (const [key, value] of Object.entries(route.query)) {
    if (key === 'stage') continue
    if (typeof value === 'string') {
      nextQuery[key] = value
    }
  }

  if (nextStage !== 'all') {
    nextQuery.stage = nextStage
  }

  router.replace({ query: nextQuery })
})

function formatStage(stage: string | number | undefined): string {
  if (stage === undefined) {
    return ''
  }
  return `第 ${stage} 层`
}

const breadcrumbs = computed(() => {
  const segments = route.path.split('/').filter(Boolean)
  const items = [{ label: '首页', href: '/' as string | undefined }]
  let cursor = ''

  segments.forEach((segment) => {
    cursor += `/${segment}`
    items.push({
      label: segment,
      href: cursor as string | undefined
    })
  })

  if (items.length > 1) {
    items[items.length - 1].href = undefined
  }

  return items
})
</script>

<template>
  <div v-if="page && !page.__missing">
    <PageHeader
      v-if="page.title"
      :title="page.title"
      :description="page.description || page.summary"
      :breadcrumbs="breadcrumbs"
    />

    <section class="site-container fallback-content">
      <article class="card fallback-article">
        <div class="wiki-prose">
          <ContentRenderer :value="page" />
        </div>
      </article>

      <section v-if="isStageHub && topicEntries.length" class="card stage-browser">
        <div class="stage-browser-head">
          <h2>关卡横向筛选</h2>
          <small>点击后可直接跳转到攻略对应章节锚点</small>
        </div>

        <div class="stage-tabs">
          <button
            type="button"
            :class="{ 'is-active': selectedStage === 'all' }"
            @click="selectedStage = 'all'"
          >
            全部
          </button>
          <button
            v-for="stage in stageOptions"
            :key="String(stage)"
            type="button"
            :class="{ 'is-active': selectedStage === String(stage) }"
            @click="selectedStage = String(stage)"
          >
            {{ formatStage(stage) }}
          </button>
        </div>

        <div v-if="stageFilteredEntries.length" class="stage-guide-list">
          <NuxtLink
            v-for="item in stageFilteredEntries"
            :key="`${item.path}-${item.authorId}-${item.updatedAt}-${item.stage ?? 'all'}`"
            :to="item.path"
            class="stage-guide-item"
          >
            <div class="stage-guide-meta">
              <span>{{ item.authorName }}</span>
              <small>{{ item.updatedAt }}</small>
            </div>
            <strong>{{ item.title }}</strong>
            <p>{{ item.summary || `${item.categoryL1} / ${item.categoryL2} 攻略` }}</p>
            <div class="stage-guide-tail">
              <span>{{ item.categoryL1 }} / {{ item.categoryL2 }}</span>
              <span v-if="item.stage !== undefined">目标：{{ formatStage(item.stage) }}</span>
            </div>
          </NuxtLink>
        </div>
        <p v-else class="stage-empty">当前筛选下暂无攻略。</p>
      </section>
    </section>
  </div>

  <div v-else>
    <PageHeader
      title="页面不存在"
      description="未找到对应的 Markdown 页面。"
      :breadcrumbs="[
        { label: '首页', href: '/' },
        { label: '未找到' }
      ]"
    />
  </div>
</template>

<style scoped>
.fallback-content {
  padding: 24px 0 40px;
  display: grid;
  gap: 14px;
}

.fallback-article {
  padding: 22px;
}

.stage-browser {
  padding: 16px;
}

.stage-browser-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.stage-browser-head h2 {
  margin: 0;
  font-size: 20px;
}

.stage-browser-head small {
  color: var(--color-muted);
}

.stage-tabs {
  margin-top: 12px;
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 6px;
}

.stage-tabs button {
  white-space: nowrap;
  border: 1px solid var(--color-border);
  background: var(--color-surface-soft);
  color: var(--color-muted);
  border-radius: 8px;
  padding: 6px 12px;
  cursor: pointer;
}

.stage-tabs button.is-active {
  color: var(--color-primary-contrast);
  border-color: var(--color-primary);
  background: var(--color-primary);
}

.stage-guide-list {
  margin-top: 12px;
  display: grid;
  gap: 10px;
}

.stage-guide-item {
  display: block;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 12px;
  background: var(--color-surface);
}

.stage-guide-item:hover {
  border-color: color-mix(in srgb, var(--color-primary) 45%, var(--color-border));
}

.stage-guide-meta {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  color: var(--color-muted);
  font-size: 12px;
}

.stage-guide-item strong {
  margin-top: 6px;
  display: block;
}

.stage-guide-item p {
  margin: 8px 0 0;
  color: var(--color-muted);
}

.stage-guide-tail {
  margin-top: 8px;
  display: flex;
  justify-content: space-between;
  gap: 8px;
  color: var(--color-muted);
  font-size: 12px;
}

.stage-empty {
  margin: 12px 0 0;
  color: var(--color-muted);
}
</style>
