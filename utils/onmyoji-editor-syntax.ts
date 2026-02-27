export type OnmyojiEditorBlockType = 'file' | 'block'

export type OnmyojiEditorFenceInfo = {
  isOnmyojiEditor: boolean
  type: OnmyojiEditorBlockType
  explicitType: OnmyojiEditorBlockType | null
  src: string
  height: number | null
  attrs: Record<string, string>
}

export const ONMYOJI_EDITOR_LANGUAGE = 'onmyoji-editor'
export const ONMYOJI_EDITOR_BLOCK_REGEX = /```onmyoji-editor([^\r\n]*)\r?\n([\s\S]*?)```/g

const stripQuotes = (value: string): string => {
  const trimmed = value.trim()
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

const parseInlineAttrs = (raw: string): Record<string, string> => {
  const attrs: Record<string, string> = {}
  const attrRegex = /([:@\w-]+)\s*=\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^\s}]+)/g
  let match: RegExpExecArray | null
  while ((match = attrRegex.exec(raw)) !== null) {
    const key = (match[1] || '').trim()
    const value = stripQuotes(match[2] || '')
    if (!key) {
      continue
    }
    attrs[key] = value
  }
  return attrs
}

export const parseOnmyojiEditorFenceInfo = (info: string): OnmyojiEditorFenceInfo => {
  const normalized = (info || '').trim()
  if (!normalized) {
    return {
      isOnmyojiEditor: false,
      type: 'block',
      explicitType: null,
      src: '',
      height: null,
      attrs: {}
    }
  }

  if (!normalized.startsWith(ONMYOJI_EDITOR_LANGUAGE)) {
    return {
      isOnmyojiEditor: false,
      type: 'block',
      explicitType: null,
      src: '',
      height: null,
      attrs: {}
    }
  }

  const rest = normalized.slice(ONMYOJI_EDITOR_LANGUAGE.length).trim()
  let rawAttrSegment = ''
  if (rest.startsWith('{') && rest.includes('}')) {
    rawAttrSegment = rest.slice(1, rest.indexOf('}'))
  } else {
    rawAttrSegment = rest
  }

  const attrs = parseInlineAttrs(rawAttrSegment)
  const typeRaw = (attrs.type || '').toLowerCase()
  const explicitType: OnmyojiEditorBlockType | null = typeRaw === 'file'
    ? 'file'
    : typeRaw === 'block'
      ? 'block'
      : null
  const type: OnmyojiEditorBlockType = explicitType || 'block'
  const src = attrs.src || ''
  const heightRaw = attrs[':height'] ?? attrs.height ?? ''
  const height = Number.isFinite(Number(heightRaw)) && Number(heightRaw) > 0
    ? Number(heightRaw)
    : null

  return {
    isOnmyojiEditor: true,
    type,
    explicitType,
    src,
    height,
    attrs
  }
}

export const parseOnmyojiEditorFenceInfoFromParts = (language: string, meta = ''): OnmyojiEditorFenceInfo => {
  const languagePart = (language || '').trim()
  const metaPart = (meta || '').trim()
  const combined = [languagePart, metaPart].filter(Boolean).join(' ').trim()
  return parseOnmyojiEditorFenceInfo(combined)
}

export const buildOnmyojiEditorFileFence = (src: string, height?: number | null): string => {
  const heightSegment = Number.isFinite(height || NaN) && Number(height) > 0
    ? ` :height="${Number(height)}"`
    : ''
  return `\`\`\`${ONMYOJI_EDITOR_LANGUAGE} type="file" src="${src}"${heightSegment}\n\`\`\``
}

export const buildOnmyojiEditorBlockFence = (payload: string): string => (
  `\`\`\`${ONMYOJI_EDITOR_LANGUAGE} type="block"\n${payload}\n\`\`\``
)

