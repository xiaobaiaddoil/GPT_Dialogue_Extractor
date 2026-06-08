# v0.3 更新日志

## 1. 用户侧变化

### 1.1 移除“向上滚动补全历史”

行为变化：

- 点击导出时，插件直接读取当前页面 DOM 中已经加载的会话内容。
- 不会再为了补齐历史而改变当前滚动位置。
- 不会再重复触发“补全历史”流程。
- 导出状态文案从“正在向上滚动补齐历史”改为“正在整理导出数据”。

为什么这么改：

- 自动向上滚动会打断用户的当前阅读位置。
- 在长会话中滚动补全成本高，易造成进入页面或导出前卡顿。
- 所有内容在进入网页的时候已经dom中加载了

---

### 1.2 点击公式区域直接复制 LaTeX

v0.3 新增公式复制能力：页面中识别到的公式区域可以直接点击复制。

支持识别：

- KaTeX 公式：`.katex`、`.katex-display`
- MathJax 容器：`mjx-container`
- MathML：`math`
- 带公式数据的节点：`data-latex`、`data-tex`
- `script[type^="math/tex"]`
- KaTeX 中的原始 TeX 注解：`annotation[encoding="application/x-tex"]`


为什么这么改：

- 论文、数学推导、算法说明中的公式经常需要单独复用。
- 从 KaTeX / MathJax 的原始注解中提取 LaTeX，复制结果适合粘贴到 Markdown、LaTeX、Obsidian 或论文笔记中。
- 直接使用事件代理处理点击，不需要给每个公式绑定独立监听器，减少性能负担。

---


## 2. 代码改动明细

### 2.1 删除历史补全滚动逻辑

文件：`src/content/index.ts`

删除内容：

- `MAX_HISTORY_ITERATIONS`
- `STABLE_HISTORY_ROUNDS`
- `historyPrimedCacheKey`
- `lastHistoryLoadStrategy`
- `getConversationCacheKey()`
- `getActiveConversationCacheKey()`
- `ensureHistoryLoadedOnce()`
- `buildHistoryFingerprint()`
- `restoreScrollViewport()`
- `ensureFullHistoryLoaded()`

删除调用点：

- `prepareSelection(forceReload)` 中不再调用 `ensureHistoryLoadedOnce(forceReload)`。
- `prepareTimeline(forceReload)` 中不再调用 `ensureHistoryLoadedOnce(forceReload)`。
- `runExport(format)` 中不再调用 `ensureHistoryLoadedOnce(false)`。

原本功能保留：

- `collectConversation()` 仍负责从当前 DOM 读取消息。
- `renderSelectionList()` 仍负责刷新消息选择列表。
- `renderTimelineList()` 仍负责更新时间轴。
- JSON / Markdown / PDF / ZIP 导出流程保持不变。

---

### 2.2 新增公式复制标记与点击处理

文件：`src/content/index.ts`

新增常量：

- `FORMULA_COPY_TOAST_ID`
- `FORMULA_COPY_ATTR`

新增状态：

- `formulaCopyScanTimer`
- `formulaCopyToastTimer`

新增函数：

- `scheduleFormulaCopyEnhancement()`
- `enhanceFormulaCopyTargets(root = document.body)`
- `copyTextToClipboard(text)`
- `showFormulaCopyToast(anchor, message, tone)`
- `findFormulaCopyTarget(target)`
- `installFormulaCopyHandler()`

核心逻辑：

- 复用已有 `extractMathSource(node)` 提取原始 LaTeX。
- `enhanceFormulaCopyTargets()` 扫描顶层公式节点，并写入：
  - `data-cge-formula-copy="true"`
  - `data-cge-formula-latex="..."`
  - `cge-formula-copy-target` class
  - `title="点击复制公式 LaTeX"`
- `installFormulaCopyHandler()` 在 document 上注册捕获阶段点击事件。
- 点击公式后调用 Clipboard API 写入 LaTeX。
- Clipboard API 不可用时 fallback 到临时 `textarea + document.execCommand("copy")`。

为什么这么改：

- 事件代理只注册一次监听器，避免给每个公式节点都绑定事件。
- MutationObserver 触发时只做防抖扫描，适配 GPT 的流式输出和切换会话后的 DOM 更新。
- 可以复用已有公式提取函数，保证导出公式和复制公式的来源一致。

---

### 2.4 公式复制样式

文件：`src/content/styles.css`

新增样式：

- `.cge-formula-copy-target`
- `.cge-formula-copy-target:hover`
- `.cge-formula-copy-toast`
- `.cge-formula-copy-toast.is-visible`
- `.cge-formula-copy-toast[data-tone="error"]`

视觉行为：

- 公式区域 hover 时显示浅蓝背景和外圈阴影。
- toast 使用固定定位，显示在公式区域上方。
- 成功提示为深色胶囊气泡。
- 失败提示为红色胶囊气泡。

为什么这么改：

- 用户需要知道哪些公式可以点击复制。
- 点击后需要即时反馈，否则无法确认是否复制成功。
- 样式只作用于插件标记过的公式节点，不影响普通正文。

---

## 3. 受影响文件

本次 v0.3 主要涉及：

- `src/content/index.ts`
- `src/content/index.js`
- `src/content/styles.css`
