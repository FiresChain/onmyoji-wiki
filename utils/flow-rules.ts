import type { GraphData } from '~/utils/flow-preview'

export type ShikigamiYuhunBlacklistRule = {
  shikigami: string
  yuhun: string
  message?: string
}

export type ShikigamiConflictRule = {
  left: string
  right: string
  message?: string
}

export type GroupRulesConfig = {
  version: number
  fireShikigamiWhitelist: string[]
  shikigamiYuhunBlacklist: ShikigamiYuhunBlacklistRule[]
  shikigamiConflictPairs: ShikigamiConflictRule[]
}

export type GroupRuleWarning = {
  code: 'SHIKIGAMI_YUHUN_BLACKLIST' | 'SHIKIGAMI_CONFLICT' | 'MISSING_FIRE_SHIKIGAMI'
  groupId: string
  nodeIds: string[]
  message: string
}

export const DEFAULT_GROUP_RULES_CONFIG: GroupRulesConfig = {
  version: 1,
  fireShikigamiWhitelist: ['辉夜姬', '因幡辉夜姬', '追月神', '座敷童子', '千姬', '帝释天', '食灵'],
  shikigamiYuhunBlacklist: [
    {
      shikigami: '辉夜姬',
      yuhun: '破势',
      message: '规则冲突：辉夜姬通常不建议携带破势。'
    }
  ],
  shikigamiConflictPairs: [
    {
      left: '千姬',
      right: '腹肌清姬',
      message: '规则冲突：千姬与腹肌清姬不建议同队。'
    },
    {
      left: '千姬',
      right: '蝮骨清姬',
      message: '规则冲突：千姬与蝮骨清姬不建议同队。'
    }
  ]
}

const normalizeText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

const inferLibrary = (node: any): string => {
  const library = normalizeText(node?.properties?.assetLibrary)
  if (library) {
    return library
  }
  const avatar = normalizeText(node?.properties?.selectedAsset?.avatar)
  if (avatar.includes('/Yuhun/')) {
    return 'yuhun'
  }
  if (avatar.includes('/Shikigami/')) {
    return 'shikigami'
  }
  return normalizeText(node?.properties?.selectedAsset?.library)
}

export const validateGraphGroupRules = (
  graphData: GraphData,
  config: GroupRulesConfig = DEFAULT_GROUP_RULES_CONFIG
): GroupRuleWarning[] => {
  const warnings: GroupRuleWarning[] = []
  const groupMap = new Map<string, {
    nodeIds: string[]
    shikigamiNames: string[]
    yuhunNames: string[]
  }>()

  const nodes = Array.isArray(graphData?.nodes) ? graphData.nodes : []
  nodes.forEach((node) => {
    if (node?.type !== 'assetSelector') {
      return
    }
    const groupId = normalizeText(node?.properties?.meta?.groupId)
    if (!groupId) {
      return
    }
    const name = normalizeText(node?.properties?.selectedAsset?.name)
    if (!name) {
      return
    }

    if (!groupMap.has(groupId)) {
      groupMap.set(groupId, { nodeIds: [], shikigamiNames: [], yuhunNames: [] })
    }

    const snapshot = groupMap.get(groupId)!
    snapshot.nodeIds.push(node.id)
    const library = inferLibrary(node)
    if (library === 'shikigami') {
      snapshot.shikigamiNames.push(name)
    } else if (library === 'yuhun') {
      snapshot.yuhunNames.push(name)
    }
  })

  groupMap.forEach((snapshot, groupId) => {
    config.shikigamiYuhunBlacklist.forEach((rule) => {
      if (snapshot.shikigamiNames.includes(rule.shikigami) && snapshot.yuhunNames.includes(rule.yuhun)) {
        warnings.push({
          code: 'SHIKIGAMI_YUHUN_BLACKLIST',
          groupId,
          nodeIds: snapshot.nodeIds,
          message: rule.message || `规则冲突：${rule.shikigami} 不建议携带 ${rule.yuhun}。`
        })
      }
    })

    config.shikigamiConflictPairs.forEach((rule) => {
      if (snapshot.shikigamiNames.includes(rule.left) && snapshot.shikigamiNames.includes(rule.right)) {
        warnings.push({
          code: 'SHIKIGAMI_CONFLICT',
          groupId,
          nodeIds: snapshot.nodeIds,
          message: rule.message || `规则冲突：${rule.left} 与 ${rule.right} 不建议同队。`
        })
      }
    })

    if (snapshot.shikigamiNames.length > 0) {
      const hasFire = snapshot.shikigamiNames.some((name) => config.fireShikigamiWhitelist.includes(name))
      if (!hasFire) {
        warnings.push({
          code: 'MISSING_FIRE_SHIKIGAMI',
          groupId,
          nodeIds: snapshot.nodeIds,
          message: '规则提示：当前分组未检测到鬼火式神，建议补充供火位。'
        })
      }
    }
  })

  return warnings
}
