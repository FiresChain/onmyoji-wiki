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

const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const selectedCategory = ref(typeof route.query.category === 'string' ? route.query.category : 'all')
const selectedLang = ref(typeof route.query.lang === 'string' ? route.query.lang : 'all')
const selectedAuthorId = ref(typeof route.query.authorId === 'string' ? route.query.authorId : 'all')

const { data: indexItems } = await useAsyncData('guides-search-index', async () => {
  const [zh, en] = await Promise.all([
    loadSearchIndex<SearchIndexItem>('zh'),
    loadSearchIndex<SearchIndexItem>('en')
  ])
  return [...zh, ...en]
})

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

const categories = computed(() => {
  const values = new Set<string>()
  guides.value.forEach((guide) => values.add(guide.categoryL1))
  return ['all', ...Array.from(values)]
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

const filteredGuides = computed<GuideDoc[]>(() => {
  const keyword = search.value.trim().toLowerCase()

  return guides.value.filter((guide) => {
    const matchCategory = selectedCategory.value === 'all' || guide.categoryL1 === selectedCategory.value
    const matchLang = selectedLang.value === 'all' || guide.lang === selectedLang.value
    const matchAuthor = selectedAuthorId.value === 'all' || guide.authorId === selectedAuthorId.value

    if (!matchCategory || !matchLang || !matchAuthor) {
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

watch([search, selectedCategory, selectedLang, selectedAuthorId], () => {
  const nextQuery: Record<string, string> = {}

  if (search.value.trim()) {
    nextQuery.q = search.value.trim()
  }
  if (selectedCategory.value !== 'all') {
    nextQuery.category = selectedCategory.value
  }
  if (selectedLang.value !== 'all') {
    nextQuery.lang = selectedLang.value
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
      <div class="guides-filters card">
        <label>
          <span>搜索</span>
          <input v-model="search" type="search" placeholder="搜索标题、标签或作者">
        </label>

        <div class="guides-category-row">
          <span>分类</span>
          <button
            v-for="category in categories"
            :key="category"
            type="button"
            :class="{ 'is-active': selectedCategory === category }"
            @click="selectedCategory = category"
          >
            {{ category }}
          </button>
        </div>

        <div class="guides-category-row">
          <span>语言</span>
          <button type="button" :class="{ 'is-active': selectedLang === 'all' }" @click="selectedLang = 'all'">all</button>
          <button type="button" :class="{ 'is-active': selectedLang === 'zh' }" @click="selectedLang = 'zh'">zh</button>
          <button type="button" :class="{ 'is-active': selectedLang === 'en' }" @click="selectedLang = 'en'">en</button>
        </div>

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

      <p class="guides-count">
        共 {{ filteredGuides.length }} 篇攻略
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
            <small>{{ guide.lang.toUpperCase() }} · 更新于 {{ guide.updatedAt }}</small>
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
    </section>
  </div>
</template>

<style scoped>
.guides-page {
  padding: 26px 0 38px;
}

.guides-filters {
  display: grid;
  gap: 14px;
  padding: 16px;
}

.guides-filters label {
  display: grid;
  gap: 8px;
}

.guides-filters span {
  color: var(--color-muted);
  font-size: 13px;
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
</style>
