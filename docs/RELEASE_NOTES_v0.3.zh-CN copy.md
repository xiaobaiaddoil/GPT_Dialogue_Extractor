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


### 2.6 生成文件同步

文件：`src/content/index.js`

说明：

- 已运行 `npm run build`。
- `src/content/index.js` 已由 `src/content/index.ts` 重新生成。
- 打包发布时应包含同步后的 `index.js`。

---

## 3. 受影响文件

本次 v0.3 主要涉及：

- `src/content/index.ts`
- `src/content/index.js`
- `src/content/styles.css`

---

## 4. 发布前验证清单

建议打包 v0.3 前按下面顺序回归：

1. 重新加载插件后，ChatGPT 页面能看到“导出”按钮。
2. 点击“导出”后，导出面板正常打开。
3. 点击“刷新列表”后，消息选择列表能读取当前会话消息。
4. 切换到新会话后，消息列表和时间轴能随 DOM 更新。
5. 点击 JSON 导出，文件能正常下载。
6. 点击 Markdown 导出，文件能正常下载且公式格式保留。
7. 点击 PDF 导出，文件能正常下载。
8. 点击 ZIP 导出，附件逻辑不回归。
9. 页面不会自动向上滚动补全历史。
10. 导出前状态显示“正在整理导出数据…”。
11. 消息选择列表滚动条是浅色，不是纯黑。
12. 鼠标 hover 到公式区域时有浅蓝高亮。
13. 点击公式区域后能复制 LaTeX。
14. 新生成的公式或切换会话后的公式仍可点击复制。

---

## 5. 已验证命令

```powershell
npm run build
```

结果：构建通过。

---

## 6. 打包注意事项

当前 `manifest.json` 中版本号仍需要在打包前确认是否改为：

```json
"version": "0.3.0"
```

如果准备正式发布 v0.3，建议同时检查：

- `manifest.json` 版本号
- `README.md` / `README.en.md` 中的功能描述
- 安装文档是否需要补充“点击公式复制”说明
- 打包产物是否包含最新的 `src/content/index.js` 和 `src/content/styles.css`

---

## 7. 模块化重构

v0.3 对 `src/content/index.ts` 做了第一阶段模块化拆分，目标是降低主内容脚本的阅读成本，并把低耦合能力从主流程中移出。

新增模块：

- `src/content/binary-utils.ts`
- `src/content/page-bridge.ts`
- `src/content/formula-copy.ts`

对应生成文件：

- `src/content/binary-utils.js`
- `src/content/page-bridge.js`
- `src/content/formula-copy.js`

### 7.1 `binary-utils.ts`

职责：

- UTF-8 编码：`stringToUtf8Bytes()`
- ZIP 构建：`buildZip()`
- ZIP 内部二进制拼接、CRC32、DOS 时间戳等算法细节

为什么拆出：

- ZIP 构建是纯算法逻辑，不依赖 ChatGPT DOM。
- 保留在 `index.ts` 会干扰主流程阅读。
- 后续如果替换 ZIP 实现或增加测试，可以单独处理。

### 7.2 `page-bridge.ts`

职责：

- 注入 `page-hook.js`
- 监听页面上下文网络事件
- 维护捕获到的附件相关网络事件
- 提供页面上下文 fetch 桥接：`requestPageFetch()`

为什么拆出：

- 页面 bridge 是浏览器扩展通信层，不属于 UI 或导出编排逻辑。
- 独立后 `index.ts` 不再直接维护 hook 常量、pending fetch map、网络事件队列。
- 后续如果调整附件下载策略，可以优先看这个模块。

### 7.3 `formula-copy.ts`

职责：

- 标记可复制公式区域
- 处理公式点击事件
- 复制 LaTeX 到剪贴板
- 显示复制成功/失败 toast

为什么拆出：

- 公式复制是独立交互能力，不应该混在导出主流程里。
- 模块通过依赖注入复用 `index.ts` 中已有的公式识别函数，避免重复实现公式解析。
- 使用事件代理和防抖扫描，减少对 ChatGPT 页面 DOM 的持续干扰。

### 7.4 构建与加载顺序

文件：`manifest.json`

content scripts 加载顺序调整为：

```json
"js": [
  "src/content/binary-utils.js",
  "src/content/page-bridge.js",
  "src/content/formula-copy.js",
  "src/content/index.js"
]
```

原因：

- `index.js` 仍是主入口。
- 主入口启动时会调用前面模块挂载到 `window` 上的 API。
- 模块必须先于 `index.js` 加载。

文件：`tsconfig.build.json`

构建入口增加：

- `src/content/binary-utils.ts`
- `src/content/page-bridge.ts`
- `src/content/formula-copy.ts`

这样 `npm run build` 会同步生成对应 JS 文件，打包时不会遗漏模块。

### 7.5 当前拆分边界

当前阶段没有一次性把 `index.ts` 拆到很小，原因是导出、时间轴、消息选择、DOM 解析之间仍有较多共享状态。为了避免大规模重构引入回归，本次先拆出低耦合模块。

后续如果继续重构，建议拆分顺序：

1. `selectors/constants`：选择器和 DOM id 常量。
2. `conversation-parser`：会话 DOM 解析、Markdown 序列化、公式序列化。
3. `selection-panel`：导出面板和消息选择列表。
4. `timeline`：时间轴渲染、定位、滚动追踪。
5. `export-runner`：JSON / Markdown / PDF / ZIP 导出编排。

补充：本次模块化继续拆出以下模块：

- `src/content/pdf-export.ts`：PDF 页面渲染、Canvas 转图片、PDF 字节拼装。
- `src/content/formatters.ts`：JSON / Markdown 导出文本格式化。
- `src/content/download-bridge.ts`：浏览器下载请求、文本/Data URL/二进制下载入口。

当前 content script 加载顺序为：

```json
"js": [
  "src/content/binary-utils.js",
  "src/content/page-bridge.js",
  "src/content/formula-copy.js",
  "src/content/pdf-export.js",
  "src/content/formatters.js",
  "src/content/download-bridge.js",
  "src/content/index.js"
]
```

`index.ts` 继续作为主入口，负责页面生命周期、DOM 解析、面板、时间轴和导出编排；纯工具、桥接和格式化逻辑已经拆出。
