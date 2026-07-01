export type SearchIndexLocale = 'zh' | 'en' | 'vi'

export type ContentRouteMap = {
  byTranslationKey: Record<string, Partial<Record<SearchIndexLocale, string>>>
  byPath: Record<string, {
    translationKey: string
    lang: SearchIndexLocale
    path: string
    legacyPath?: string
    routeKey?: string
  }>
}

async function loadPublicDataFile<T>(fileName: string, fallback: T): Promise<T> {
  if (import.meta.server) {
    try {
      const [{ readFile }, { join }] = await Promise.all([
        import('node:fs/promises'),
        import('pathe')
      ])
      const filePath = join(process.cwd(), 'public', 'data', fileName)
      const raw = await readFile(filePath, 'utf8')
      return JSON.parse(raw) as T
    } catch (error) {
      console.error(`[public-data] failed to load ${fileName} on server`, error)
      return fallback
    }
  }

  return $fetch<T>(`/data/${fileName}`).catch((error) => {
    console.error(`[public-data] failed to load ${fileName} on client`, error)
    return fallback
  })
}

export async function loadSearchIndex<T = Record<string, unknown>>(locale: SearchIndexLocale): Promise<T[]> {
  const fileName = `search-index.${locale}.json`
  const parsed = await loadPublicDataFile<T[] | unknown>(fileName, [])
  return Array.isArray(parsed) ? (parsed as T[]) : []
}

export async function loadContentRouteMap(): Promise<ContentRouteMap> {
  return loadPublicDataFile<ContentRouteMap>('content-routes.json', {
    byTranslationKey: {},
    byPath: {}
  })
}
