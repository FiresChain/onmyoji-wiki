# Onmyoji Wiki

基于 Nuxt Content(MDC) 的阴阳师 Wiki，集成 `yys-editor` 流程图预览能力。

## 当前状态

- 已支持 Markdown 内容渲染（`ContentRenderer`）
- 已支持统一语法 `onmyoji-editor` 代码块渲染流程图
- 支持两种模式：
  - `type="file"`：引用外部 `src` JSON
  - `type="block"`：内联 JSON 数据

## 技术栈

- Nuxt 3
- @nuxt/content 3
- Vue 3
- yys-editor 1.x

## 快速开始

```bash
npm install
npm run dev
```

默认访问 `http://localhost:3000`（端口占用时会自动切换）。

## 构建与预览

```bash
npm run build
npm run preview
```

## 内容与路由

- 主页内容：`content/index.md`
- 其他页面：`content/**/*.md`
- 动态渲染入口：`pages/[...slug].vue`

例如：`content/examples/flow-demo.md` 对应路由 `/examples/flow-demo`。

## onmyoji-editor 语法

### 1. 文件引用（type=file）

````md
```onmyoji-editor{type="file" src="/data/flows/test-flow.json" :height="500"}
```
````

### 2. 内联数据（type=block）

````md
```onmyoji-editor{type="block"}
{
  "height": 320,
  "schemaVersion": 1,
  "fileList": [],
  "activeFileId": "flow-1",
  "activeFile": "File 1"
}
```
````

## 目录结构

```text
onmyoji-wiki/
├─ components/
│  └─ FlowPreview.vue
├─ content/
│  ├─ index.md
│  └─ examples/flow-demo.md
├─ docs/
│  ├─ 1management/
│  ├─ 2design/
│  ├─ 3build/
│  ├─ 3usage/
│  └─ 4test/
├─ pages/
│  ├─ index.vue
│  └─ [...slug].vue
├─ public/
│  ├─ assets/
│  └─ data/flows/
├─ content.config.ts
├─ nuxt.config.ts
└─ app.vue
```

## 规划方向

- 保持访客端为静态 Wiki（SEO 友好）
- 在 `/editor` 路径集成 Milkdown 编辑器
- 通过插件方式接入 yys-editor 进行图编辑

详细计划见 `docs/1management/plan.md`。
