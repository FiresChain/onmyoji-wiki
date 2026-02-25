# onmyoji-wiki 项目计划（Wiki + 编辑器双态）

## 项目概述

- 项目名称：onmyoji-wiki
- 目标：构建一个可 SEO 的静态 Wiki，同时在指定路径提供接近 Notion/Confluence 的编辑体验
- 核心技术方向：Nuxt Content(MDC) + Milkdown + yys-editor 插件化嵌入 + 双存储（localStorage / File System Access API）
- 当前日期基线：2026-02-24

## 目标架构

### 模式 A：静态内容站（面向访客）

- 使用 Nuxt Content + MDC 渲染页面
- 支持静态生成与 SEO
- 流程图仅使用 render-only 预览能力（默认禁用快捷键/编辑交互）

### 模式 B：管理端编辑器（面向作者）

- 路径建议：`/editor`
- 集成 Milkdown 作为主编辑器
- 通过 Milkdown 自定义块/指令打开 yys-editor 进行图编辑
- 保存时将图数据回写到 Markdown（内联或外部 JSON）
- 支持两种保存方式：浏览器 localStorage（默认）与本地目录文件回写（可选）

## 范围定义

### 本期范围（In Scope）

- 打通 Markdown -> MDC -> FlowPreview 渲染链路
- 设计并实现 yys-editor 插件分级策略（render-only/interactive）
- 在 editor 路径落地 Milkdown 编辑能力
- 设计并实现双存储策略（localStorage / File System Access API）
- 建立内容发布流程（草稿、审核、发布）

### 非本期范围（Out of Scope）

- 多人实时协作（CRDT）
- 复杂权限模型（细粒度 RBAC）
- 全量可视化页面搭建器

## 里程碑计划

| 里程碑 | 时间窗口 | 目标 | 状态 |
|------|------|------|------|
| M1 | 第 1 周 | 稳定内容渲染链路与 FlowPreview 数据规范 | 进行中 |
| M2 | 第 2 周 | yys-editor 插件分级与安全模式（静态页默认安全） | 已完成 |
| M3 | 第 3 周 | Milkdown 基础接入（/editor）与双存储能力 | 未开始 |
| M4 | 第 4 周 | Milkdown <-> yys-editor 块联动编辑 | 未开始 |
| M5 | 第 5 周 | 发布流程、SEO、构建优化 | 未开始 |
| M6 | 第 6 周 | 回归测试、文档完善、灰度上线 | 未开始 |

## 模块进度基线

| 模块 | 完成度 | 状态 | 备注 |
|------|--------|------|------|
| 内容站基础（Nuxt Content + MDC） | 40% | 进行中 | 已可渲染内容页 |
| FlowPreview 展示链路 | 55% | 进行中 | 已可展示，待增强响应式与错误态 |
| yys-editor 插件化接口 | 100% | 已完成 | 已支持 render-only/interactive 分级与插件/节点注入 |
| Milkdown 编辑体验 | 0% | 未开始 | 尚未接入 |
| 编辑器持久化（localStorage / File System Access） | 0% | 未开始 | 尚未实现存储驱动与目录回写 |
| Editor 路径与鉴权 | 0% | 未开始 | 尚未实现 |
| 发布与回滚流程 | 0% | 未开始 | 尚未建立 |
| 测试与质量门禁 | 5% | 未开始 | 仅有基础构建验证 |

**总体完成度：29%**

## 关键任务拆解

### 阶段 1：稳定静态展示能力

1. 规范 flow 数据格式（`GraphData` 与导出数据兼容）
2. FlowPreview 增加 `src/data` 变更监听与错误态展示
3. 引入 `content.config.ts` 明确 collection/schema
4. 修订 README 与实际实现一致

### 阶段 2：插件安全分级

1. 在 yys-editor 暴露插件注入入口（插件与节点注册解耦）
2. 定义 `render-only` 与 `interactive` 两级能力
3. 静态站默认 `render-only`
4. editor 编辑态按需启用 `interactive`

### 阶段 3：Milkdown 编辑端

1. 新增 `/editor` 页面壳
2. 集成 Milkdown 基础编辑器
3. 抽象存储驱动（`localStorage` / `file-system`）
4. 实现本地目录打开与文件读写回写（File System Access API）
5. 实现 localStorage 兜底与导入/导出能力（不支持 FSA 浏览器可用）
6. 实现 yys-editor 块插件（打开、编辑、写回）
7. 统一序列化策略（Markdown 内联/外部 JSON）

### 阶段 4：发布与质量

1. 草稿-审核-发布流程定义
2. SSG/SEO 验收与性能优化
3. E2E 回归用例（关键路径）
4. 上线与回滚预案

## 风险与应对

| 风险 | 影响 | 应对策略 |
|------|------|------|
| 快捷键污染静态页面 | 高 | 静态页强制 render-only；快捷键仅 editor 且焦点内生效 |
| SSR/SSG 构建失败 | 高 | 插件初始化仅客户端执行；失败自动降级为纯渲染 |
| 数据格式漂移 | 中 | 统一 schema 版本与迁移器 |
| File System Access API 浏览器兼容性不足 | 中 | 默认 localStorage；仅在支持浏览器启用目录模式并提示能力差异 |
| 包体积过大 | 中 | 编辑端按路由分包，前台不加载交互插件 |
| 资源路径不一致 | 中 | 统一 assetBaseUrl 与同步脚本 |

## 验收标准

1. 访客路径可静态渲染并通过 SEO 基础检查
2. Markdown 中流程图在无交互插件下稳定展示
3. `/editor` 可编辑并保存图数据，回到访客页可正确渲染
4. `/editor` 支持 localStorage 模式保存/恢复
5. `/editor` 在支持浏览器下可打开本地目录并保存回原文件
6. 构建与预览命令可稳定执行
7. 关键流程具备最小回归测试

## 进度更新规则

- 仅在用户明确确认“某任务已完成”后，更新对应步骤与总体完成度
- 未确认完成前，不主动修改完成百分比
- 只更新被确认完成的模块，其他条目保持不变

## 更新记录

- 2026-02-25：/editor 中 yys-flow 编辑弹层尺寸修复；支持 yys-flow 顶层 `height` 解析与序列化
- 2026-02-24：初始化计划文档（v1.0），建立双态架构与 6 周里程碑
- 2026-02-24：完成阶段 2（插件安全分级），前台默认 render-only，editor 按需 interactive
- 2026-02-24：新增编辑端双存储策略规划（localStorage 默认 + File System Access API 可选）
