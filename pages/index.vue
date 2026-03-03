<script setup lang="ts">
type ContentDoc = {
  path: string
  title?: string
  description?: string
  summary?: string
  tags?: string[]
  rarity?: string
  avatar?: string
  updatedAt?: string
  category?: string
}

const { data: docs } = await useAsyncData('home-documents', () => {
  return queryCollection('content').all().catch((error) => {
    console.error('[content] failed to load home documents', error)
    return []
  })
})

const shikigamiDocs = computed<ContentDoc[]>(() => {
  return (docs.value ?? [])
    .filter((doc): doc is ContentDoc => {
      return typeof doc.path === 'string' && doc.path.startsWith('/shikigami/')
    })
    .slice(0, 6)
})

const latestGuides = computed<ContentDoc[]>(() => {
  return (docs.value ?? [])
    .filter((doc): doc is ContentDoc => {
      return typeof doc.path === 'string' && doc.path.startsWith('/guides/')
    })
    .sort((a, b) => {
      const aTs = Date.parse(a.updatedAt || '')
      const bTs = Date.parse(b.updatedAt || '')
      if (Number.isNaN(aTs) && Number.isNaN(bTs)) return 0
      if (Number.isNaN(aTs)) return 1
      if (Number.isNaN(bTs)) return -1
      return bTs - aTs
    })
    .slice(0, 3)
})

const navCards = [
  {
    title: '式神百科',
    description: '式神图鉴、技能说明、御魂搭配',
    to: '/shikigami'
  },
  {
    title: '阴阳师',
    description: '阴阳师角色与技能信息',
    to: '/onmyoji'
  },
  {
    title: '攻略中心',
    description: '副本、PVP、新手入门攻略',
    to: '/guides'
  },
  {
    title: '创作者',
    description: '作者资料与文章合集',
    to: '/authors'
  }
]
</script>

<template>
  <div>
    <section class="home-hero">
      <div class="home-hero-overlay" />
      <div class="site-container home-hero-inner">
        <div class="home-badge">
          <span class="home-badge-dot" />
          社区驱动的游戏百科
        </div>
        <h1><span>阴阳师</span>百科</h1>
        <p>基于 Markdown 的静态内容站，整合式神图鉴、攻略正文和流程图内容展示。</p>
        <div class="home-hero-actions">
          <NuxtLink to="/shikigami" class="home-btn home-btn-primary">浏览式神</NuxtLink>
          <NuxtLink to="/guides" class="home-btn home-btn-secondary">查看攻略</NuxtLink>
        </div>
        <div class="home-stats">
          <div>
            <strong>{{ shikigamiDocs.length }}</strong>
            <span>式神收录</span>
          </div>
          <div>
            <strong>{{ latestGuides.length }}</strong>
            <span>最新攻略</span>
          </div>
          <div>
            <strong>MD</strong>
            <span>文档驱动</span>
          </div>
        </div>
      </div>
    </section>

    <section class="site-container home-nav">
      <h2>快速导航</h2>
      <div class="home-nav-grid">
        <NuxtLink v-for="card in navCards" :key="card.to" :to="card.to" class="home-nav-card card">
          <h3>{{ card.title }}</h3>
          <p>{{ card.description }}</p>
        </NuxtLink>
      </div>
    </section>

    <div class="site-container">
      <div class="divider-ornament" />
    </div>

    <section class="site-container home-feature">
      <div class="home-feature-head">
        <h2>精选式神</h2>
        <NuxtLink to="/shikigami">查看全部</NuxtLink>
      </div>
      <div class="home-feature-grid">
        <NuxtLink
          v-for="doc in shikigamiDocs"
          :key="doc.path"
          :to="doc.path"
          class="home-shikigami-card card"
        >
          <div class="home-shikigami-avatar">
            <img v-if="doc.avatar" :src="doc.avatar" :alt="doc.title || ''">
            <div v-else class="home-shikigami-fallback">式神</div>
          </div>
          <div class="home-shikigami-main">
            <div class="home-shikigami-title-row">
              <strong>{{ doc.title }}</strong>
              <span v-if="doc.rarity" class="home-rarity">{{ doc.rarity }}</span>
            </div>
            <p>{{ doc.summary || doc.description }}</p>
            <div class="home-tag-row">
              <span v-for="tag in (doc.tags || []).slice(0, 3)" :key="tag">{{ tag }}</span>
            </div>
          </div>
        </NuxtLink>
      </div>
    </section>

    <section class="site-container home-guides">
      <div class="home-feature-head">
        <h2>最新攻略</h2>
        <NuxtLink to="/guides">查看全部</NuxtLink>
      </div>
      <div class="home-guides-grid">
        <NuxtLink
          v-for="guide in latestGuides"
          :key="guide.path"
          :to="guide.path"
          class="home-guide-card card"
        >
          <div class="home-guide-meta">
            <span>{{ guide.category || '攻略' }}</span>
            <small>{{ guide.updatedAt || '-' }}</small>
          </div>
          <h3>{{ guide.title }}</h3>
          <p>{{ guide.summary || guide.description }}</p>
          <div class="home-tag-row">
            <span v-for="tag in (guide.tags || []).slice(0, 3)" :key="tag">{{ tag }}</span>
          </div>
        </NuxtLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.home-hero {
  position: relative;
  overflow: hidden;
  border-bottom: 1px solid var(--color-border);
}

.home-hero-overlay {
  position: absolute;
  inset: 0;
  opacity: 0.05;
  background-image: repeating-linear-gradient(
    45deg,
    currentColor 0,
    currentColor 1px,
    transparent 1px,
    transparent 26px
  );
}

.home-hero-inner {
  position: relative;
  text-align: center;
  padding: 72px 0 62px;
}

.home-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface) 72%, transparent);
  border-radius: 999px;
  color: var(--color-muted);
  font-size: 13px;
  padding: 6px 14px;
  margin-bottom: 16px;
}

.home-badge-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-primary);
}

.home-hero h1 {
  margin: 0;
  font-size: clamp(34px, 5vw, 64px);
  line-height: 1.1;
}

.home-hero h1 span {
  color: var(--color-primary);
}

.home-hero p {
  max-width: 740px;
  margin: 14px auto 0;
  color: var(--color-muted);
}

.home-hero-actions {
  margin-top: 24px;
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}

.home-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  border-radius: 10px;
  padding: 0 18px;
  transition: 0.2s ease;
  font-size: 14px;
}

.home-btn-primary {
  color: var(--color-primary-contrast);
  background: var(--color-primary);
}

.home-btn-primary:hover {
  filter: brightness(1.07);
}

.home-btn-secondary {
  border: 1px solid var(--color-border);
  background: var(--color-surface);
}

.home-btn-secondary:hover {
  background: var(--color-surface-soft);
}

.home-stats {
  margin-top: 30px;
  display: flex;
  justify-content: center;
  gap: 20px;
  flex-wrap: wrap;
}

.home-stats > div {
  min-width: 110px;
  text-align: center;
}

.home-stats strong {
  display: block;
  color: var(--color-secondary);
  font-size: 24px;
  line-height: 1.2;
}

.home-stats span {
  color: var(--color-muted);
  font-size: 13px;
}

.home-nav,
.home-feature,
.home-guides {
  padding: 34px 0;
}

.home-nav h2,
.home-feature h2,
.home-guides h2 {
  margin: 0 0 16px;
  font-size: 22px;
}

.home-nav-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.home-nav-card {
  padding: 18px;
}

.home-nav-card h3 {
  margin: 0;
  font-size: 17px;
}

.home-nav-card p {
  margin: 8px 0 0;
  color: var(--color-muted);
  font-size: 14px;
}

.home-nav-card:hover,
.home-shikigami-card:hover,
.home-guide-card:hover {
  border-color: color-mix(in srgb, var(--color-primary) 45%, var(--color-border));
}

.home-feature-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.home-feature-head a {
  color: var(--color-primary);
  font-size: 14px;
}

.home-feature-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.home-shikigami-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px;
}

.home-shikigami-avatar {
  width: 72px;
  height: 72px;
  border-radius: 10px;
  overflow: hidden;
  flex-shrink: 0;
  border: 1px solid var(--color-border);
  background: var(--color-surface-soft);
}

.home-shikigami-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.home-shikigami-fallback {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  color: var(--color-muted);
  font-size: 13px;
}

.home-shikigami-main {
  min-width: 0;
  flex: 1;
}

.home-shikigami-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.home-shikigami-title-row strong {
  font-size: 16px;
}

.home-rarity {
  color: var(--color-secondary);
  font-size: 12px;
  border: 1px solid color-mix(in srgb, var(--color-secondary) 45%, transparent);
  border-radius: 999px;
  padding: 1px 8px;
}

.home-shikigami-main p,
.home-guide-card p {
  margin: 8px 0 0;
  color: var(--color-muted);
  font-size: 14px;
}

.home-tag-row {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.home-tag-row span {
  border-radius: 6px;
  background: var(--color-surface-soft);
  color: var(--color-muted);
  font-size: 12px;
  padding: 2px 6px;
}

.home-guides-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.home-guide-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
}

.home-guide-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: var(--color-muted);
  font-size: 12px;
}

.home-guide-card h3 {
  margin: 0;
  font-size: 17px;
}

@media (max-width: 980px) {
  .home-nav-grid,
  .home-feature-grid,
  .home-guides-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 700px) {
  .home-hero-inner {
    padding: 52px 0 46px;
  }

  .home-nav-grid,
  .home-feature-grid,
  .home-guides-grid {
    grid-template-columns: 1fr;
  }
}
</style>
