import { joinURL } from 'ufo'

export type AssetRenderPolicy = 'degrade' | 'strict'

export type FlowAssetIssueCode = 'FILE_URL' | 'BLOB_URL' | 'NON_STANDARD_ABSOLUTE_PATH'

export type FlowAssetIssue = {
  code: FlowAssetIssueCode
  url: string
  message: string
}

const ASSET_PREFIX = '/assets/'
const LIKELY_URL_KEYS = new Set([
  'avatar',
  'src',
  'url',
  'href',
  'image',
  'imageUrl',
  'backgroundImage'
])

const FILE_PROTOCOL_RE = /^file:/i
const BLOB_PROTOCOL_RE = /^blob:/i
const HTTP_PROTOCOL_RE = /^https?:\/\//i
const DATA_PROTOCOL_RE = /^data:/i

const PLACEHOLDER_IMAGE = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="120" viewBox="0 0 220 120">
    <rect width="220" height="120" fill="#f1f5f9"/>
    <rect x="1" y="1" width="218" height="118" fill="none" stroke="#cbd5e1"/>
    <text x="110" y="68" font-size="14" text-anchor="middle" fill="#64748b">asset missing</text>
  </svg>`
)}`

const normalizeBaseURL = (baseURL: string): string => {
  if (!baseURL) {
    return '/'
  }
  return baseURL.endsWith('/') ? baseURL : `${baseURL}/`
}

const isLikelyAssetUrl = (value: string, keyPath: string): boolean => {
  if (!value) {
    return false
  }
  if (value.startsWith(ASSET_PREFIX)) {
    return true
  }
  if (FILE_PROTOCOL_RE.test(value) || BLOB_PROTOCOL_RE.test(value)) {
    return true
  }
  const lowerPath = keyPath.toLowerCase()
  return Array.from(LIKELY_URL_KEYS).some((entry) => lowerPath.endsWith(`.${entry}`) || lowerPath === entry)
}

const rewriteAssetUrl = (url: string, baseURL: string, policy: AssetRenderPolicy): string => {
  if (url.startsWith(ASSET_PREFIX)) {
    return joinURL(normalizeBaseURL(baseURL), url.slice(1))
  }
  if (FILE_PROTOCOL_RE.test(url) || BLOB_PROTOCOL_RE.test(url)) {
    return policy === 'degrade' ? PLACEHOLDER_IMAGE : url
  }
  return url
}

const inspectAssetUrl = (url: string, baseURL: string): FlowAssetIssue | null => {
  if (FILE_PROTOCOL_RE.test(url)) {
    return {
      code: 'FILE_URL',
      url,
      message: '检测到 file:// 本地路径，站点预览无法直接访问该资源。'
    }
  }
  if (BLOB_PROTOCOL_RE.test(url)) {
    return {
      code: 'BLOB_URL',
      url,
      message: '检测到 blob: 临时资源链接，刷新或跨端渲染后会失效。'
    }
  }
  if (url.startsWith('/') && !url.startsWith(ASSET_PREFIX)) {
    const normalizedBase = normalizeBaseURL(baseURL)
    const scopedPrefix = joinURL(normalizedBase, 'assets/')
    if (!url.startsWith(scopedPrefix) && !url.startsWith('/_nuxt/')) {
      return {
        code: 'NON_STANDARD_ABSOLUTE_PATH',
        url,
        message: '检测到非标准绝对路径，可能在子路径部署下出现 404。'
      }
    }
  }
  return null
}

const walkAndTransform = (input: any, baseURL: string, policy: AssetRenderPolicy, keyPath = ''): any => {
  if (typeof input === 'string') {
    if (!isLikelyAssetUrl(input, keyPath)) {
      return input
    }
    return rewriteAssetUrl(input, baseURL, policy)
  }
  if (Array.isArray(input)) {
    return input.map((item, index) => walkAndTransform(item, baseURL, policy, `${keyPath}[${index}]`))
  }
  if (input && typeof input === 'object') {
    const output: Record<string, any> = {}
    for (const [key, value] of Object.entries(input)) {
      const nextPath = keyPath ? `${keyPath}.${key}` : key
      output[key] = walkAndTransform(value, baseURL, policy, nextPath)
    }
    return output
  }
  return input
}

const walkAndCollectIssues = (
  input: any,
  issues: FlowAssetIssue[],
  baseURL: string,
  seen: Set<string>,
  keyPath = ''
) => {
  if (typeof input === 'string') {
    if (!isLikelyAssetUrl(input, keyPath)) {
      return
    }
    const issue = inspectAssetUrl(input, baseURL)
    if (!issue) {
      return
    }
    const issueKey = `${issue.code}:${issue.url}`
    if (seen.has(issueKey)) {
      return
    }
    seen.add(issueKey)
    issues.push(issue)
    return
  }

  if (Array.isArray(input)) {
    input.forEach((item, index) => walkAndCollectIssues(item, issues, baseURL, seen, `${keyPath}[${index}]`))
    return
  }

  if (input && typeof input === 'object') {
    Object.entries(input).forEach(([key, value]) => {
      const nextPath = keyPath ? `${keyPath}.${key}` : key
      walkAndCollectIssues(value, issues, baseURL, seen, nextPath)
    })
  }
}

export const rewriteFlowAssetUrls = (
  input: any,
  baseURL: string,
  policy: AssetRenderPolicy = 'degrade'
): any => walkAndTransform(input, baseURL, policy)

export const collectFlowAssetIssues = (input: any, baseURL: string): FlowAssetIssue[] => {
  const issues: FlowAssetIssue[] = []
  const seen = new Set<string>()
  walkAndCollectIssues(input, issues, baseURL, seen)
  return issues
}
