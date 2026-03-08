import {
  contentLocaleToDefaultSiteLocale,
  detectLocaleFromAcceptLanguage,
  detectLocaleFromNavigator,
  getContentLocaleFromPath,
  isLocaleManagedPath,
  isContentLocale,
  isSiteLocale,
  normalizeRoutePath,
  SITE_LOCALE_COOKIE,
  siteLocaleToContentLocale,
  withContentLocalePrefix,
  type SiteLocale
} from '~/utils/site-locale'

export default defineNuxtRouteMiddleware((to) => {
  const localeCookie = useCookie<SiteLocale | null>(SITE_LOCALE_COOKIE, {
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365
  })

  const contentLocaleFromPath = getContentLocaleFromPath(to.path)
  const normalizedPath = normalizeRoutePath(to.path)
  const queryLang = typeof to.query.lang === 'string' ? to.query.lang : ''
  const nextQuery = { ...to.query } as Record<string, unknown>
  delete nextQuery.lang

  if (contentLocaleFromPath) {
    if (!isSiteLocale(localeCookie.value)) {
      localeCookie.value = contentLocaleToDefaultSiteLocale(contentLocaleFromPath)
    } else if (siteLocaleToContentLocale(localeCookie.value) !== contentLocaleFromPath) {
      localeCookie.value = contentLocaleToDefaultSiteLocale(contentLocaleFromPath)
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

  let preferredContentLocale: 'zh' | 'en' = 'zh'
  if (isContentLocale(queryLang)) {
    preferredContentLocale = queryLang
  } else if (isSiteLocale(localeCookie.value)) {
    preferredContentLocale = siteLocaleToContentLocale(localeCookie.value)
  } else {
    let detected: SiteLocale = 'zh-CN'
    if (import.meta.server) {
      const headers = useRequestHeaders(['accept-language'])
      detected = detectLocaleFromAcceptLanguage(headers['accept-language'])
    } else {
      detected = detectLocaleFromNavigator()
    }
    localeCookie.value = detected
    preferredContentLocale = siteLocaleToContentLocale(detected)
  }

  if (!isSiteLocale(localeCookie.value) || siteLocaleToContentLocale(localeCookie.value) !== preferredContentLocale) {
    localeCookie.value = contentLocaleToDefaultSiteLocale(preferredContentLocale)
  }

  if (normalizedPath === '/' || isLocaleManagedPath(normalizedPath)) {
    return navigateTo({
      path: withContentLocalePrefix(normalizedPath, preferredContentLocale),
      query: nextQuery,
      hash: to.hash
    }, { replace: true, redirectCode: 302 })
  }
})
