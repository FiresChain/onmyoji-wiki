<script setup lang="ts">
definePageMeta({
  path: '/:locale(zh|en)/onmyoji'
})

type OnmyojiDoc = {
  path: string
  title?: string
  summary?: string
  avatar?: string
  tags?: string[]
}

const { data: docs } = await useAsyncData('onmyoji-documents', () => {
  return queryCollection('content').all().catch((error) => {
    console.error('[content] failed to load onmyoji documents', error)
    return []
  })
})

const onmyojiList = computed<OnmyojiDoc[]>(() => {
  return (docs.value ?? []).filter((doc): doc is OnmyojiDoc => {
    return typeof doc.path === 'string' && doc.path.startsWith('/onmyoji/')
  })
})
</script>

<template>
  <div>
    <PageHeader
      title="阴阳师角色"
      description="角色技能说明和实战定位，全部由 Markdown 文档维护。"
      :breadcrumbs="[
        { label: '首页', href: '/' },
        { label: '阴阳师角色' }
      ]"
    />

    <section class="site-container list-page">
      <div class="list-grid">
        <NuxtLink v-for="doc in onmyojiList" :key="doc.path" :to="doc.path" class="list-card card">
          <div class="list-avatar">
            <img v-if="doc.avatar" :src="doc.avatar" :alt="doc.title || ''">
            <div v-else>角色</div>
          </div>
          <div class="list-main">
            <h2>{{ doc.title }}</h2>
            <p>{{ doc.summary }}</p>
            <div class="list-tags">
              <span v-for="tag in (doc.tags || []).slice(0, 5)" :key="tag">{{ tag }}</span>
            </div>
          </div>
        </NuxtLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.list-page {
  padding: 24px 0 38px;
}

.list-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.list-card {
  display: flex;
  gap: 14px;
  padding: 14px;
}

.list-card:hover {
  border-color: color-mix(in srgb, var(--color-primary) 45%, var(--color-border));
}

.list-avatar {
  width: 82px;
  height: 82px;
  border-radius: 10px;
  overflow: hidden;
  background: var(--color-surface-soft);
  border: 1px solid var(--color-border);
  flex-shrink: 0;
}

.list-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.list-avatar > div {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  color: var(--color-muted);
  font-size: 13px;
}

.list-main h2 {
  margin: 0;
  font-size: 20px;
}

.list-main p {
  margin: 7px 0 0;
  color: var(--color-muted);
}

.list-tags {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.list-tags span {
  border-radius: 6px;
  background: var(--color-surface-soft);
  color: var(--color-muted);
  font-size: 12px;
  padding: 2px 6px;
}

@media (max-width: 980px) {
  .list-grid {
    grid-template-columns: 1fr;
  }
}
</style>
