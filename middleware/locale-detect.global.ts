import {
  detectLocaleFromAcceptLanguage,
  detectLocaleFromNavigator,
  getSiteLocaleFromPath,
  isLocaleManagedPath,
  isSiteLocale,
  normalizeRoutePath,
  pathPrefixToSiteLocale,
  SITE_LOCALE_COOKIE,
  withSiteLocalePrefix,
  type SiteLocale
} from '~/utils/site-locale'

export default defineNuxtRouteMiddleware((to) => {
  const localeCookie = useCookie<SiteLocale | null>(SITE_LOCALE_COOKIE, {
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365
  })

  const localeFromPath = getSiteLocaleFromPath(to.path)
  const normalizedPath = normalizeRoutePath(to.path)
  const queryLang = typeof to.query.lang === 'string' ? to.query.lang : ''
  const nextQuery = { ...to.query } as Record<string, unknown>
  delete nextQuery.lang

  if (localeFromPath) {
    if (!isSiteLocale(localeCookie.value) || localeCookie.value !== localeFromPath) {
      localeCookie.value = localeFromPath
    }

    if (queryLang) {
      return navigateTo({
        path: normalizedPath,
        query: nextQuery,
        hash: to.hash
      }, { replace: true, redirectCode: 302 })
    }
    return
  }

  let preferredSiteLocale: SiteLocale | null = null

  if (queryLang) {
    preferredSiteLocale = pathPrefixToSiteLocale(queryLang)
    if (!preferredSiteLocale && isSiteLocale(queryLang)) {
      preferredSiteLocale = queryLang
    }
  }

  if (!preferredSiteLocale && isSiteLocale(localeCookie.value)) {
    preferredSiteLocale = localeCookie.value
  }

  if (!preferredSiteLocale) {
    let detected: SiteLocale = 'zh-CN'
    if (import.meta.server) {
      const headers = useRequestHeaders(['accept-language'])
      detected = detectLocaleFromAcceptLanguage(headers['accept-language'])
    } else {
      detected = detectLocaleFromNavigator()
    }
    preferredSiteLocale = detected
  }

  if (!isSiteLocale(localeCookie.value) || localeCookie.value !== preferredSiteLocale) {
    localeCookie.value = preferredSiteLocale
  }

  if (normalizedPath === '/' || isLocaleManagedPath(normalizedPath)) {
    return navigateTo({
      path: withSiteLocalePrefix(normalizedPath, preferredSiteLocale),
      query: nextQuery,
      hash: to.hash
    }, { replace: true, redirectCode: 302 })
  }
})
