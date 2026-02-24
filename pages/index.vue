<script setup>
const { data: page } = await useAsyncData('home-page', () => {
  return queryCollection('content').path('/').first()
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
