export const SITE_LOCALE_OPTIONS = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'ja', label: '日本語' },
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'ko', label: '한국어' }
] as const

export type SiteLocale = typeof SITE_LOCALE_OPTIONS[number]['value']
export type ContentLocale = 'zh' | 'en'

export const SITE_LOCALE_COOKIE = 'onmyoji_locale'

export const isSiteLocale = (value: unknown): value is SiteLocale => {
  return SITE_LOCALE_OPTIONS.some((item) => item.value === value)
}

export const isContentLocale = (value: unknown): value is ContentLocale => {
  return value === 'zh' || value === 'en'
}

export const getContentLocaleFromPath = (path: string): ContentLocale | null => {
  const firstSegment = path.split('/').filter(Boolean)[0]
  return isContentLocale(firstSegment) ? firstSegment : null
}

export const normalizeRoutePath = (path: string): string => {
  if (!path) {
    return '/'
  }
  const normalized = path.startsWith('/') ? path : `/${path}`
  return normalized.replace(/\/+$/, '') || '/'
}

const LOCALE_MANAGED_EXACT_PATHS = new Set([
  '/',
  '/home',
  '/guides',
  '/authors',
  '/shikigami',
  '/onmyoji',
  '/editor'
])

const LOCALE_MANAGED_PREFIX_PATHS = ['/guides/', '/authors/']

export const isLocaleManagedPath = (path: string): boolean => {
  const normalized = normalizeRoutePath(path)
  if (LOCALE_MANAGED_EXACT_PATHS.has(normalized)) {
    return true
  }
  return LOCALE_MANAGED_PREFIX_PATHS.some((prefix) => normalized.startsWith(prefix))
}

export const withContentLocalePrefix = (path: string, locale: ContentLocale): string => {
  const normalized = normalizeRoutePath(path)
  if (normalized === '/' || normalized === '/home') {
    return `/${locale}`
  }

  const segments = normalized.split('/').filter(Boolean)
  if (segments.length > 0 && isContentLocale(segments[0])) {
    segments[0] = locale
    return `/${segments.join('/')}`
  }
  return `/${locale}${normalized}`
}

export const siteLocaleToContentLocale = (locale: SiteLocale): ContentLocale => {
  return locale === 'zh-CN' || locale === 'zh-TW' ? 'zh' : 'en'
}

export const contentLocaleToDefaultSiteLocale = (locale: ContentLocale): SiteLocale => {
  return locale === 'zh' ? 'zh-CN' : 'ja'
}

const resolveSiteLocaleByTag = (tag: string): SiteLocale | null => {
  if (tag.startsWith('zh-tw') || tag.startsWith('zh-hk') || tag.startsWith('zh-mo')) {
    return 'zh-TW'
  }
  if (tag.startsWith('zh')) {
    return 'zh-CN'
  }
  if (tag.startsWith('ja')) {
    return 'ja'
  }
  if (tag.startsWith('vi')) {
    return 'vi'
  }
  if (tag.startsWith('ko')) {
    return 'ko'
  }
  return null
}

export const detectLocaleFromAcceptLanguage = (acceptLanguage?: string | null): SiteLocale => {
  if (!acceptLanguage) {
    return 'zh-CN'
  }

  const entries = acceptLanguage
    .split(',')
    .map((item) => item.split(';')[0]?.trim().toLowerCase())
    .filter(Boolean) as string[]

  for (const entry of entries) {
    const locale = resolveSiteLocaleByTag(entry)
    if (locale) {
      return locale
    }
  }

  return 'zh-CN'
}

export const detectLocaleFromNavigator = (): SiteLocale => {
  if (typeof navigator === 'undefined') {
    return 'zh-CN'
  }

  const candidates = Array.isArray(navigator.languages) && navigator.languages.length > 0
    ? navigator.languages
    : [navigator.language]

  for (const candidate of candidates) {
    const normalized = String(candidate || '').trim().toLowerCase()
    const locale = resolveSiteLocaleByTag(normalized)
    if (locale) {
      return locale
    }
  }

  return 'zh-CN'
}
