<script setup lang="ts">
import { loadSearchIndex } from '~/utils/search-index'
import { isContentLocale, type ContentLocale } from '~/utils/site-locale'

type SearchIndexItem = {
  path: string
  title: string
  summary?: string
  lang: ContentLocale
  categoryL1: string
  categoryL2: string
  authorId: string
  authorName: string
  tags?: string[]
  updatedAt: string
  stage?: string | number
}

type TocLink = {
  id?: string
  text?: string
  children?: TocLink[]
}

type ContentBody = {
  toc?: {
    links?: TocLink[]
  }
}

type ContentPage = {
  path?: string
  stem?: string
  lang?: ContentLocale
  translationKey?: string
  routeKey?: string
  title?: string
  summary?: string
  description?: string
  categoryL1?: string
  categoryL2?: string
  authorId?: string
  authorName?: string
  createdAt?: string
  updatedAt?: string
  tags?: string[]
  difficulty?: string
  buildType?: string
  body?: ContentBody
  __missing?: boolean
}

const route = useRoute()
const router = useRouter()

const normalizeContentRouteKey = (routeKey: unknown): string => {
  return String(routeKey || '')
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/{2,}/g, '/')
}

const buildStableContentPath = (item: Pick<ContentPage, 'lang' | 'routeKey'>): string => {
  const lang = String(item.lang || '')
  const routeKey = normalizeContentRouteKey(item.routeKey)
  return lang && routeKey ? `/${lang}/${routeKey}` : ''
}

const resolveRoutePathVariants = (rawPath: string) => {
  const normalizedRaw = rawPath.startsWith('/') ? rawPath : `/${rawPath}`
  let decodedPath = normalizedRaw

  try {
    decodedPath = decodeURIComponent(normalizedRaw)
  } catch {
    decodedPath = normalizedRaw
  }

  return {
    normalizedRaw,
    decodedPath,
    decodedStem: decodedPath.replace(/^\/+/, '')
  }
}

const { data: page } = await useAsyncData<ContentPage>(
  () => `content-page-${route.path}`,
  async () => {
    try {
      const { normalizedRaw, decodedPath, decodedStem } = resolveRoutePathVariants(route.path)

      let doc = await queryCollection('content').path(normalizedRaw).first()
      if (!doc && decodedPath !== normalizedRaw) {
        doc = await queryCollection('content').path(decodedPath).first()
      }

      // Fallback for non-ASCII folder names: Content path may be slug-normalized,
      // while stem keeps the source-relative path (with original CJK chars).
      if (!doc) {
        const allDocs = await queryCollection('content').all()
        doc = allDocs.find((item) => {
          const itemPath = String(item.path || '')
          const itemStem = String(item.stem || '')
          const stablePath = buildStableContentPath(item as ContentPage)
          return itemPath === decodedPath
            || itemStem === decodedStem
            || stablePath === decodedPath
            || stablePath === normalizedRaw
        })
      }

      if (doc) {
        return {
          ...(doc as ContentPage),
          __missing: false
        }
      }
      return { __missing: true, path: decodedPath, stem: decodedStem }
    } catch (error) {
      console.error('[content] failed to load page', route.path, error)
      return { __missing: true, path: route.path }
    }
  },
  { watch: [() => route.path] }
)

const pathSegments = computed(() => route.path.split('/').filter(Boolean))
const locale = computed<ContentLocale>(() => {
  const lang = String(page.value?.lang || pathSegments.value[0] || 'zh')
  return isContentLocale(lang) ? lang : 'zh'
})

const pageText = computed(() => {
  const textMap: Record<ContentLocale, {
    home: string
    notFoundTitle: string
    notFoundDescription: string
    author: string
    createdAt: string
    updatedAt: string
    category: string
    articleInfoAria: string
    stageBrowserTitle: string
    stageBrowserHint: string
    allStages: string
    noStageMatches: string
    stagePrefix: string
    stageSuffix: string
    tocTitle: string
    guideFallback: string
    specialStages: Record<string, string>
  }> = {
    zh: {
      home: '首页',
      notFoundTitle: '页面不存在',
      notFoundDescription: '未找到对应的 Markdown 页面。',
      author: '作者',
      createdAt: '创作日期',
      updatedAt: '更新日期',
      category: '分类',
      articleInfoAria: '攻略信息',
      stageBrowserTitle: '关卡横向筛选',
      stageBrowserHint: '点击后可直接跳转到攻略对应章节锚点',
      allStages: '全部',
      noStageMatches: '当前筛选下暂无攻略。',
      stagePrefix: '第',
      stageSuffix: '层',
      tocTitle: '本文目录',
      guideFallback: '攻略',
      specialStages: {
        afk: '挂机',
        extra: '番外'
      }
    },
    en: {
      home: 'Home',
      notFoundTitle: 'Page not found',
      notFoundDescription: 'The Markdown page could not be found.',
      author: 'Author',
      createdAt: 'Created',
      updatedAt: 'Updated',
      category: 'Category',
      articleInfoAria: 'Guide info',
      stageBrowserTitle: 'Stage browser',
      stageBrowserHint: 'Click a floor to jump to the matching section anchor',
      allStages: 'All',
      noStageMatches: 'No guides match the current filter.',
      stagePrefix: 'Floor',
      stageSuffix: '',
      tocTitle: 'Contents',
      guideFallback: 'Guide',
      specialStages: {
        afk: 'AFK route',
        extra: 'Extra stage'
      }
    },
    vi: {
      home: 'Trang chủ',
      notFoundTitle: 'Không tìm thấy trang',
      notFoundDescription: 'Không tìm thấy trang Markdown tương ứng.',
      author: 'Tác giả',
      createdAt: 'Ngày tạo',
      updatedAt: 'Ngày cập nhật',
      category: 'Danh mục',
      articleInfoAria: 'Thông tin hướng dẫn',
      stageBrowserTitle: 'Bộ lọc tầng',
      stageBrowserHint: 'Bấm để nhảy thẳng tới mục tương ứng',
      allStages: 'Tất cả',
      noStageMatches: 'Không có hướng dẫn nào khớp bộ lọc hiện tại.',
      stagePrefix: 'Tầng',
      stageSuffix: '',
      tocTitle: 'Mục lục',
      guideFallback: 'hướng dẫn',
      specialStages: {
        afk: 'AFK',
        extra: 'Ngoại truyện'
      }
    }
  }

  return textMap[locale.value] || textMap.zh
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

  if (typeof stage === 'number') {
    return locale.value === 'en'
      ? `${pageText.value.stagePrefix} ${stage}`
      : `${pageText.value.stagePrefix} ${stage}${pageText.value.stageSuffix ? ` ${pageText.value.stageSuffix}` : ''}`
  }

  const normalizedStage = String(stage).trim().toLowerCase()
  return pageText.value.specialStages[normalizedStage] || String(stage)
}

function decodeBreadcrumbLabel(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

const breadcrumbs = computed(() => {
  const segments = route.path.split('/').filter(Boolean)
  const items = [{ label: pageText.value.home, href: '/' as string | undefined }]
  let cursor = ''

  segments.forEach((segment) => {
    cursor += `/${segment}`
    items.push({
      label: decodeBreadcrumbLabel(segment),
      href: cursor as string | undefined
    })
  })

  if (items.length > 1) {
    items[items.length - 1].href = undefined
  }

  return items
})

const articleTocLinks = computed<TocLink[]>(() => {
  return page.value?.body?.toc?.links ?? []
})

const hasArticleToc = computed(() => {
  return articleTocLinks.value.some((link) => link.id && link.text)
})

const difficultyLabels: Record<ContentLocale, Record<string, string>> = {
  zh: {
    beginner: '入门',
    intermediate: '进阶',
    advanced: '高阶'
  },
  en: {
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced'
  },
  vi: {
    beginner: 'Cơ bản',
    intermediate: 'Trung cấp',
    advanced: 'Nâng cao'
  }
}

const buildTypeLabels: Record<ContentLocale, Record<string, string>> = {
  zh: {
    budget: '低配',
    'full-clear': '全层通关',
    'high-score': '高分',
    preview: '协作包预览',
    pvp: '斗技',
    speedrun: '竞速'
  },
  en: {
    budget: 'Budget',
    'full-clear': 'Full clear',
    'high-score': 'High score',
    preview: 'Collaboration preview',
    pvp: 'PvP',
    speedrun: 'Speedrun'
  },
  vi: {
    budget: 'Đội hình tiết kiệm',
    'full-clear': 'Toàn bộ tầng',
    'high-score': 'Điểm cao',
    preview: 'Xem trước gói cộng tác',
    pvp: 'PvP',
    speedrun: 'Đua tốc'
  }
}

function formatDate(value: string | undefined): string {
  if (!value) {
    return ''
  }

  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) {
    return value
  }

  const formatterLocale = locale.value === 'vi'
    ? 'vi-VN'
    : locale.value === 'en'
      ? 'en-US'
      : 'zh-CN'

  return new Intl.DateTimeFormat(formatterLocale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(timestamp))
}

const createdDateLabel = computed(() => formatDate(page.value?.createdAt || page.value?.updatedAt))
const updatedDateLabel = computed(() => formatDate(page.value?.updatedAt))
const authorPagePath = computed(() => {
  const authorId = page.value?.authorId?.trim()
  if (!authorId || authorId === 'official') {
    return ''
  }
  return `/${locale.value}/authors/${authorId}`
})

const difficultyLabel = computed(() => {
  const difficulty = page.value?.difficulty
  return difficulty ? difficultyLabels[locale.value]?.[difficulty] || difficulty : ''
})

const buildTypeLabel = computed(() => {
  const buildType = page.value?.buildType
  return buildType ? buildTypeLabels[locale.value]?.[buildType] || buildType : ''
})

const showArticleMeta = computed(() => {
  return Boolean(
    page.value?.authorName
      || page.value?.authorId
      || page.value?.createdAt
      || page.value?.updatedAt
      || page.value?.categoryL1
      || page.value?.categoryL2
      || page.value?.difficulty
      || page.value?.buildType
      || page.value?.tags?.length
  )
})
</script>

<template>
  <div v-if="page && !page.__missing">
    <PageHeader
      v-if="page.title"
      :title="page.title"
      :description="page.description || page.summary"
      :breadcrumbs="breadcrumbs"
      :breadcrumb-aria-label="locale === 'vi' ? 'Điều hướng breadcrumb' : locale === 'en' ? 'Breadcrumb navigation' : '面包屑导航'"
    />

    <section
      class="site-container fallback-content"
      :class="{ 'has-toc': hasArticleToc }"
    >
      <aside v-if="hasArticleToc" class="article-toc-sidebar">
        <ArticleToc :toc="articleTocLinks" :title="pageText.tocTitle" />
      </aside>

      <div class="fallback-main">
        <ArticleToc
          v-if="hasArticleToc"
          :toc="articleTocLinks"
          :title="pageText.tocTitle"
          collapsible
          class="article-toc-inline"
        />

        <section v-if="showArticleMeta" class="card article-meta" :aria-label="pageText.articleInfoAria">
          <div class="article-meta-primary">
            <div class="article-meta-item">
              <span>{{ pageText.author }}</span>
              <NuxtLink v-if="authorPagePath" :to="authorPagePath">{{ page.authorName || page.authorId }}</NuxtLink>
              <strong v-else>{{ page.authorName || page.authorId || '-' }}</strong>
            </div>
            <div v-if="createdDateLabel" class="article-meta-item">
              <span>{{ pageText.createdAt }}</span>
              <strong>{{ createdDateLabel }}</strong>
            </div>
            <div v-if="updatedDateLabel" class="article-meta-item">
              <span>{{ pageText.updatedAt }}</span>
              <strong>{{ updatedDateLabel }}</strong>
            </div>
            <div v-if="page.categoryL1 || page.categoryL2" class="article-meta-item">
              <span>{{ pageText.category }}</span>
              <strong>{{ [page.categoryL1, page.categoryL2].filter(Boolean).join(' / ') }}</strong>
            </div>
          </div>

          <div
            v-if="difficultyLabel || buildTypeLabel || page.tags?.length"
            class="article-meta-secondary"
          >
            <span v-if="difficultyLabel">{{ difficultyLabel }}</span>
            <span v-if="buildTypeLabel">{{ buildTypeLabel }}</span>
            <span v-for="tag in page.tags || []" :key="tag">{{ tag }}</span>
          </div>
        </section>

        <article class="card fallback-article">
          <div class="wiki-prose">
            <ContentRenderer :value="page" />
          </div>
        </article>

        <section v-if="isStageHub && topicEntries.length" class="card stage-browser">
          <div class="stage-browser-head">
            <h2>{{ pageText.stageBrowserTitle }}</h2>
            <small>{{ pageText.stageBrowserHint }}</small>
          </div>

          <div class="stage-tabs">
            <button
              type="button"
              :class="{ 'is-active': selectedStage === 'all' }"
              @click="selectedStage = 'all'"
            >
              {{ pageText.allStages }}
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
              <p>{{ item.summary || `${item.categoryL1} / ${item.categoryL2} ${pageText.guideFallback}` }}</p>
              <div class="stage-guide-tail">
                <span>{{ item.categoryL1 }} / {{ item.categoryL2 }}</span>
                <span v-if="item.stage !== undefined">{{ formatStage(item.stage) }}</span>
              </div>
            </NuxtLink>
          </div>
          <p v-else class="stage-empty">{{ pageText.noStageMatches }}</p>
        </section>
      </div>
    </section>
  </div>

  <div v-else>
    <PageHeader
      :title="pageText.notFoundTitle"
      :description="pageText.notFoundDescription"
      :breadcrumb-aria-label="locale === 'vi' ? 'Điều hướng breadcrumb' : locale === 'en' ? 'Breadcrumb navigation' : '面包屑导航'"
      :breadcrumbs="[
        { label: pageText.home, href: '/' },
        { label: pageText.notFoundTitle }
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

.fallback-content.has-toc {
  grid-template-columns: 220px minmax(0, 1fr);
  align-items: start;
  gap: 18px;
}

.article-toc-sidebar {
  position: sticky;
  top: 92px;
  max-height: calc(100vh - 116px);
  overflow: auto;
  padding: 14px 2px 14px 0;
}

.fallback-main {
  min-width: 0;
  display: grid;
  gap: 14px;
}

.article-toc-inline {
  display: none;
}

.fallback-article {
  padding: 22px;
  min-width: 0;
}

.article-meta {
  padding: 14px 16px;
  min-width: 0;
}

.article-meta-primary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.article-meta-item {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.article-meta-item span {
  color: var(--color-muted);
  font-size: 12px;
}

.article-meta-item strong,
.article-meta-item a {
  color: var(--color-foreground);
  font-size: 14px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.article-meta-item a:hover {
  color: var(--color-primary);
}

.article-meta-secondary {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.article-meta-secondary span {
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 3px 8px;
  background: var(--color-surface-soft);
  color: var(--color-muted);
  font-size: 12px;
}

.stage-browser {
  padding: 16px;
  min-width: 0;
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

@media (max-width: 900px) {
  .fallback-content.has-toc {
    grid-template-columns: 1fr;
  }

  .article-toc-sidebar {
    display: none;
  }

  .article-toc-inline {
    display: block;
  }

  .article-meta-primary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .article-meta-primary {
    grid-template-columns: 1fr;
  }
}
</style>
