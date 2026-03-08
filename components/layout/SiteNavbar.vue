<script setup lang="ts">
import {
  contentLocaleToDefaultSiteLocale,
  getContentLocaleFromPath,
  isLocaleManagedPath,
  isSiteLocale,
  normalizeRoutePath,
  SITE_LOCALE_COOKIE,
  SITE_LOCALE_OPTIONS,
  siteLocaleToContentLocale,
  withContentLocalePrefix,
  type SiteLocale
} from '~/utils/site-locale'

const route = useRoute()
const router = useRouter()
const mobileOpen = ref(false)
const localeOptions = SITE_LOCALE_OPTIONS
const localeCookie = useCookie<SiteLocale | null>(SITE_LOCALE_COOKIE, {
  sameSite: 'lax',
  maxAge: 60 * 60 * 24 * 365
})

const navLinks = [
  { path: '/', label: '首页' },
  { path: '/shikigami', label: '式神百科' },
  { path: '/onmyoji', label: '阴阳师' },
  { path: '/guides', label: '攻略中心' },
  { path: '/authors', label: '创作者' },
  { path: '/editor', label: '编辑器' }
]

const currentContentLocale = computed<'zh' | 'en'>(() => {
  const localeInPath = getContentLocaleFromPath(route.path)
  if (localeInPath) return localeInPath

  if (isSiteLocale(localeCookie.value)) {
    return siteLocaleToContentLocale(localeCookie.value)
  }

  return 'zh'
})

const currentLocale = computed<SiteLocale>(() => {
  if (isSiteLocale(localeCookie.value)) {
    return localeCookie.value
  }
  return contentLocaleToDefaultSiteLocale(currentContentLocale.value)
})

const activeContentLocale = computed<'zh' | 'en'>(() => siteLocaleToContentLocale(currentLocale.value))
const homePath = computed(() => withContentLocalePrefix('/', activeContentLocale.value))

watch(
  () => currentContentLocale.value,
  (contentLocale) => {
    if (!isSiteLocale(localeCookie.value)) {
      localeCookie.value = contentLocaleToDefaultSiteLocale(contentLocale)
      return
    }

    if (siteLocaleToContentLocale(localeCookie.value) !== contentLocale) {
      localeCookie.value = contentLocaleToDefaultSiteLocale(contentLocale)
    }
  },
  { immediate: true }
)

const normalizedPath = computed(() => normalizeRoutePath(route.path))
const isRootRoute = computed(() => normalizedPath.value === '/zh' || normalizedPath.value === '/en' || normalizedPath.value === '/')

const isActive = (href: string): boolean => {
  const normalizedHref = normalizeRoutePath(href)
  if (normalizedHref === '/zh' || normalizedHref === '/en') {
    return isRootRoute.value
  }
  return normalizedPath.value === normalizedHref || normalizedPath.value.startsWith(`${normalizedHref}/`)
}

const switchLocale = async (nextLocale: SiteLocale): Promise<void> => {
  localeCookie.value = nextLocale
  const nextContentLocale = siteLocaleToContentLocale(nextLocale)
  const localeInPath = getContentLocaleFromPath(route.path)
  const canSwitchByPath = Boolean(localeInPath) || isLocaleManagedPath(route.path)
  if (!canSwitchByPath) {
    return
  }

  const nextPath = withContentLocalePrefix(route.path, nextContentLocale)
  const nextQuery = { ...route.query }
  delete (nextQuery as Record<string, unknown>).lang

  if (normalizeRoutePath(nextPath) === normalizedPath.value) {
    const currentLang = typeof route.query.lang === 'string' ? route.query.lang : ''
    if (!currentLang) {
      return
    }
  }

  await router.push({
    path: nextPath,
    query: nextQuery,
    hash: route.hash
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
      href: withContentLocalePrefix(link.path, activeContentLocale.value)
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
        <span class="site-brand-badge">阴</span>
        <span class="site-brand-text">
          <strong>阴阳师百科</strong>
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
        <label class="site-lang-select" aria-label="语言切换">
          <span>语言</span>
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
          aria-label="切换导航菜单"
          @click="mobileOpen = !mobileOpen"
        >
          {{ mobileOpen ? '关闭' : '菜单' }}
        </button>
      </div>
    </div>

    <nav v-if="mobileOpen" class="site-nav-mobile">
      <div class="site-container site-nav-mobile-inner">
        <div class="site-nav-mobile-lang">
          <span>语言</span>
          <label class="site-lang-select" aria-label="语言切换">
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
