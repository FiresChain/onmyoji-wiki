import type { EditorStorageAdapter } from '~/types/editor-storage'

export const LOCAL_STORAGE_KEY = 'onmyoji-wiki.editor.markdown.v1'

type LocalStoragePayload = {
  markdown: string
  updatedAt: string
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

    const raw = localStorage.getItem(this.storageKey)
    if (!raw) {
      return null
    }

    try {
      const parsed = JSON.parse(raw) as LocalStoragePayload
      if (typeof parsed.markdown === 'string') {
        return parsed.markdown
      }
      return null
    } catch {
      // Backward compatibility: old format may be plain markdown string.
      return raw
    }
  }

  async saveMarkdown(markdown: string): Promise<void> {
    if (!this.isSupported()) {
      return
    }

    const payload: LocalStoragePayload = {
      markdown,
      updatedAt: new Date().toISOString()
    }
    localStorage.setItem(this.storageKey, JSON.stringify(payload))
  }
}
