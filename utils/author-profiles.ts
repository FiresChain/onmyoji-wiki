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
    name: '惰落珈百璃',
    tagline: 'PVE 阵容与副本向创作者',
    bio: '偏好稳定、可复现的副本攻略，注重实战可抄与低门槛上手。',
    specialties: ['御魂副本', '秘闻副本', '阵容教学'],
    avatar: '/authors/duoluojiabaili.jpg'
  },
  xc128067: {
    id: 'xc128067',
    name: '畅畅any',
    tagline: '实战拆解与配队向创作者',
    bio: '每晚18:30直播 送灯牌免费看号做阵容! 不接任何阴阳师业务!',
    specialties: ['实战解析', '阵容构筑', '配装思路'],
    avatar: '/authors/changchangany.jpg'
  },
  'matrix-doctor': {
    id: 'matrix-doctor',
    name: '矩阵博士',
    tagline: '竞速流程与阵容配置创作者',
    bio: '专注阴阳师竞速阵容与流程整理，提供可参考的配速、面板与操作说明。',
    specialties: ['秘闻竞速', '阵容配置', '流程拆解']
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
