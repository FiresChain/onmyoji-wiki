import type { EditorStorageAdapter } from '~/types/editor-storage'

export const LOCAL_STORAGE_KEY = 'onmyoji-wiki.editor.markdown.v1'
export const LOCAL_STORAGE_BACKUP_KEY = `${LOCAL_STORAGE_KEY}.backup`
const LOCAL_STORAGE_SCHEMA_VERSION = 2

type LocalStoragePayload = {
  schemaVersion?: number
  markdown: string
  updatedAt: string
  checksum?: string
}

const hashText = (input: string): string => {
  let hash = 5381
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash) + input.charCodeAt(i)
    hash &= 0x7fffffff
  }
  return `h${hash.toString(16)}`
}

export class LocalStorageEditorStorageAdapter implements EditorStorageAdapter {
  readonly mode = 'local-storage' as const
  readonly label = 'localStorage'

  constructor(private readonly storageKey: string = LOCAL_STORAGE_KEY) {}

  isSupported(): boolean {
    return typeof window !== 'undefined' && 'localStorage' in window
  }

  async loadInitialMarkdown(): Promise<string | null> {
    if (!this.isSupported()) {
      return null
    }

    const keys = [this.storageKey, LOCAL_STORAGE_BACKUP_KEY]
    for (const key of keys) {
      const raw = localStorage.getItem(key)
      if (!raw) {
        continue
      }

      try {
        const parsed = JSON.parse(raw) as LocalStoragePayload
        if (typeof parsed.markdown === 'string') {
          return parsed.markdown
        }
      } catch {
        // Backward compatibility: old format may be plain markdown string.
        if (typeof raw === 'string') {
          return raw
        }
      }
    }
    return null
  }

  async saveMarkdown(markdown: string): Promise<void> {
    if (!this.isSupported()) {
      return
    }

    const previous = localStorage.getItem(this.storageKey)
    if (previous) {
      localStorage.setItem(LOCAL_STORAGE_BACKUP_KEY, previous)
    }

    const payload: LocalStoragePayload = {
      schemaVersion: LOCAL_STORAGE_SCHEMA_VERSION,
      markdown,
      updatedAt: new Date().toISOString(),
      checksum: hashText(markdown)
    }
    localStorage.setItem(this.storageKey, JSON.stringify(payload))
  }
}
