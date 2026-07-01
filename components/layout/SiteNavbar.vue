<script setup lang="ts">
import {
  getSiteLocaleFromPath,
  isLocaleManagedPath,
  isSiteLocale,
  normalizeRoutePath,
  SITE_LOCALE_COOKIE,
  SITE_LOCALE_OPTIONS,
  siteLocaleToContentLocale,
  siteLocaleToPathPrefix,
  withSiteLocalePrefix,
  type SiteLocale
} from '~/utils/site-locale'
import { loadContentRouteMap } from '~/utils/search-index'

const route = useRoute()
const router = useRouter()
const mobileOpen = ref(false)
const localeOptions = SITE_LOCALE_OPTIONS
const localeCookie = useCookie<SiteLocale | null>(SITE_LOCALE_COOKIE, {
  sameSite: 'lax',
  maxAge: 60 * 60 * 24 * 365
})

const navLinks = [
  { path: '/', labelKey: 'home' },
  { path: '/shikigami', labelKey: 'shikigami' },
  { path: '/onmyoji', labelKey: 'onmyoji' },
  { path: '/guides', labelKey: 'guides' },
  { path: '/authors', labelKey: 'authors' },
  { path: '/editor', labelKey: 'editor' }
] 

const navText = computed(() => {
  if (currentLocale.value === 'vi') {
    return {
      brand: 'Bách khoa Onmyoji',
      language: 'Ngôn ngữ',
      menu: 'Menu',
      close: 'Đóng',
      toggleNav: 'Chuyển menu điều hướng',
      switchLanguage: 'Chuyển ngôn ngữ',
      links: {
        home: 'Trang chủ',
        shikigami: 'Bách khoa thức thần',
        onmyoji: 'Âm Dương Sư',
        guides: 'Trung tâm hướng dẫn',
        authors: 'Tác giả',
        editor: 'Trình biên tập'
      }
    }
  }

  return {
    brand: '阴阳师百科',
    language: '语言',
    menu: '菜单',
    close: '关闭',
    toggleNav: '切换导航菜单',
    switchLanguage: '语言切换',
    links: {
      home: '首页',
      shikigami: '式神百科',
      onmyoji: '阴阳师',
      guides: '攻略中心',
      authors: '创作者',
      editor: '编辑器'
    }
  }
})

const currentLocale = computed<SiteLocale>(() => {
  const localeInPath = getSiteLocaleFromPath(route.path)
  if (localeInPath) {
    return localeInPath
  }
  if (isSiteLocale(localeCookie.value)) {
    return localeCookie.value
  }
  return 'zh-CN'
})

const homePath = computed(() => withSiteLocalePrefix('/', currentLocale.value))

watch(
  () => currentLocale.value,
  (siteLocale) => {
    if (!isSiteLocale(localeCookie.value) || localeCookie.value !== siteLocale) {
      localeCookie.value = siteLocale
    }
  },
  { immediate: true }
)

const normalizedPath = computed(() => normalizeRoutePath(route.path))
const isRootRoute = computed(() => {
  const roots = new Set(['/'])
  SITE_LOCALE_OPTIONS.forEach((item) => roots.add(`/${siteLocaleToPathPrefix(item.value)}`))
  roots.add('/zh')
  roots.add('/en')
  roots.add('/vi')
  return roots.has(normalizedPath.value)
})

const isActive = (href: string): boolean => {
  const normalizedHref = normalizeRoutePath(href)
  if (normalizedHref === '/zh' || normalizedHref === '/en' || normalizedHref === '/vi') {
    return isRootRoute.value
  }
  return normalizedPath.value === normalizedHref || normalizedPath.value.startsWith(`${normalizedHref}/`)
}

const switchLocale = async (nextLocale: SiteLocale): Promise<void> => {
  localeCookie.value = nextLocale
  const localeInPath = getSiteLocaleFromPath(route.path)
  const canSwitchByPath = Boolean(localeInPath) || isLocaleManagedPath(route.path)
  if (!canSwitchByPath) {
    return
  }

  const nextQuery = { ...route.query }
  delete (nextQuery as Record<string, unknown>).lang

  const routeMap = await loadContentRouteMap()
  const currentPathCandidates = [normalizedPath.value]
  try {
    const decodedPath = normalizeRoutePath(decodeURIComponent(route.path))
    if (!currentPathCandidates.includes(decodedPath)) {
      currentPathCandidates.push(decodedPath)
    }
  } catch {
    // Keep the normalized route path candidate when decoding fails.
  }

  const currentContentRoute = currentPathCandidates
    .map((path) => routeMap.byPath[path])
    .find(Boolean)
  const targetContentLocale = siteLocaleToContentLocale(nextLocale)
  const translatedPath = currentContentRoute?.translationKey
    ? routeMap.byTranslationKey[currentContentRoute.translationKey]?.[targetContentLocale]
    : ''
  const nextPath = translatedPath || withSiteLocalePrefix(route.path, nextLocale)

  if (normalizeRoutePath(nextPath) === normalizedPath.value) {
    const currentLang = typeof route.query.lang === 'string' ? route.query.lang : ''
    if (!currentLang) {
      return
    }
  }

  await router.push({
    path: nextPath,
    query: nextQuery,
    hash: translatedPath ? '' : route.hash
  })
}

const onLocaleSelect = async (event: Event): Promise<void> => {
  const target = event.target as HTMLSelectElement | null
  const nextLocale = target?.value
  if (!isSiteLocale(nextLocale)) {
    return
  }

  await switchLocale(nextLocale)
}

const normalizedNavLinks = computed(() => {
  return navLinks.map((link) => {
    return {
      ...link,
      href: withSiteLocalePrefix(link.path, currentLocale.value),
      label: navText.value.links[link.labelKey as keyof typeof navText.value.links]
    }
  })
})

watch(() => route.path, () => {
  mobileOpen.value = false
})
</script>

<template>
  <header class="site-nav">
    <div class="site-container site-nav-inner">
      <NuxtLink :to="homePath" class="site-brand">
        <span class="site-brand-badge">{{ currentLocale === 'vi' ? 'Âm' : '阴' }}</span>
        <span class="site-brand-text">
          <strong>{{ navText.brand }}</strong>
          <small>Onmyoji Wiki</small>
        </span>
      </NuxtLink>

      <nav class="site-nav-desktop">
        <NuxtLink
          v-for="link in normalizedNavLinks"
          :key="link.href"
          :to="link.href"
          class="site-nav-link"
          :class="{ 'is-active': isActive(link.href) }"
        >
          {{ link.label }}
        </NuxtLink>
      </nav>

      <div class="site-nav-actions">
        <label class="site-lang-select" :aria-label="navText.switchLanguage">
          <span>{{ navText.language }}</span>
          <select :value="currentLocale" @change="onLocaleSelect">
            <option
              v-for="option in localeOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
        </label>

        <button
          type="button"
          class="site-nav-toggle"
          :aria-expanded="mobileOpen"
          :aria-label="navText.toggleNav"
          @click="mobileOpen = !mobileOpen"
        >
          {{ mobileOpen ? navText.close : navText.menu }}
        </button>
      </div>
    </div>

    <nav v-if="mobileOpen" class="site-nav-mobile">
      <div class="site-container site-nav-mobile-inner">
        <div class="site-nav-mobile-lang">
          <span>{{ navText.language }}</span>
          <label class="site-lang-select" :aria-label="navText.switchLanguage">
            <select :value="currentLocale" @change="onLocaleSelect">
              <option
                v-for="option in localeOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </label>
        </div>
        <NuxtLink
          v-for="link in normalizedNavLinks"
          :key="link.href"
          :to="link.href"
          class="site-nav-link"
          :class="{ 'is-active': isActive(link.href) }"
        >
          {{ link.label }}
        </NuxtLink>
      </div>
    </nav>
  </header>
</template>
