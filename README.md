# Onmyoji Wiki

基于 Nuxt Content 的阴阳师 Wiki，集成了 yys-editor 流程图预览功能。

## 功能特性

- ✅ Markdown 文档管理
- ✅ 流程图预览（基于 yys-editor）
- ✅ 支持自定义节点（imageNode, textNode, vectorNode 等）
- ✅ 只读模式，支持查看、缩放、导出
- ✅ 支持内联数据和外部 JSON 文件

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000 (如果端口被占用，会自动使用其他端口)

### 构建生产版本

```bash
npm run build
npm run preview
```

## 使用流程图预览

### 方式一：内联数据

在 Markdown 文件中使用 MDC 语法：

```markdown
::flow-preview
---
data:
  nodes:
    - id: start
      type: circle
      x: 100
      y: 100
      text: { value: "开始" }
    - id: end
      type: circle
      x: 300
      y: 100
      text: { value: "结束" }
  edges:
    - sourceNodeId: start
      targetNodeId: end
      type: polyline
height: 300
---
::
```

### 方式二：外部 JSON 文件

```markdown
::flow-preview{src="/data/flows/test-flow.json" height="500"}
::
```

JSON 文件格式：

```json
{
  "nodes": [
    {
      "id": "node1",
      "type": "imageNode",
      "x": 100,
      "y": 100,
      "properties": {
        "imageUrl": "https://example.com/image.png",
        "width": 100,
        "height": 100
      }
    }
  ],
  "edges": [
    {
      "id": "edge1",
      "type": "polyline",
      "sourceNodeId": "node1",
      "targetNodeId": "node2"
    }
  ]
}
```

## 项目结构

```
onmyoji-wiki/
├── app/
│   ├── components/
│   │   └── FlowPreview.vue          # 流程图预览组件
│   ├── pages/
│   │   ├── index.vue                 # 首页
│   │   └── examples/
│   │       └── flow-demo.vue         # 流程图示例页面
│   └── app.vue                       # 应用入口
├── content/
│   ├── index.md                      # 首页内容（未使用）
│   └── examples/
│       └── flow-demo.md              # 示例文档（未使用）
├── public/
│   └── data/
│       └── flows/
│           └── test-flow.json        # 测试数据
├── nuxt.config.ts                    # Nuxt 配置
└── package.json
```

**注意**: 当前版本直接使用 Vue 页面而不是 Nuxt Content 的 Markdown 渲染，因为遇到了 `queryContent` 导入问题。

## 示例

访问以下页面查看效果：
- 首页: http://localhost:3001 (端口可能不同)
- 流程图示例: http://localhost:3001/examples/flow-demo

**重要**: FlowPreview 组件使用 ClientOnly 包装，在服务端渲染时不会显示内容。请在浏览器中打开页面查看流程图效果。

## 技术栈

- Nuxt 4.3.1
- Nuxt Content 3.11.2
- yys-editor 1.0.4
- Vue 3.5.28

## 维护

### 更新 yys-editor

```bash
npm update yys-editor
```

yys-editor 的新节点类型会自动支持，无需修改代码。

## 参考

- [Nuxt Content 文档](https://content.nuxt.com/)
- [yys-editor 项目](../yys-editor/)
