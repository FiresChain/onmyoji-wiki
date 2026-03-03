export type SearchIndexLocale = 'zh' | 'en'

export async function loadSearchIndex<T = Record<string, unknown>>(locale: SearchIndexLocale): Promise<T[]> {
  const fileName = `search-index.${locale}.json`

  if (import.meta.server) {
    try {
      const [{ readFile }, { join }] = await Promise.all([
        import('node:fs/promises'),
        import('pathe')
      ])
      const filePath = join(process.cwd(), 'public', 'data', fileName)
      const raw = await readFile(filePath, 'utf8')
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? (parsed as T[]) : []
    } catch (error) {
      console.error(`[search-index] failed to load ${fileName} on server`, error)
      return []
    }
  }

  return $fetch<T[]>(`/data/${fileName}`).catch((error) => {
    console.error(`[search-index] failed to load ${fileName} on client`, error)
    return []
  })
}
