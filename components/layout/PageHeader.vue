<script setup lang="ts">
type Crumb = {
  label: string
  href?: string
}

defineProps<{
  title: string
  description?: string
  breadcrumbs?: Crumb[]
}>()
</script>

<template>
  <header class="page-header">
    <div class="site-container">
      <nav v-if="breadcrumbs?.length" class="page-breadcrumbs" aria-label="面包屑导航">
        <template v-for="(crumb, index) in breadcrumbs" :key="`${crumb.label}-${index}`">
          <span v-if="index > 0" class="page-breadcrumb-sep">/</span>
          <NuxtLink v-if="crumb.href" :to="crumb.href" class="page-breadcrumb-link">
            {{ crumb.label }}
          </NuxtLink>
          <span v-else class="page-breadcrumb-current">{{ crumb.label }}</span>
        </template>
      </nav>

      <h1>{{ title }}</h1>
      <p v-if="description">{{ description }}</p>
    </div>
  </header>
</template>

