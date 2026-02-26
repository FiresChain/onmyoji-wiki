# onmyoji-wiki 验收测试点（手工）

目标：覆盖“编辑器 / 流程块 / 协作包 / 资产兼容 / 规则提示”相关需求，按步骤勾选验证。

## 0. 版本与入口

- 站点入口（GitHub Pages 子路径部署）：`/onmyoji-wiki/`
- 编辑器页面：`/onmyoji-wiki/editor/`
- 示例页面：`/onmyoji-wiki/examples/flow-demo`

验收前置：
- 确认 Pages 已部署最新 `main`。
- 浏览器建议：Chrome（便于测试 File System Access API）。

## 1. 页面可用性与部署路径

步骤：
- 打开 `/onmyoji-wiki/`，再进入 `/onmyoji-wiki/editor/`。

预期：
- 页面不出现 500/白屏。
- 控制台不应出现 `_nuxt/*.js`、`_nuxt/*.css` 的 404。
- 访问静态资源时不应错误请求到根路径 `https://<domain>/assets/...`（应带 `/onmyoji-wiki/` 前缀）。

失败时排查：
- `nuxt.config.ts` 的 `app.baseURL` 与 Actions 的 `NUXT_APP_BASE_URL` 是否一致。

## 2. Milkdown 工具栏命令（加粗/斜体等）（已完成）

步骤：
- 先切换到“可视编辑”或“双栏”模式。
- 在正文输入一段文字并选中。
- 点击工具栏：加粗、斜体、H2、H3、无序列表、有序列表、代码块、撤销、重做。

预期：
- 所有命令生效，Markdown 输出正确变化。
- H2/H3 会将当前段落设置为二/三级标题（对应 `##` / `###`）。

失败时排查：
- `components/editor/MilkdownEditor.client.vue` 的 `executeCommand(...)` 执行路径。
- 先看 `[milkdown command] start`：若 `activeInProseMirror=false`，优先排查焦点未进入 `.ProseMirror`（首次进入常见）。
- 再看 `candidate result / candidate threw`：确认是否 `commandsCtx.call(...)` 返回 `false` 或抛错。
- `pages/editor.vue` 工具栏是否阻止了鼠标点击导致的选区丢失（`@mousedown` 处理）。

## 12. 编辑视图切换（可视 / Markdown / 双栏）

步骤：
- 点击“视图模式”切换：可视编辑、Markdown、双栏。
- 在 Markdown 模式修改源码，切到可视编辑确认内容保持一致。
- 在双栏模式观察左侧 Markdown 与右侧可视编辑是否同步。

预期：
- 3 种模式都可切换且不报错。
- Markdown 与可视编辑同步（模式切换后内容保持一致）。
- 双栏模式下：左侧 Markdown 源码、右侧可视编辑。
- 工具栏格式命令在“可视编辑 / 双栏”可用，在“Markdown”禁用。

## 3. 流程块插入、渲染与编辑

步骤：
- 点击“插入流程块”。
- 在正文中看到流程块预览（含内联按钮）。
- 点击“编辑流程块”打开弹窗，添加/拖动节点，保存应用到块。

预期：
- 预览可渲染且可打开编辑弹窗。
- 关闭并再次打开编辑弹窗，数据保持一致。

失败时排查：
- `components/editor/MilkdownEditor.client.vue` 的 Flow NodeView 实现。
- `pages/editor.vue` 的 `openFlowBlockEditor(...)` / `applyFlowBlockChanges(...)`。

## 4. 流程块位置调整（上移/下移）

步骤：
- 插入至少 2 个流程块，确保能区分顺序。
- 在“流程块管理区”点击某个块的“上移/下移”。
- 在正文内联块上点击“上移/下移”。

预期：
- 两种入口都能调整块顺序。
- 调整后 Markdown 中的块顺序真实变化（刷新后仍保持）。

失败时排查：
- `pages/editor.vue` 的 `moveFlowBlock(...)` 与序列化替换逻辑。

## 5. 光标与可编辑性（流程块在文档末尾）

目的：验证“流程块在最后一块时，光标无法切换到文档最后、无法继续输入”的问题是否存在。

步骤：
- 在文档末尾插入一个流程块，使它成为最后一个 block。
- 将鼠标点击到流程块后方，尝试把光标放到流程块之后并继续输入。
- 用键盘方向键/End 键/点击空白区域尝试将光标移动到最后。

预期：
- 光标可以落在流程块之后；可以在其后继续输入任意文字。

记录：
- 若失败，记录复现步骤、浏览器版本、是否仅发生在末尾/中间。

排查点：
- `components/editor/MilkdownEditor.client.vue` NodeView 的 `stopEvent` / `ignoreMutation` / `contentDOM` 相关行为。

## 6. 流程块高度调整（入口与生效）

步骤：
- 在“流程块管理区”找到某个块的高度输入框，修改高度。
- 打开编辑弹窗，调整“高度”输入框，点击“应用到块”。

预期：
- 预览高度立即改变（不需要刷新）。
- 保存后刷新页面，仍是新高度。

失败时排查：
- `pages/editor.vue` 的 `updateFlowBlockHeight(...)`、`resolvePreviewHeight(...)`。

## 7. 协作包（zip）导出

步骤：
- 生成至少 1 个流程块并填入一定内容。
- 点击“导出协作包(zip)”。
- 解压 zip，检查文件结构。

预期（结构）：
- `wiki-editor.md`：Markdown 正文。
- `flows/flow-1.json`、`flows/flow-2.json`...：每个流程块独立 JSON。
- `manifest.json`：索引（包含流程块与文件映射）。

补充预期（引用策略）：
- 若当前实现仍将 JSON 内联保留在 Markdown 中：记录为“未完成项”，后续应改为 Markdown 中仅保留引用（例如 `src` 指向 `flows/*.json`）。

## 8. 协作包（zip）导入

步骤：
- 点击导入按钮，选择一个之前导出的 zip。

预期：
- 编辑器载入 zip 内的 `wiki-editor.md` 内容。
- 若 zip 还包含流程 JSON：导入后流程块可正常渲染（是否引用/是否内联取决于实现策略）。

失败时排查：
- `pages/editor.vue` 的 `parseImportedContent(...)` / `handleImport(...)`。

## 9. 资产兼容策略（缺失/不可访问资源）

目的：为后续 File System Access、本地缓存与用户自定义素材做兼容准备。

步骤：
- 构造一个流程块，其素材 avatar 为 `file://...` 或 `blob:...` 或一个不存在的 `/assets/...`。
- 观察预览行为。

预期：
- 默认策略为“降级渲染 + 提示”，不应阻断页面。
- 可看到“资产兼容提示”汇总（编辑器管理区或预览提示）。

排查点：
- `utils/flow-assets.ts` 的 issue 收集与 rewrite 行为。
- `components/FlowPreview.vue`、`pages/editor.vue` 的提示渲染。

## 10. 规则检查入口与分组（提示）

说明（当前实现假设）：
- 规则检查以“分组”为单位；分组来自流程图节点的 `meta.groupId`。
- wiki 侧规则提示展示在 `/editor` 流程块管理区（汇总提示）。

步骤：
- 在流程编辑弹窗中创建动态分组（Dynamic Group），将式神与御魂节点放入同组。
- 构造规则样例：
  - 同组放“辉夜姬 + 破势”
  - 同组放“千姬 + 腹肌清姬/蝮骨清姬”
  - 同组只有式神但没有供火式神
- 关闭弹窗回到管理区，观察提示。

预期：
- 能看到规则提示（按 groupId 汇总）。

失败时排查：
- `utils/flow-rules.ts` 的规则识别（节点类型、library 推断）。
- 流程编辑器是否真的写入 `meta.groupId`。

## 11. 回归清单（你本轮反馈的现象）

- [x] 工具栏加粗/斜体点击无效（必须验证修复与否）。
- [ ] 流程块在文档末尾导致无法把光标放到末尾并继续输入。
- [ ] 流程块高度调整入口不明显或不生效。
- [ ] 协作包导出后 Markdown 仍内联所有数据（应确认实现是否符合“引用”预期）。
- [ ] 协作包导入入口/功能是否可用（zip 导入是否可见、是否能恢复流程）。
- [ ] 规则检查入口在哪里、分组如何操作（UI 是否可理解）。

