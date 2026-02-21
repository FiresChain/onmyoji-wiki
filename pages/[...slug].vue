<script setup>
const route = useRoute()
const { data: page } = await useAsyncData(route.path, () => {
  return queryCollection('content').path(route.path).first()
})
</script>

<template>
  <main>
    <ContentRenderer v-if="page" :value="page" />
    <div v-else>
      <h1>Page not found</h1>
    </div>
  </main>
</template>
