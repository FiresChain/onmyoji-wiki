<script setup lang="ts">
import { getAuthorProfile } from '~/utils/author-profiles'
import { loadSearchIndex } from '~/utils/search-index'

type SearchIndexItem = {
  path: string
  lang: 'zh' | 'en'
  authorId: string
  authorName: string
  tags?: string[]
  updatedAt: string
}

type AuthorCard = {
  id: string
  title: string
  summary: string
  tagline: string
  tags: string[]
  guideCount: number
  updatedAt: string
}

const { data: indexItems } = await useAsyncData('authors-search-index', async () => {
  const [zh, en] = await Promise.all([
    loadSearchIndex<SearchIndexItem>('zh'),
    loadSearchIndex<SearchIndexItem>('en')
  ])
  return [...zh, ...en]
})

const authorList = computed<AuthorCard[]>(() => {
  const map = new Map<
    string,
    {
      id: string
      name: string
      tags: Set<string>
      guidePathSet: Set<string>
      updatedAt: string
    }
  >()

  for (const item of indexItems.value ?? []) {
    if (!item.authorId || item.authorId === 'official') {
      continue
    }

    const basePath = item.path.split('#')[0]
    const key = `${item.lang}|${basePath}`
    const existing = map.get(item.authorId)
    const tags = Array.isArray(item.tags) ? item.tags : []

    if (!existing) {
      map.set(item.authorId, {
        id: item.authorId,
        name: item.authorName || item.authorId,
        tags: new Set(tags),
        guidePathSet: new Set([key]),
        updatedAt: item.updatedAt
      })
      continue
    }

    tags.forEach((tag) => existing.tags.add(tag))
    existing.guidePathSet.add(key)
    if (item.updatedAt > existing.updatedAt) {
      existing.updatedAt = item.updatedAt
      existing.name = item.authorName || existing.name
    }
  }

  return Array.from(map.values())
    .map((author) => {
      const profile = getAuthorProfile(author.id, author.name)
      return {
        id: author.id,
        title: profile.name,
        summary: profile.bio,
        tagline: profile.tagline,
        tags: Array.from(new Set([...profile.specialties, ...author.tags])).slice(0, 8),
        guideCount: author.guidePathSet.size,
        updatedAt: author.updatedAt
      }
    })
    .sort((a, b) => {
      if (b.guideCount !== a.guideCount) {
        return b.guideCount - a.guideCount
      }
      return String(b.updatedAt).localeCompare(String(a.updatedAt))
    })
})
</script>

<template>
  <div>
    <PageHeader
      title="创作者"
      description="每位创作者均有独立主页，含自我介绍与文章列表。"
      :breadcrumbs="[
        { label: '首页', href: '/' },
        { label: '创作者' }
      ]"
    />

    <section class="site-container authors-page">
      <div class="authors-grid">
        <NuxtLink
          v-for="author in authorList"
          :key="author.id"
          :to="`/authors/${author.id}`"
          class="author-card card"
        >
          <div class="author-avatar">
            <div>作者</div>
          </div>
          <h2>{{ author.title }}</h2>
          <p class="author-tagline">{{ author.tagline }}</p>
          <p>{{ author.summary }}</p>
          <p class="author-meta">攻略数：{{ author.guideCount }} · 最近更新：{{ author.updatedAt }}</p>
          <div class="author-tags">
            <span v-for="tag in author.tags" :key="tag">{{ tag }}</span>
          </div>
        </NuxtLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.authors-page {
  padding: 24px 0 38px;
}

.authors-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.author-card {
  display: block;
  padding: 16px;
}

.author-card:hover {
  border-color: color-mix(in srgb, var(--color-primary) 45%, var(--color-border));
}

.author-avatar {
  width: 74px;
  height: 74px;
  border-radius: 50%;
  overflow: hidden;
  border: 1px solid var(--color-border);
  background: var(--color-surface-soft);
}

.author-avatar > div {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  color: var(--color-muted);
  font-size: 13px;
}

.author-card h2 {
  margin: 12px 0 0;
  font-size: 20px;
}

.author-card p {
  margin: 8px 0 0;
  color: var(--color-muted);
}

.author-tagline {
  color: var(--color-foreground);
  font-weight: 500;
}

.author-meta {
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

@media (max-width: 980px) {
  .authors-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 700px) {
  .authors-grid {
    grid-template-columns: 1fr;
  }
}
</style>
