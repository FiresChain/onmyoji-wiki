<script setup lang="ts">
import { getAuthorProfile } from '~/utils/author-profiles'
import { loadSearchIndex } from '~/utils/search-index'
import { getContentLocaleFromPath } from '~/utils/site-locale'

definePageMeta({
  path: '/:locale(zh|en)/authors/:id',
  alias: ['/authors/:id']
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
const contentLocale = computed<'zh' | 'en'>(() => getContentLocaleFromPath(route.path) || 'zh')
const runtimeConfig = useRuntimeConfig()
const resolvePublicAssetUrl = (path?: string) => {
  if (!path) {
    return ''
  }
  if (/^https?:\/\//.test(path)) {
    return path
  }

  const normalizedPath = path.startsWith('/') ? path.slice(1) : path
  const base = runtimeConfig.app.baseURL || '/'
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  return `${normalizedBase}${normalizedPath}`
}

const { data: authorStaticDoc } = await useAsyncData(
  () => `author-static-doc-${authorId.value}-${contentLocale.value}`,
  async () => {
    if (!authorId.value) {
      return null
    }

    const docs = await queryCollection('authors').all().catch(() => [])
    return (
      docs.find((doc) => doc.authorId === authorId.value && doc.lang === contentLocale.value) ||
      docs.find((doc) => doc.authorId === authorId.value && doc.lang === 'zh') ||
      null
    )
  },
  { watch: [authorId, contentLocale] }
)

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
const hasAuthor = computed(() => Boolean(authorId.value) && (guideCount.value > 0 || Boolean(authorStaticDoc.value)))
const displayTagline = computed(() => authorStaticDoc.value?.tagline || authorProfile.value.tagline)
const displayHeroTitle = computed(() => {
  return authorStaticDoc.value?.heroTitle || `${authorProfile.value.name}的空间`
})
const displayHeroSubtitle = computed(() => authorStaticDoc.value?.heroSubtitle || '')
const bilibiliUrl = computed(() => authorStaticDoc.value?.bilibiliUrl?.trim() || '')
const displayAvatar = computed(() => resolvePublicAssetUrl(authorProfile.value.avatar?.trim()))
const isAvatarBroken = ref(false)
watch(authorId, () => {
  isAvatarBroken.value = false
})

const mergedTags = computed(() => {
  const tags = new Set<string>()
  authorProfile.value.specialties.forEach((tag) => tags.add(tag))
  ;(authorStaticDoc.value?.highlights || []).forEach((tag) => tags.add(tag))
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
      :description="displayTagline"
      :breadcrumbs="[
        { label: '首页', href: '/' },
        { label: '创作者', href: '/authors' },
        { label: authorProfile.name }
      ]"
    />

    <section class="site-container author-detail">
      <div class="author-main">
        <section v-if="authorStaticDoc" class="card author-space">
          <header class="author-space-hero">
            <h3>{{ displayHeroTitle }}</h3>
            <p v-if="displayHeroSubtitle">{{ displayHeroSubtitle }}</p>
          </header>
          <div v-if="authorStaticDoc.highlights?.length" class="author-space-highlights">
            <span v-for="tag in authorStaticDoc.highlights" :key="tag">{{ tag }}</span>
          </div>
          <div class="author-space-body">
            <ContentRenderer :value="authorStaticDoc" />
          </div>
        </section>

        <section v-if="authorGuides.length" class="author-guides">
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
        <section v-else class="card guides-empty">
          该作者暂时还没有公开攻略，后续会持续更新。
        </section>
      </div>

      <aside class="author-side">
        <section class="card author-profile">
          <div class="author-profile-top">
            <div class="author-avatar">
              <img
                v-if="displayAvatar && !isAvatarBroken"
                :src="displayAvatar"
                :alt="`${authorProfile.name} 头像`"
                loading="lazy"
                decoding="async"
                @error="isAvatarBroken = true"
              >
              <span v-else>作者</span>
            </div>
            <div class="author-title-wrap">
              <h2>{{ authorProfile.name }}</h2>
              <p class="tagline">{{ displayTagline }}</p>
            </div>
          </div>
          <p class="bio">{{ authorProfile.bio }}</p>
          <p class="meta">共发布 {{ guideCount }} 篇攻略</p>
          <a
            v-if="bilibiliUrl"
            class="bilibili-link"
            :href="bilibiliUrl"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span class="bilibili-icon" aria-hidden="true">
              <svg viewBox="0 0 1024 1024" role="img">
                <path
                  d="M702.1 304.1h-380c-74.6 0-135 60.4-135 135v182.8c0 74.6 60.4 135 135 135h380c74.6 0 135-60.4 135-135V439.1c0-74.6-60.4-135-135-135zM547.7 575.3c0 9.7-7.9 17.6-17.6 17.6H494c-9.7 0-17.6-7.9-17.6-17.6v-89c0-9.7 7.9-17.6 17.6-17.6h36.1c9.7 0 17.6 7.9 17.6 17.6v89zm176.9 0c0 9.7-7.9 17.6-17.6 17.6h-36.1c-9.7 0-17.6-7.9-17.6-17.6v-89c0-9.7 7.9-17.6 17.6-17.6H707c9.7 0 17.6 7.9 17.6 17.6v89zM361.5 256.7c12.1-12.1 12.1-31.7 0-43.8l-74.8-74.8c-12.1-12.1-31.7-12.1-43.8 0-12.1 12.1-12.1 31.7 0 43.8l74.8 74.8c12.1 12.1 31.7 12.1 43.8 0zm419.6 0c12.1-12.1 12.1-31.7 0-43.8-12.1-12.1-31.7-12.1-43.8 0l-74.8 74.8c-12.1 12.1-12.1 31.7 0 43.8 12.1 12.1 31.7 12.1 43.8 0l74.8-74.8z"
                />
              </svg>
            </span>
            <span>Bilibili 主页</span>
          </a>
          <div class="author-tags">
            <span v-for="tag in mergedTags" :key="tag">{{ tag }}</span>
          </div>
        </section>
      </aside>
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
  grid-template-columns: minmax(0, 1fr) 304px;
  gap: 16px;
  align-items: start;
}

.author-main {
  display: grid;
  gap: 16px;
}

.author-side {
  position: sticky;
  top: 80px;
}

.author-profile {
  padding: 14px 14px 16px;
  display: grid;
  gap: 12px;
}

.author-profile-top {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}

.author-title-wrap h2 {
  margin: 0;
  font-size: 22px;
}

.author-title-wrap .tagline {
  margin-top: 4px;
}

.author-avatar {
  width: 88px;
  height: 88px;
  border-radius: 50%;
  border: 1px solid var(--color-border);
  background: var(--color-surface-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-muted);
  font-size: 13px;
}

.author-avatar span {
  display: inline-flex;
}

.author-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.tagline {
  margin: 0;
  color: var(--color-muted);
  line-height: 1.5;
  font-size: 13px;
}

.bio {
  margin: 0;
  color: var(--color-foreground);
  line-height: 1.75;
  font-size: 14px;
}

.meta {
  margin: 0;
  color: var(--color-muted);
  font-size: 13px;
}

.bilibili-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: fit-content;
  text-decoration: none;
  color: #00a1d6;
  font-weight: 600;
  font-size: 14px;
}

.bilibili-link:hover {
  text-decoration: underline;
}

.bilibili-icon {
  width: 18px;
  height: 18px;
  display: inline-flex;
  color: currentColor;
}

.bilibili-icon svg {
  width: 100%;
  height: 100%;
  fill: currentColor;
}

.author-tags {
  margin: 0;
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

.author-space {
  padding: 16px;
}

.author-space-hero h3 {
  margin: 0;
  font-size: 20px;
}

.author-space-hero p {
  margin: 6px 0 0;
  color: var(--color-muted);
}

.author-space-highlights {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.author-space-highlights span {
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-primary) 16%, var(--color-surface-soft));
  color: var(--color-primary);
  padding: 3px 10px;
  font-size: 12px;
}

.author-space-body {
  margin-top: 12px;
  color: var(--color-foreground);
  line-height: 1.8;
}

.guides-empty {
  padding: 14px;
  color: var(--color-muted);
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

@media (max-width: 1080px) {
  .author-detail {
    grid-template-columns: 1fr;
  }

  .author-side {
    position: static;
  }
}
</style>
