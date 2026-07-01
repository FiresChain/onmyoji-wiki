<script setup lang="ts">
import { getSiteLocaleFromPath, withSiteLocalePrefix } from '~/utils/site-locale'

const route = useRoute()
const currentLocale = computed(() => getSiteLocaleFromPath(route.path) || 'zh-CN')

const footerText = computed(() => {
  if (currentLocale.value === 'vi') {
    return {
      brand: 'Bách khoa Onmyoji',
      description: 'Trang bách khoa và hướng dẫn Onmyoji do cộng đồng đóng góp, nội dung được render từ tài liệu Markdown.',
      content: 'Nội dung',
      tools: 'Công cụ',
      shikigami: 'Bách khoa thức thần',
      onmyoji: 'Nhân vật Âm Dương Sư',
      guides: 'Trung tâm hướng dẫn',
      editor: 'Trình biên tập',
      flowDemo: 'Ví dụ flow',
      authors: 'Tác giả',
      note: 'Đây là dự án fan-made không chính thức, không liên quan đến NetEase. Onmyoji và các tài nguyên liên quan thuộc về chủ sở hữu bản quyền tương ứng.'
    }
  }

  return {
    brand: '阴阳师百科',
    description: '社区驱动的阴阳师图鉴与攻略站点，正文内容基于 Markdown 文档渲染。',
    content: '内容',
    tools: '工具',
    shikigami: '式神百科',
    onmyoji: '阴阳师角色',
    guides: '攻略中心',
    editor: '编辑器',
    flowDemo: '流程图示例',
    authors: '创作者',
    note: '本站为非官方粉丝项目，与网易公司无关。阴阳师及相关素材版权归原作者所有。'
  }
})

const localizedPath = (path: string) => withSiteLocalePrefix(path, currentLocale.value)
</script>

<template>
  <footer class="site-footer">
    <div class="site-container">
      <div class="site-footer-top">
        <section>
          <div class="site-brand">
            <span class="site-brand-badge">{{ currentLocale === 'vi' ? 'Âm' : '阴' }}</span>
            <span class="site-brand-text">
              <strong>{{ footerText.brand }}</strong>
              <small>Onmyoji Wiki</small>
            </span>
          </div>
          <p class="site-footer-text">
            {{ footerText.description }}
          </p>
        </section>

        <section class="site-footer-links">
          <div>
            <h3>{{ footerText.content }}</h3>
            <NuxtLink :to="localizedPath('/shikigami')">{{ footerText.shikigami }}</NuxtLink>
            <NuxtLink :to="localizedPath('/onmyoji')">{{ footerText.onmyoji }}</NuxtLink>
            <NuxtLink :to="localizedPath('/guides')">{{ footerText.guides }}</NuxtLink>
          </div>
          <div>
            <h3>{{ footerText.tools }}</h3>
            <NuxtLink :to="localizedPath('/editor')">{{ footerText.editor }}</NuxtLink>
            <NuxtLink to="/examples/flow-demo">{{ footerText.flowDemo }}</NuxtLink>
            <NuxtLink :to="localizedPath('/authors')">{{ footerText.authors }}</NuxtLink>
          </div>
        </section>
      </div>

      <div class="divider-ornament" />
      <p class="site-footer-note">
        {{ footerText.note }}
      </p>
    </div>
  </footer>
</template>
