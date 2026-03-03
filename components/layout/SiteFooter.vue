<template>
  <footer class="site-footer">
    <div class="site-container">
      <div class="site-footer-top">
        <section>
          <div class="site-brand">
            <span class="site-brand-badge">阴</span>
            <span class="site-brand-text">
              <strong>阴阳师百科</strong>
              <small>Onmyoji Wiki</small>
            </span>
          </div>
          <p class="site-footer-text">
            社区驱动的阴阳师图鉴与攻略站点，正文内容基于 Markdown 文档渲染。
          </p>
        </section>

        <section class="site-footer-links">
          <div>
            <h3>内容</h3>
            <NuxtLink to="/shikigami">式神百科</NuxtLink>
            <NuxtLink to="/onmyoji">阴阳师角色</NuxtLink>
            <NuxtLink to="/guides">攻略中心</NuxtLink>
          </div>
          <div>
            <h3>工具</h3>
            <NuxtLink to="/editor">编辑器</NuxtLink>
            <NuxtLink to="/examples/flow-demo">流程图示例</NuxtLink>
            <NuxtLink to="/authors">创作者</NuxtLink>
          </div>
        </section>
      </div>

      <div class="divider-ornament" />
      <p class="site-footer-note">
        本站为非官方粉丝项目，与网易公司无关。阴阳师及相关素材版权归原作者所有。
      </p>
    </div>
  </footer>
</template>

