<script setup lang="ts">
import { loadSearchIndex } from '~/utils/search-index'
import { getContentLocaleFromPath } from '~/utils/site-locale'

definePageMeta({
  path: '/:locale(zh|en)/guides'
})

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
}

type GuideDoc = {
  path: string
  title: string
  summary: string
  lang: 'zh' | 'en'
  categoryL1: string
  categoryL2: string
  authorId: string
  authorName: string
  tags: string[]
  updatedAt: string
}

const route = useRoute()
const router = useRouter()
const contentLocale = computed<'zh' | 'en'>(() => getContentLocaleFromPath(route.path) || 'zh')

const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const selectedStageL1 = ref(
  typeof route.query.l1 === 'string'
    ? route.query.l1
    : typeof route.query.category === 'string'
      ? route.query.category
      : 'all'
)
const selectedStageL2 = ref(typeof route.query.l2 === 'string' ? route.query.l2 : 'all')
const selectedAuthorId = ref(typeof route.query.authorId === 'string' ? route.query.authorId : 'all')

const { data: indexItems } = await useAsyncData(
  () => `guides-search-index-${contentLocale.value}`,
  () => loadSearchIndex<SearchIndexItem>(contentLocale.value),
  { watch: [contentLocale] }
)

const guides = computed<GuideDoc[]>(() => {
  const map = new Map<string, GuideDoc>()

  for (const item of indexItems.value ?? []) {
    const basePath = item.path.split('#')[0]
    const key = `${item.lang}|${basePath}`
    const summary = item.summary?.trim() || `${item.categoryL1} / ${item.categoryL2} 攻略`
    const tags = Array.isArray(item.tags) ? item.tags : []
    const existing = map.get(key)

    if (!existing) {
      map.set(key, {
        path: basePath,
        title: item.title,
        summary,
        lang: item.lang,
        categoryL1: item.categoryL1,
        categoryL2: item.categoryL2,
        authorId: item.authorId,
        authorName: item.authorName,
        tags,
        updatedAt: item.updatedAt
      })
      continue
    }

    existing.tags = Array.from(new Set([...existing.tags, ...tags]))
    if (item.updatedAt > existing.updatedAt) {
      existing.title = item.title
      existing.summary = summary
      existing.categoryL1 = item.categoryL1
      existing.categoryL2 = item.categoryL2
      existing.authorId = item.authorId
      existing.authorName = item.authorName
      existing.updatedAt = item.updatedAt
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const aTs = Date.parse(a.updatedAt)
    const bTs = Date.parse(b.updatedAt)
    if (Number.isNaN(aTs) && Number.isNaN(bTs)) return 0
    if (Number.isNaN(aTs)) return 1
    if (Number.isNaN(bTs)) return -1
    return bTs - aTs
  })
})

type StageGroup = {
  name: string
  count: number
  children: Array<{ name: string; count: number }>
}

const stageTree = computed<StageGroup[]>(() => {
  const grouped = new Map<string, Map<string, number>>()
  for (const guide of guides.value) {
    const l1 = guide.categoryL1 || '未分类'
    const l2 = guide.categoryL2 || '未分类'
    if (!grouped.has(l1)) {
      grouped.set(l1, new Map())
    }
    const childMap = grouped.get(l1)!
    childMap.set(l2, (childMap.get(l2) || 0) + 1)
  }

  return Array.from(grouped.entries())
    .map(([name, childrenMap]) => {
      const children = Array.from(childrenMap.entries())
        .map(([childName, count]) => ({ name: childName, count }))
        .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
      return {
        name,
        count: children.reduce((total, child) => total + child.count, 0),
        children
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
})

const authorOptions = computed(() => {
  const map = new Map<string, string>()
  guides.value.forEach((guide) => {
    map.set(guide.authorId, guide.authorName)
  })
  return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
})

const selectedAuthorName = computed(() => {
  if (selectedAuthorId.value === 'all') return ''
  return authorOptions.value.find((item) => item.id === selectedAuthorId.value)?.name || selectedAuthorId.value
})

const expandedStageL1 = ref<string>('all')

watch(
  stageTree,
  (tree) => {
    if (!tree.length) {
      expandedStageL1.value = 'all'
      selectedStageL1.value = 'all'
      selectedStageL2.value = 'all'
      return
    }

    const currentL1Exists = tree.some((item) => item.name === selectedStageL1.value)
    if (selectedStageL1.value !== 'all' && !currentL1Exists) {
      selectedStageL1.value = 'all'
      selectedStageL2.value = 'all'
    }

    if (selectedStageL1.value !== 'all') {
      expandedStageL1.value = selectedStageL1.value
      const children = tree.find((item) => item.name === selectedStageL1.value)?.children || []
      const currentL2Exists = children.some((item) => item.name === selectedStageL2.value)
      if (selectedStageL2.value !== 'all' && !currentL2Exists) {
        selectedStageL2.value = 'all'
      }
      return
    }

    if (expandedStageL1.value === 'all' || !tree.some((item) => item.name === expandedStageL1.value)) {
      expandedStageL1.value = tree[0]?.name || 'all'
    }
  },
  { immediate: true }
)

const handleSelectAllStage = () => {
  selectedStageL1.value = 'all'
  selectedStageL2.value = 'all'
}

const handleSelectStageL1 = (l1: string) => {
  expandedStageL1.value = l1
  selectedStageL1.value = l1
  selectedStageL2.value = 'all'
}

const handleSelectStageL2 = (l1: string, l2: string) => {
  expandedStageL1.value = l1
  selectedStageL1.value = l1
  selectedStageL2.value = l2
}

const filteredGuides = computed<GuideDoc[]>(() => {
  const keyword = search.value.trim().toLowerCase()

  return guides.value.filter((guide) => {
    const matchL1 = selectedStageL1.value === 'all' || guide.categoryL1 === selectedStageL1.value
    const matchL2 = selectedStageL2.value === 'all' || guide.categoryL2 === selectedStageL2.value
    const matchAuthor = selectedAuthorId.value === 'all' || guide.authorId === selectedAuthorId.value

    if (!matchL1 || !matchL2 || !matchAuthor) {
      return false
    }

    if (!keyword) {
      return true
    }

    const text = [
      guide.title,
      guide.summary,
      guide.categoryL1,
      guide.categoryL2,
      guide.authorId,
      guide.authorName,
      ...guide.tags
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return text.includes(keyword)
  })
})

watch([search, selectedStageL1, selectedStageL2, selectedAuthorId], () => {
  const nextQuery: Record<string, string> = {}

  if (search.value.trim()) {
    nextQuery.q = search.value.trim()
  }
  if (selectedStageL1.value !== 'all') {
    nextQuery.l1 = selectedStageL1.value
  }
  if (selectedStageL1.value !== 'all' && selectedStageL2.value !== 'all') {
    nextQuery.l2 = selectedStageL2.value
  }
  if (selectedAuthorId.value !== 'all') {
    nextQuery.authorId = selectedAuthorId.value
  }

  router.replace({ query: nextQuery })
})
</script>

<template>
  <div>
    <PageHeader
      title="攻略中心"
      description="当前为 mock 展示数据（来自 build 生成的 search-index）。"
      :breadcrumbs="[
        { label: '首页', href: '/' },
        { label: '攻略中心' }
      ]"
    />

    <section class="site-container guides-page">
      <aside class="guides-sidebar card">
        <div class="stage-filter-head">
          <h2>关卡筛选</h2>
          <small>先选系列，再选具体关卡</small>
        </div>

        <button
          type="button"
          class="stage-l1-button stage-all-button"
          :class="{ 'is-active': selectedStageL1 === 'all' }"
          @click="handleSelectAllStage"
        >
          <span>全部系列</span>
          <small>{{ guides.length }}</small>
        </button>

        <div class="stage-menu">
          <div
            v-for="group in stageTree"
            :key="group.name"
            class="stage-group"
          >
            <button
              type="button"
              class="stage-l1-button"
              :class="{ 'is-active': selectedStageL1 === group.name }"
              @click="handleSelectStageL1(group.name)"
            >
              <span>{{ group.name }}</span>
              <small>{{ group.count }}</small>
            </button>

            <div
              v-if="expandedStageL1 === group.name"
              class="stage-l2-list"
            >
              <button
                type="button"
                class="stage-l2-button"
                :class="{ 'is-active': selectedStageL1 === group.name && selectedStageL2 === 'all' }"
                @click="handleSelectStageL1(group.name)"
              >
                全部
              </button>
              <button
                v-for="child in group.children"
                :key="child.name"
                type="button"
                class="stage-l2-button"
                :class="{ 'is-active': selectedStageL1 === group.name && selectedStageL2 === child.name }"
                @click="handleSelectStageL2(group.name, child.name)"
              >
                <span>{{ child.name }}</span>
                <small>{{ child.count }}</small>
              </button>
            </div>
          </div>
        </div>

        <div class="guides-filters">
          <label>
            <span>关键词</span>
            <input v-model="search" type="search" placeholder="搜索标题、标签或作者">
          </label>

          <div class="guides-category-row">
            <span>作者</span>
            <button
              type="button"
              :class="{ 'is-active': selectedAuthorId === 'all' }"
              @click="selectedAuthorId = 'all'"
            >
              all
            </button>
            <button
              v-for="author in authorOptions"
              :key="author.id"
              type="button"
              :class="{ 'is-active': selectedAuthorId === author.id }"
              @click="selectedAuthorId = author.id"
            >
              {{ author.name }}
            </button>
          </div>
        </div>
      </aside>

      <div class="guides-content">
        <p class="guides-count">
          共 {{ filteredGuides.length }} 篇攻略
          <span v-if="selectedStageL1 !== 'all'"> · {{ selectedStageL1 }}</span>
          <span v-if="selectedStageL2 !== 'all'"> / {{ selectedStageL2 }}</span>
          <span v-if="selectedAuthorName">（当前作者：{{ selectedAuthorName }}）</span>
        </p>

        <div v-if="filteredGuides.length" class="guides-list">
          <NuxtLink
            v-for="guide in filteredGuides"
            :key="guide.path"
            :to="guide.path"
            class="guides-card card"
          >
            <div class="guides-card-meta">
              <span>{{ guide.categoryL1 }} / {{ guide.categoryL2 }}</span>
              <small>更新于 {{ guide.updatedAt }}</small>
            </div>
            <h2>{{ guide.title }}</h2>
            <p>{{ guide.summary }}</p>
            <div class="guides-card-tail">
              <span>作者：{{ guide.authorName }}（{{ guide.authorId }}）</span>
              <div class="guides-tags">
                <span v-for="tag in guide.tags.slice(0, 4)" :key="tag">{{ tag }}</span>
              </div>
            </div>
          </NuxtLink>
        </div>

        <div v-else class="guides-empty card">
          <h2>未找到匹配攻略</h2>
          <p>可尝试清空关键词或切换筛选条件。</p>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.guides-page {
  padding: 26px 0 38px;
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 16px;
}

.guides-sidebar {
  position: sticky;
  top: 14px;
  height: fit-content;
  padding: 14px;
  display: grid;
  gap: 12px;
}

.stage-filter-head {
  display: grid;
  gap: 4px;
}

.stage-filter-head h2 {
  margin: 0;
  font-size: 22px;
}

.stage-filter-head small {
  color: var(--color-muted);
  font-size: 12px;
}

.stage-menu {
  display: grid;
  gap: 8px;
}

.stage-group {
  display: grid;
  gap: 6px;
}

.stage-l1-button {
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface-soft);
  color: var(--color-foreground);
  min-height: 42px;
  padding: 0 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.stage-l1-button small {
  color: var(--color-muted);
  font-size: 11px;
}

.stage-l1-button.is-active {
  border-color: color-mix(in srgb, var(--color-primary) 60%, var(--color-border));
  background: color-mix(in srgb, var(--color-primary) 14%, var(--color-surface-soft));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-primary) 24%, transparent);
}

.stage-all-button {
  font-weight: 700;
}

.stage-l2-list {
  margin-left: 14px;
  display: grid;
  gap: 6px;
  border-left: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
  padding-left: 10px;
}

.stage-l2-button {
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: #fff;
  color: var(--color-muted);
  min-height: 36px;
  padding: 0 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.stage-l2-button.is-active {
  color: var(--color-primary-contrast);
  border-color: var(--color-primary);
  background: var(--color-primary);
}

.stage-l2-button.is-active small {
  color: color-mix(in srgb, var(--color-primary-contrast) 86%, transparent);
}

.guides-filters {
  border-top: 1px solid var(--color-border);
  padding-top: 12px;
  display: grid;
  gap: 14px;
}

.guides-filters label {
  display: grid;
  gap: 8px;
}

.guides-filters span {
  color: var(--color-muted);
  font-size: 13px;
}

.guides-content {
  min-width: 0;
}

.guides-filters input {
  width: 100%;
  min-height: 40px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background: var(--color-surface-soft);
  color: var(--color-foreground);
  padding: 0 12px;
}

.guides-category-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.guides-category-row button {
  border: 1px solid var(--color-border);
  background: var(--color-surface-soft);
  color: var(--color-muted);
  border-radius: 7px;
  padding: 5px 10px;
  cursor: pointer;
}

.guides-category-row button.is-active {
  color: var(--color-primary-contrast);
  border-color: var(--color-primary);
  background: var(--color-primary);
}

.guides-count {
  margin: 16px 2px 14px;
  color: var(--color-muted);
  font-size: 14px;
}

.guides-list {
  display: grid;
  gap: 14px;
}

.guides-card {
  display: block;
  padding: 18px;
}

.guides-card:hover {
  border-color: color-mix(in srgb, var(--color-primary) 45%, var(--color-border));
}

.guides-card-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: var(--color-muted);
  font-size: 12px;
}

.guides-card h2 {
  margin: 8px 0 0;
  font-size: 22px;
}

.guides-card p {
  margin: 10px 0 0;
  color: var(--color-muted);
}

.guides-card-tail {
  margin-top: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  color: var(--color-muted);
  font-size: 13px;
}

.guides-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.guides-tags span {
  background: var(--color-surface-soft);
  border-radius: 6px;
  padding: 2px 6px;
}

.guides-empty {
  padding: 32px 18px;
  text-align: center;
}

.guides-empty h2 {
  margin: 0;
  font-size: 22px;
}

.guides-empty p {
  color: var(--color-muted);
  margin: 8px 0 0;
}

@media (max-width: 980px) {
  .guides-page {
    grid-template-columns: 1fr;
  }

  .guides-sidebar {
    position: static;
  }
}
</style>
