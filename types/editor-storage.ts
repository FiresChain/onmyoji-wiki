export type EditorStorageMode = 'local-storage' | 'file-system'

export interface EditorStorageAdapter {
  readonly mode: EditorStorageMode
  readonly label: string
  isSupported(): boolean
  loadInitialMarkdown(): Promise<string | null>
  saveMarkdown(markdown: string): Promise<void>
}

export interface FileSystemStorageAdapter extends EditorStorageAdapter {
  hasDirectory(): boolean
  pickDirectory(): Promise<string[]>
  openFile(fileName: string): Promise<string>
  getCurrentFileName(): string | null
}
