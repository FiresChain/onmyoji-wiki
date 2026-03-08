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
  kaze: {
    id: 'kaze',
    name: '畅畅any',
    tagline: '实战拆解与配队向创作者',
    bio: '聚焦实战回合与配装细节，强调阵容思路与可落地替换方案。',
    specialties: ['实战解析', '阵容构筑', '配装思路'],
    avatar: '/authors/changchangany.jpg'
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
