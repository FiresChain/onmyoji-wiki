import { defineCollection, defineContentConfig, z } from '@nuxt/content'

export default defineContentConfig({
  collections: {
    content: defineCollection({
      type: 'page',
      source: '**/*.md',
      schema: z.object({
        title: z.string(),
        lang: z.enum(['zh', 'en']),
        translationKey: z.string(),
        categoryL1: z.string(),
        categoryL2: z.string(),
        authorId: z.string(),
        authorName: z.string(),
        updatedAt: z.string(),
        summary: z.string(),
        description: z.string().optional(),
        tags: z.array(z.string()).optional(),
        difficulty: z.string().optional(),
        buildType: z.string().optional(),
        cover: z.string().optional(),
        draft: z.boolean().optional(),
        noindex: z.boolean().optional(),
        stages: z.array(z.union([z.string(), z.number()])).optional(),
        stageAnchors: z.record(z.string(), z.string()).optional()
      })
    })
  }
})
