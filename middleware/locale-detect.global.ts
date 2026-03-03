import {
  contentLocaleToDefaultSiteLocale,
  detectLocaleFromAcceptLanguage,
  detectLocaleFromNavigator,
  getContentLocaleFromPath,
  isContentLocale,
  isSiteLocale,
  SITE_LOCALE_COOKIE,
  siteLocaleToContentLocale,
  type SiteLocale
} from '~/utils/site-locale'

export default defineNuxtRouteMiddleware((to) => {
  const localeCookie = useCookie<SiteLocale | null>(SITE_LOCALE_COOKIE, {
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365
  })

  const contentLocaleFromPath = getContentLocaleFromPath(to.path)
  if (contentLocaleFromPath) {
    if (!isSiteLocale(localeCookie.value)) {
      localeCookie.value = contentLocaleToDefaultSiteLocale(contentLocaleFromPath)
      return
    }

    if (siteLocaleToContentLocale(localeCookie.value) !== contentLocaleFromPath) {
      localeCookie.value = contentLocaleToDefaultSiteLocale(contentLocaleFromPath)
    }
    return
  }

  const queryLang = typeof to.query.lang === 'string' ? to.query.lang : ''
  if (isContentLocale(queryLang)) {
    if (!isSiteLocale(localeCookie.value) || siteLocaleToContentLocale(localeCookie.value) !== queryLang) {
      localeCookie.value = contentLocaleToDefaultSiteLocale(queryLang)
    }
    return
  }

  if (isSiteLocale(localeCookie.value)) {
    if (to.path === '/') {
      return navigateTo(`/${siteLocaleToContentLocale(localeCookie.value)}`, { replace: true, redirectCode: 302 })
    }
    return
  }

  let detected: SiteLocale = 'zh-CN'
  if (import.meta.server) {
    const headers = useRequestHeaders(['accept-language'])
    detected = detectLocaleFromAcceptLanguage(headers['accept-language'])
  } else {
    detected = detectLocaleFromNavigator()
  }

  localeCookie.value = detected

  if (to.path === '/') {
    return navigateTo(`/${siteLocaleToContentLocale(detected)}`, { replace: true, redirectCode: 302 })
  }
})
