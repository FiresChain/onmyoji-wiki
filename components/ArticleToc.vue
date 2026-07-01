<script setup lang="ts">
type TocLink = {
  id?: string
  text?: string
  children?: TocLink[]
}

type NormalizedTocLink = {
  id: string
  text: string
  children: NormalizedTocLink[]
}

type TocSource = {
  links?: TocLink[]
}

const props = withDefaults(defineProps<{
  toc?: TocSource | TocLink[]
  title?: string
  collapsible?: boolean
}>(), {
  title: '本文目录',
  collapsible: false
})

const links = computed<TocLink[]>(() => {
  const rawLinks = Array.isArray(props.toc) ? props.toc : props.toc?.links
  return (rawLinks ?? []).filter((link) => link.id && link.text)
})

const normalizedLinks = computed<NormalizedTocLink[]>(() => {
  return links.value.map((link) => ({
    id: String(link.id),
    text: String(link.text),
    children: (link.children ?? [])
      .filter((child) => child.id && child.text)
      .map((child) => ({
        id: String(child.id),
        text: String(child.text),
        children: []
      }))
  }))
})
</script>

<template>
  <details v-if="collapsible && normalizedLinks.length" class="article-toc article-toc-mobile">
    <summary>{{ title }}</summary>
    <nav :aria-label="title">
      <ol>
        <li v-for="link in normalizedLinks" :key="link.id">
          <a :href="`#${link.id}`">{{ link.text }}</a>
          <ol v-if="link.children?.length">
            <li v-for="child in link.children" :key="child.id">
              <a :href="`#${child.id}`">{{ child.text }}</a>
            </li>
          </ol>
        </li>
      </ol>
    </nav>
  </details>

  <nav v-else-if="normalizedLinks.length" class="article-toc" :aria-label="title">
    <h2>{{ title }}</h2>
    <ol>
      <li v-for="link in normalizedLinks" :key="link.id">
        <a :href="`#${link.id}`">{{ link.text }}</a>
        <ol v-if="link.children?.length">
          <li v-for="child in link.children" :key="child.id">
            <a :href="`#${child.id}`">{{ child.text }}</a>
          </li>
        </ol>
      </li>
    </ol>
  </nav>
</template>

<style scoped>
.article-toc {
  color: var(--color-muted);
  font-size: 13px;
  line-height: 1.45;
}

.article-toc h2,
.article-toc summary {
  margin: 0 0 10px;
  color: var(--color-foreground);
  font-size: 14px;
  font-weight: 700;
}

.article-toc summary {
  cursor: pointer;
  list-style-position: inside;
}

.article-toc ol {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.article-toc ol ol {
  gap: 4px;
  margin-top: 5px;
  padding-left: 12px;
  border-left: 1px solid var(--color-border);
}

.article-toc a {
  display: block;
  color: inherit;
  overflow-wrap: anywhere;
}

.article-toc a:hover {
  color: var(--color-primary);
}

.article-toc-mobile {
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  padding: 12px 14px;
  box-shadow: var(--shadow);
}

.article-toc-mobile[open] summary {
  margin-bottom: 10px;
}
</style>
