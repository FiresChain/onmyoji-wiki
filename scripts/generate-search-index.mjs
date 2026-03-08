import { promises as fs } from 'node:fs'
import path from 'node:path'
import { parse as parseYaml } from 'yaml'

const CONTENT_ROOT = path.resolve('content')
const OUTPUT_ROOT = path.resolve('public', 'data')
const SUPPORTED_LOCALES = ['zh', 'en']

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

async function listMarkdownFiles(dir) {
  const result = []
  const entries = await fs.readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      result.push(...(await listMarkdownFiles(fullPath)))
      continue
    }

    if (entry.isFile() && entry.name.endsWith('.md')) {
      result.push(fullPath)
    }
  }

  return result
}

function parseFrontmatter(markdown, filePath) {
  const normalized = markdown.replace(/^\uFEFF/, '')
  const match = normalized.match(FRONTMATTER_REGEX)
  if (!match) {
    throw new Error(`Missing frontmatter: ${filePath}`)
  }

  try {
    return parseYaml(match[1]) || {}
  } catch (error) {
    throw new Error(`Invalid frontmatter in ${filePath}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function toRoutePath(relativePath) {
  const normalized = relativePath.split(path.sep)
  const filename = normalized[normalized.length - 1]
  const basename = filename.replace(/\.md$/, '')
  const lang = normalized[0]
  const subdirs = normalized.slice(1, -1)

  if (basename === '_index') {
    return `/${[lang, ...subdirs].join('/')}`
  }

  if (basename === 'index' && subdirs.length === 0) {
    return `/${lang}`
  }

  return `/${[lang, ...subdirs, basename].join('/')}`
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) {
    return []
  }

  return tags.map((tag) => String(tag)).filter(Boolean)
}

function normalizeStages(stages) {
  if (!Array.isArray(stages)) {
    return []
  }

  return stages.map((stage) => (typeof stage === 'number' ? stage : String(stage))).filter((stage) => stage !== '')
}

function getStageAnchor(stageAnchors, stage) {
  if (!stageAnchors || typeof stageAnchors !== 'object') {
    return undefined
  }

  const stageKey = String(stage)
  const anchor = stageAnchors[stageKey]
  return typeof anchor === 'string' && anchor.length > 0 ? anchor : undefined
}

function createBaseEntry(data, routePath) {
  return {
    title: String(data.title || ''),
    summary: String(data.summary || ''),
    lang: String(data.lang || ''),
    categoryL1: String(data.categoryL1 || ''),
    categoryL2: String(data.categoryL2 || ''),
    authorId: String(data.authorId || ''),
    authorName: String(data.authorName || ''),
    tags: normalizeTags(data.tags),
    updatedAt: String(data.updatedAt || ''),
    path: routePath
  }
}

function validateBaseEntry(entry, filePath) {
  const requiredKeys = ['title', 'lang', 'categoryL1', 'categoryL2', 'authorId', 'authorName', 'updatedAt', 'path']
  for (const key of requiredKeys) {
    if (!entry[key]) {
      throw new Error(`Missing required field "${key}" in ${filePath}`)
    }
  }
}

function sortEntries(entries) {
  const collator = new Intl.Collator('zh-Hans-CN')

  const compareStage = (a, b) => {
    if (a.stage === undefined && b.stage === undefined) {
      return 0
    }
    if (a.stage === undefined) {
      return -1
    }
    if (b.stage === undefined) {
      return 1
    }

    const aNum = Number(a.stage)
    const bNum = Number(b.stage)
    const isANum = Number.isFinite(aNum)
    const isBNum = Number.isFinite(bNum)

    if (isANum && isBNum) {
      return aNum - bNum
    }

    return collator.compare(String(a.stage), String(b.stage))
  }

  return entries.sort((a, b) => {
    const dateDiff = String(b.updatedAt).localeCompare(String(a.updatedAt))
    if (dateDiff !== 0) {
      return dateDiff
    }

    const titleDiff = collator.compare(String(a.title), String(b.title))
    if (titleDiff !== 0) {
      return titleDiff
    }

    const stageDiff = compareStage(a, b)
    if (stageDiff !== 0) {
      return stageDiff
    }

    return String(a.path).localeCompare(String(b.path))
  })
}

async function main() {
  const files = await listMarkdownFiles(CONTENT_ROOT)
  const byLocale = Object.fromEntries(SUPPORTED_LOCALES.map((locale) => [locale, []]))

  for (const filePath of files) {
    const relativePath = path.relative(CONTENT_ROOT, filePath)
    const pathParts = relativePath.split(path.sep)
    const topLevelDir = pathParts[0]
    const secondLevelDir = pathParts[1]
    const routePath = toRoutePath(relativePath)
    const basename = path.basename(filePath, '.md')

    // examples 目录仅用于演示，不参与线上检索索引。
    if (topLevelDir === 'examples') {
      continue
    }

    // 作者静态主页内容不进入攻略检索索引。
    if (SUPPORTED_LOCALES.includes(topLevelDir) && secondLevelDir === 'authors') {
      continue
    }

    // 专题页和语言首页只用于静态路由/SEO，不进入检索索引。
    if (basename === '_index' || basename === 'index') {
      continue
    }

    const markdown = await fs.readFile(filePath, 'utf8')
    const data = parseFrontmatter(markdown, relativePath)

    if (!SUPPORTED_LOCALES.includes(String(data.lang))) {
      throw new Error(`Unsupported lang "${String(data.lang)}" in ${relativePath}`)
    }

    if (data.draft === true) {
      continue
    }

    const baseEntry = createBaseEntry(data, routePath)
    validateBaseEntry(baseEntry, relativePath)

    const stages = normalizeStages(data.stages)
    if (stages.length > 0) {
      for (const stage of stages) {
        const anchor = getStageAnchor(data.stageAnchors, stage)
        byLocale[baseEntry.lang].push({
          ...baseEntry,
          stage,
          path: anchor ? `${routePath}#${anchor}` : routePath
        })
      }
      continue
    }

    byLocale[baseEntry.lang].push(baseEntry)
  }

  await fs.mkdir(OUTPUT_ROOT, { recursive: true })

  for (const locale of SUPPORTED_LOCALES) {
    const outputFile = path.join(OUTPUT_ROOT, `search-index.${locale}.json`)
    const items = sortEntries(byLocale[locale])
    await fs.writeFile(outputFile, JSON.stringify(items, null, 2) + '\n', 'utf8')
    console.log(`Generated ${path.relative(process.cwd(), outputFile)} (${items.length} items)`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
