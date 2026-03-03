<script setup lang="ts">
import { getAuthorProfile } from '~/utils/author-profiles'
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

type AuthorGuide = {
  path: string
  title: string
  summary: string
  lang: 'zh' | 'en'
  categoryL1: string
  categoryL2: string
  tags: string[]
  updatedAt: string
  stages: Array<string | number>
}

const route = useRoute()
const authorId = computed(() => String(route.params.id || '').trim())

const { data: indexItems } = await useAsyncData(
  () => `author-index-${authorId.value}`,
  async () => {
    const [zh, en] = await Promise.all([
      loadSearchIndex<SearchIndexItem>('zh'),
      loadSearchIndex<SearchIndexItem>('en')
    ])
    return [...zh, ...en]
  },
  { watch: [authorId] }
)

const authorRawItems = computed(() => {
  return (indexItems.value ?? []).filter((item) => item.authorId === authorId.value)
})

const authorProfile = computed(() => {
  const name = authorRawItems.value[0]?.authorName
  return getAuthorProfile(authorId.value, name)
})

const authorGuides = computed<AuthorGuide[]>(() => {
  const map = new Map<string, AuthorGuide>()

  for (const item of authorRawItems.value) {
    const basePath = item.path.split('#')[0]
    const key = `${item.lang}|${basePath}`
    const tags = Array.isArray(item.tags) ? item.tags : []
    const summary = item.summary?.trim() || `${item.categoryL1} / ${item.categoryL2} 攻略`

    const existing = map.get(key)
    if (!existing) {
      map.set(key, {
        path: basePath,
        title: item.title,
        summary,
        lang: item.lang,
        categoryL1: item.categoryL1,
        categoryL2: item.categoryL2,
        tags,
        updatedAt: item.updatedAt,
        stages: item.stage === undefined ? [] : [item.stage]
      })
      continue
    }

    existing.tags = Array.from(new Set([...existing.tags, ...tags]))
    if (item.stage !== undefined && !existing.stages.includes(item.stage)) {
      existing.stages.push(item.stage)
    }
    if (item.updatedAt > existing.updatedAt) {
      existing.updatedAt = item.updatedAt
      existing.title = item.title
      existing.summary = summary
      existing.categoryL1 = item.categoryL1
      existing.categoryL2 = item.categoryL2
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

const guideCount = computed(() => authorGuides.value.length)
const hasAuthor = computed(() => Boolean(authorId.value) && guideCount.value > 0)

const mergedTags = computed(() => {
  const tags = new Set<string>()
  authorProfile.value.specialties.forEach((tag) => tags.add(tag))
  authorGuides.value.forEach((guide) => {
    guide.tags.forEach((tag) => tags.add(tag))
  })
  return Array.from(tags).slice(0, 12)
})
</script>

<template>
  <div v-if="hasAuthor">
    <PageHeader
      :title="authorProfile.name"
      :description="authorProfile.tagline"
      :breadcrumbs="[
        { label: '首页', href: '/' },
        { label: '创作者', href: '/authors' },
        { label: authorProfile.name }
      ]"
    />

    <section class="site-container author-detail">
      <section class="card author-profile">
        <div class="author-profile-top">
          <div class="author-avatar">作者</div>
          <div>
            <h2>{{ authorProfile.name }}</h2>
            <p class="tagline">{{ authorProfile.tagline }}</p>
          </div>
        </div>
        <p class="bio">{{ authorProfile.bio }}</p>
        <p class="meta">共发布 {{ guideCount }} 篇攻略（JS 动态加载）</p>
        <div class="author-tags">
          <span v-for="tag in mergedTags" :key="tag">{{ tag }}</span>
        </div>
      </section>

      <section class="author-guides">
        <h2>该作者攻略</h2>
        <div class="guides-grid">
          <NuxtLink v-for="guide in authorGuides" :key="guide.path" :to="guide.path" class="guide-card card">
            <div class="guide-meta">
              <span>{{ guide.categoryL1 }} / {{ guide.categoryL2 }}</span>
              <small>{{ guide.lang.toUpperCase() }} · {{ guide.updatedAt }}</small>
            </div>
            <h3>{{ guide.title }}</h3>
            <p>{{ guide.summary }}</p>
            <div v-if="guide.stages.length" class="guide-stages">
              覆盖层数：{{ guide.stages.join(' / ') }}
            </div>
          </NuxtLink>
        </div>
      </section>
    </section>
  </div>

  <div v-else>
    <PageHeader
      title="作者不存在"
      description="未找到该作者或该作者尚无文章。"
      :breadcrumbs="[
        { label: '首页', href: '/' },
        { label: '创作者', href: '/authors' },
        { label: '未找到' }
      ]"
    />
  </div>
</template>

<style scoped>
.author-detail {
  padding: 24px 0 40px;
  display: grid;
  gap: 18px;
}

.author-profile {
  padding: 18px;
}

.author-profile-top {
  display: flex;
  align-items: center;
  gap: 12px;
}

.author-avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  border: 1px solid var(--color-border);
  background: var(--color-surface-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-muted);
  font-size: 13px;
}

.author-profile h2 {
  margin: 0;
  font-size: 24px;
}

.tagline {
  margin: 4px 0 0;
  color: var(--color-muted);
}

.bio {
  margin: 14px 0 0;
  color: var(--color-foreground);
  line-height: 1.7;
}

.meta {
  margin: 10px 0 0;
  color: var(--color-muted);
  font-size: 13px;
}

.author-tags {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.author-tags span {
  border-radius: 6px;
  background: var(--color-surface-soft);
  color: var(--color-muted);
  font-size: 12px;
  padding: 2px 6px;
}

.author-guides h2 {
  margin: 0 0 12px;
  font-size: 22px;
}

.guides-grid {
  display: grid;
  gap: 12px;
}

.guide-card {
  display: block;
  padding: 14px;
}

.guide-card:hover {
  border-color: color-mix(in srgb, var(--color-primary) 45%, var(--color-border));
}

.guide-meta {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  color: var(--color-muted);
  font-size: 12px;
}

.guide-card h3 {
  margin: 8px 0 0;
  font-size: 18px;
}

.guide-card p {
  margin: 8px 0 0;
  color: var(--color-muted);
}

.guide-stages {
  margin-top: 8px;
  font-size: 12px;
  color: var(--color-muted);
}
</style>
