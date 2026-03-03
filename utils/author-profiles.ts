export type AuthorProfile = {
  id: string
  name: string
  tagline: string
  bio: string
  specialties: string[]
  avatar?: string
}

export const AUTHOR_PROFILES: Record<string, AuthorProfile> = {
  sakura: {
    id: 'sakura',
    name: '樱花散',
    tagline: '副本与养成向创作者',
    bio: '主打 PVE 稳定通关、低容错队伍与资源规划内容，偏好从新手成长曲线出发写攻略。',
    specialties: ['御魂副本', '秘闻副本', '新手养成']
  },
  kaze: {
    id: 'kaze',
    name: '风之痕',
    tagline: '斗技实战分析作者',
    bio: '关注斗技环境与速度博弈，擅长拆分先后手对局思路，提供可复盘的实战策略。',
    specialties: ['斗技对抗', '阵容克制', '速度体系']
  }
}

export function getAuthorProfile(authorId: string, fallbackName?: string): AuthorProfile {
  const profile = AUTHOR_PROFILES[authorId]
  if (profile) {
    return profile
  }

  return {
    id: authorId,
    name: fallbackName || authorId,
    tagline: '社区创作者',
    bio: `${fallbackName || authorId} 的攻略合集（mock 资料）。`,
    specialties: ['攻略整理']
  }
}
