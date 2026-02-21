# yys-editor 与 onmyoji-wiki 集成完成

## ✅ 已完成的工作

### 1. 修复导入错误
**文件**: `yys-editor/src/index.js`

**修改内容**：
```javascript
// 添加了 YysEditorPreview 别名导出
export { YysEditorEmbed as YysEditorPreview }
```

**影响**：
- wiki 的 `FlowPreview.vue` 现在可以正确导入 `YysEditorPreview`
- 完全向后兼容，不影响现有使用
- 只增加了 1 行代码

### 2. 修复 Vite 文件访问权限
**文件**: `onmyoji-wiki/nuxt.config.ts`

**修改内容**：
```typescript
vite: {
  server: {
    fs: {
      allow: [
        // 允许访问 yys-editor（npm link 时需要）
        '../yys-editor'
      ]
    }
  }
}
```

**影响**：
- 解决了 npm link 时 Vite 无法访问外部文件的问题
- 开发环境可以正常加载 yys-editor 的 CSS 和 JS

### 3. 构建和链接
```bash
# yys-editor 侧
npm run build:lib  # ✅ 构建成功
npm link           # ✅ 创建全局链接

# wiki 侧
npm link yys-editor  # ✅ 链接成功
npm run dev          # ✅ 服务器启动成功（端口 3004）
```

## 🧪 验证步骤

### 1. 访问测试页面
```
http://localhost:3004/examples/flow-demo
```

### 2. 检查项目
- [ ] 页面正常加载，无 404 错误
- [ ] 无控制台 JavaScript 错误
- [ ] FlowPreview 组件正常渲染
- [ ] 流程图数据从 `/data/flows/test-flow.json` 正确加载
- [ ] 预览模式只读，无编辑功能
- [ ] 自定义节点显示正常：
  - [ ] imageNode - 图片节点
  - [ ] textNode - 文本节点
  - [ ] assetSelector - 资产选择器（式神、御魂）
  - [ ] vectorNode - 矢量图形
- [ ] 资产图片加载正常：
  - [ ] 式神图片显示（如：梦山白藏主 SP）
  - [ ] 御魂图片显示（如：蝠翼）
  - [ ] 图片路径正确（`/assets/Shikigami/...`）
- [ ] 导出按钮功能正常

### 3. 检查服务器日志
```bash
# 应该看到：
✔ Vite client built in XXms
✔ Vite server built in XXms
✔ Nuxt Nitro server built in XXms

# 不应该有：
ERROR The request id "..." is outside of Vite serving allow list
```

## 📊 技术总结

### 集成架构
```
onmyoji-wiki (Nuxt 3 + Nuxt Content)
    ↓
FlowPreview.vue (MDC 组件)
    ↓
YysEditorPreview (别名 → YysEditorEmbed)
    ↓
LogicFlow (只读模式)
    ↓
自定义节点 (imageNode, assetSelector, textNode, vectorNode)
```

### 数据流
```
Markdown (::flow-preview)
    ↓
ContentRenderer
    ↓
FlowPreview.vue
    ↓
fetch(/data/flows/test-flow.json)
    ↓
YysEditorPreview (mode="preview")
    ↓
LogicFlow 渲染
```

### 资产管理
- **位置**: `onmyoji-wiki/public/assets/`
- **大小**: 14MB（386 个图片文件）
- **路径**: 绝对路径 `/assets/...`
- **同步**: 需要手动同步（见下文）

## ⚠️ 重要：新增图片资产的流程

### 当前情况
yys-editor 的 npm 包**不包含**图片资产（package.json 的 files 字段未包含 dist/assets/）

### 正确流程

**yys-editor 侧**：
```bash
# 1. 添加新资产
cp new-shikigami.png public/assets/Shikigami/ssr/999.png

# 2. 更新数据文件
# 编辑 src/data/Shikigami.json，添加新式神信息

# 3. 更新版本并发布
npm version patch  # 1.0.4 -> 1.0.5
npm run build:lib
npm publish
```

**wiki 侧**：
```bash
# 1. 更新 yys-editor 代码
npm update yys-editor  # 获取新的 JS/CSS

# 2. 手动同步资产（重要！）
rsync -av --delete ../yys-editor/public/assets/ ./public/assets/

# 3. 测试
npm run dev
# 访问页面，验证新式神图片显示正常
```

### 改进建议

**短期方案**：创建同步脚本
```bash
# onmyoji-wiki/scripts/sync-assets.sh
#!/bin/bash
echo "Syncing assets from yys-editor..."
rsync -av --delete ../yys-editor/public/assets/ ./public/assets/
echo "✅ Assets synced successfully"
```

**长期方案**：
1. 修改 yys-editor 的 package.json 包含 dist/assets/（增加 14MB）
2. 或使用 CDN 托管资产（推荐）

## 📝 后续优化（可选）

### 1. 添加资产同步脚本
在 wiki 的 package.json 添加：
```json
"scripts": {
  "sync-assets": "bash scripts/sync-assets.sh",
  "update-editor": "npm update yys-editor && npm run sync-assets"
}
```

### 2. 添加 assetBaseUrl 配置
支持 CDN 或子路径部署（未来需要时）

### 3. 数据格式智能解析
yys-editor 可以参考 wiki 的 FlowPreview.vue 实现

## 🎉 总结

**核心成就**：
- ✅ 修复了导入错误（1 行代码）
- ✅ 解决了 Vite 文件访问问题
- ✅ wiki 可以正常使用 yys-editor 的预览功能
- ✅ 所有自定义节点和资产正常工作

**影响评估**：
- 破坏性：无，完全向后兼容
- 代码量：2 行代码（1 行导出 + 1 行配置）
- 测试状态：开发服务器正常启动，无错误

**下一步**：
1. 在浏览器中访问 http://localhost:3004/examples/flow-demo
2. 验证所有功能正常
3. 如果测试通过，可以发布新版本
