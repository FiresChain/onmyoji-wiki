<script setup lang="ts">
import {
  contentLocaleToDefaultSiteLocale,
  getContentLocaleFromPath,
  isContentLocale,
  isSiteLocale,
  SITE_LOCALE_COOKIE,
  SITE_LOCALE_OPTIONS,
  siteLocaleToContentLocale,
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
  { href: '/home', label: '首页' },
  { href: '/shikigami', label: '式神百科' },
  { href: '/onmyoji', label: '阴阳师' },
  { href: '/guides', label: '攻略中心' },
  { href: '/authors', label: '创作者' },
  { href: '/editor', label: '编辑器' }
]

const currentContentLocale = computed<'zh' | 'en'>(() => {
  const localeInPath = getContentLocaleFromPath(route.path)
  if (localeInPath) return localeInPath

  const queryLang = typeof route.query.lang === 'string' ? route.query.lang : ''
  if (isContentLocale(queryLang)) {
    return queryLang
  }

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

const homePath = computed(() => `/${siteLocaleToContentLocale(currentLocale.value)}`)

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

const normalizeNavHref = (href: string): string => {
  if (href === '/home') {
    return homePath.value
  }
  return href
}

const normalizedPath = computed(() => route.path.replace(/\/+$/, '') || '/')
const isRootRoute = computed(() => normalizedPath.value === '/zh' || normalizedPath.value === '/en' || normalizedPath.value === '/')

const isActive = (href: string): boolean => {
  const normalizedHref = normalizeNavHref(href).replace(/\/+$/, '') || '/'
  if (normalizedHref === '/zh' || normalizedHref === '/en') {
    return isRootRoute.value
  }
  return normalizedPath.value === normalizedHref || normalizedPath.value.startsWith(`${normalizedHref}/`)
}

const switchLocale = async (nextLocale: SiteLocale): Promise<void> => {
  localeCookie.value = nextLocale
  const nextContentLocale = siteLocaleToContentLocale(nextLocale)

  const localeInPath = getContentLocaleFromPath(route.path)
  if (localeInPath) {
    if (localeInPath === nextContentLocale) {
      return
    }

    const segments = route.path.split('/').filter(Boolean)
    segments[0] = nextContentLocale
    await router.push({
      path: `/${segments.join('/')}`,
      query: route.query,
      hash: route.hash
    })
    return
  }

  if (route.path === '/') {
    await router.push(`/${nextContentLocale}`)
    return
  }

  if (route.path === '/guides') {
    const currentQueryLang = typeof route.query.lang === 'string' ? route.query.lang : ''
    if (currentQueryLang === nextContentLocale) {
      return
    }

    await router.push({
      path: route.path,
      query: {
        ...route.query,
        lang: nextContentLocale
      },
      hash: route.hash
    })
    return
  }

  if (route.path === '/home') {
    await router.push(`/${nextContentLocale}`)
  }
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
      href: normalizeNavHref(link.href)
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