<script setup lang="ts">
definePageMeta({
  path: '/:locale(zh|en)/guides/:slug'
})

type GuideDoc = {
  path: string
  title?: string
  summary?: string
  description?: string
  category?: string
  tags?: string[]
  author?: string
  authorName?: string
  updatedAt?: string
}

type GuidePage = {
  path?: string
  title?: string
  summary?: string
  description?: string
  category?: string
  tags?: string[]
  author?: string
  authorName?: string
  updatedAt?: string
  body?: unknown
  __missing?: boolean
}

const route = useRoute()
const slug = computed(() => String(route.params.slug || ''))
const guidePath = computed(() => `/guides/${slug.value}`)

const { data: page } = await useAsyncData<GuidePage>(
  () => `guide-${guidePath.value}`,
  async () => {
    try {
      const doc = await queryCollection('content').path(guidePath.value).first()
      if (doc) {
        return {
          ...(doc as GuidePage),
          __missing: false
        }
      }
      return { __missing: true, path: guidePath.value }
    } catch (error) {
      console.error('[content] failed to load guide', guidePath.value, error)
      return { __missing: true, path: guidePath.value }
    }
  },
  { watch: [guidePath] }
)

const { data: docs } = await useAsyncData('guide-related-documents', () => {
  return queryCollection('content').all().catch((error) => {
    console.error('[content] failed to load guide index', error)
    return []
  })
})

const relatedGuides = computed<GuideDoc[]>(() => {
  if (!page.value?.path) return []
  return (docs.value ?? [])
    .filter((doc): doc is GuideDoc => {
      return typeof doc.path === 'string' && doc.path.startsWith('/guides/')
    })
    .filter((doc) => doc.path !== page.value?.path)
    .filter((doc) => {
      if (!page.value?.category) return true
      return doc.category === page.value.category
    })
    .slice(0, 3)
})
</script>

<template>
  <div v-if="page && !page.__missing">
    <PageHeader
      :title="page.title || '攻略详情'"
      :description="page.summary || page.description"
      :breadcrumbs="[
        { label: '首页', href: '/' },
        { label: '攻略中心', href: '/guides' },
        { label: page.title || '详情' }
      ]"
    />

    <section class="site-container guide-detail">
      <div class="guide-meta card">
        <span class="guide-chip">{{ page.category || '攻略' }}</span>
        <span>作者：{{ page.authorName || page.author || '-' }}</span>
        <span>更新：{{ page.updatedAt || '-' }}</span>
        <div class="guide-meta-tags">
          <span v-for="tag in page.tags || []" :key="tag">{{ tag }}</span>
        </div>
      </div>

      <article class="guide-article card">
        <div class="wiki-prose">
          <ContentRenderer :value="page" />
        </div>
      </article>

      <section v-if="relatedGuides.length" class="guide-related">
        <h2>相关攻略</h2>
        <div class="guide-related-grid">
          <NuxtLink v-for="guide in relatedGuides" :key="guide.path" :to="guide.path" class="guide-related-card card">
            <small>{{ guide.category || '攻略' }}</small>
            <h3>{{ guide.title }}</h3>
            <p>{{ guide.summary || guide.description }}</p>
          </NuxtLink>
        </div>
      </section>
    </section>
  </div>
  <div v-else>
    <PageHeader
      title="攻略不存在"
      description="未找到对应文档，请确认 markdown 文件路径。"
      :breadcrumbs="[
        { label: '首页', href: '/' },
        { label: '攻略中心', href: '/guides' },
        { label: '未找到' }
      ]"
    />
  </div>
</template>

<style scoped>
.guide-detail {
  padding: 24px 0 40px;
}

.guide-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  color: var(--color-muted);
  font-size: 13px;
}

.guide-chip {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 3px 10px;
  background: var(--color-surface-soft);
  color: var(--color-foreground);
}

.guide-meta-tags {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 6px;
}

.guide-meta-tags span {
  background: var(--color-surface-soft);
  border-radius: 6px;
  padding: 2px 8px;
}

.guide-article {
  margin-top: 14px;
  padding: 22px;
}

.guide-related {
  margin-top: 28px;
}

.guide-related h2 {
  margin: 0 0 12px;
  font-size: 24px;
}

.guide-related-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.guide-related-card {
  display: block;
  padding: 14px;
}

.guide-related-card:hover {
  border-color: color-mix(in srgb, var(--color-primary) 45%, var(--color-border));
}

.guide-related-card small {
  color: var(--color-muted);
}

.guide-related-card h3 {
  margin: 6px 0 0;
  font-size: 18px;
}

.guide-related-card p {
  margin: 8px 0 0;
  color: var(--color-muted);
}

@media (max-width: 980px) {
  .guide-related-grid {
    grid-template-columns: 1fr;
  }
}
</style>
