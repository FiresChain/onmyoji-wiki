import type { FileSystemStorageAdapter } from '~/types/editor-storage'

type DirectoryPickerCapableWindow = Window & {
  showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>
}

const MARKDOWN_FILE_PATTERN = /\.(md|markdown)$/i

export class FileSystemEditorStorageAdapter implements FileSystemStorageAdapter {
  readonly mode = 'file-system' as const
  readonly label = 'file-system'

  private directoryHandle: FileSystemDirectoryHandle | null = null
  private fileHandles = new Map<string, FileSystemFileHandle>()
  private currentFileName: string | null = null

  isSupported(): boolean {
    if (typeof window === 'undefined') {
      return false
    }
    const candidate = window as DirectoryPickerCapableWindow
    return typeof candidate.showDirectoryPicker === 'function'
  }

  hasDirectory(): boolean {
    return this.directoryHandle !== null
  }

  getCurrentFileName(): string | null {
    return this.currentFileName
  }

  async loadInitialMarkdown(): Promise<string | null> {
    return null
  }

  async pickDirectory(): Promise<string[]> {
    if (!this.isSupported()) {
      throw new Error('当前浏览器不支持 File System Access API。')
    }

    const candidate = window as DirectoryPickerCapableWindow
    this.directoryHandle = await candidate.showDirectoryPicker!({ mode: 'readwrite' })
    this.currentFileName = null
    return this.refreshFiles()
  }

  async openFile(fileName: string): Promise<string> {
    if (!this.directoryHandle) {
      throw new Error('请先选择目录。')
    }

    let fileHandle = this.fileHandles.get(fileName)
    if (!fileHandle) {
      fileHandle = await this.directoryHandle.getFileHandle(fileName, { create: false })
      this.fileHandles.set(fileName, fileHandle)
    }

    const file = await fileHandle.getFile()
    const markdown = await file.text()
    this.currentFileName = fileName
    return markdown
  }

  async saveMarkdown(markdown: string): Promise<void> {
    if (!this.directoryHandle || !this.currentFileName) {
      throw new Error('请先打开一个 markdown 文件。')
    }

    const fileHandle = this.fileHandles.get(this.currentFileName)
    if (!fileHandle) {
      throw new Error('当前文件句柄不可用，请重新打开文件。')
    }

    const writable = await fileHandle.createWritable()
    await writable.write(markdown)
    await writable.close()
  }

  private async refreshFiles(): Promise<string[]> {
    if (!this.directoryHandle) {
      return []
    }

    this.fileHandles.clear()
    const markdownFiles: string[] = []

    // MVP: only scan the selected directory root.
    for await (const [name, handle] of this.directoryHandle.entries()) {
      if (handle.kind !== 'file') {
        continue
      }

      if (!MARKDOWN_FILE_PATTERN.test(name)) {
        continue
      }

      markdownFiles.push(name)
      this.fileHandles.set(name, handle)
    }

    markdownFiles.sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
    return markdownFiles
  }
}
