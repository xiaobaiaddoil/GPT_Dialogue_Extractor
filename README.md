<div align="center">

# GPT Dialogue Extractor

一个用于导出 ChatGPT / Gemini / DeepSeek 当前会话的浏览器扩展。
直接读取网页中已经渲染完成的对话内容，并导出为本地文件。

<p>
  <a href="./README.md">
    <img alt="中文" src="https://img.shields.io/badge/中文-当前阅读-111827?style=for-the-badge&labelColor=2563eb" />
  </a>
  <a href="./README.en.md">
    <img alt="English" src="https://img.shields.io/badge/English-Read-111827?style=for-the-badge&labelColor=475569" />
  </a>
</p>

</div>


## 主要功能

- 导出当前会话为 `JSON`
- 导出当前会话为 `Markdown`
- 导出当前会话为 `PDF`
- 导出当前会话和附件为 `ZIP`
- 导出时自定义保存位置
- 按消息勾选导出范围
- 支持 ChatGPT 网页版会话提取
- 支持 Gemini 网页版会话提取
- 支持 DeepSeek 网页版会话提取
- 支持代码块导出
- 支持常见公式导出
- 右侧用户消息时间轴，支持悬浮预览和点击跳转

## 安装方法

### Edge

1. 打开 `edge://extensions/`
2. 开启右上角“开发者模式”
3. 点击“加载已解压的扩展程序”
4. 选择项目目录：
   当前仓库根目录（包含 `manifest.json` 的目录）

### Chrome

1. 打开 `chrome://extensions/`
2. 开启“开发者模式”
3. 点击“加载已解压的扩展程序”
4. 选择项目目录：
   当前仓库根目录（包含 `manifest.json` 的目录）

## 使用方法

### 1. 打开会话页面

进入任意一个支持的会话页面：

- `https://chatgpt.com/*`
- `https://chat.openai.com/*`
- `https://gemini.google.com/*`
- `https://bard.google.com/*`
- `https://chat.deepseek.com/*`
- `https://www.deepseek.com/*`

扩展会自动注入到页面里。

### 2. 打开导出面板

在页面顶部操作区点击 `导出` 按钮。

点击后会弹出导出面板。

### 3. 选择导出范围

导出面板里会列出当前会话中的消息。

你可以：

- 直接使用默认全选
- 只勾选部分消息
- 点击 `刷新列表`
- 点击 `全选`
- 点击 `清空`

如果一条都没有勾选，导出会失败。

### 4. 选择导出格式

面板中提供四种格式：

- `导出 JSON`
- `导出 Markdown`
- `导出 PDF`
- `导出 ZIP`

#### JSON

适合做结构化存档和后续处理。

#### Markdown

适合放进 Obsidian、Typora、VS Code 或知识库里继续编辑。

#### PDF

适合保存和分享。

当前 PDF 不是走浏览器打印窗口，而是直接由扩展生成后下载，因此更不容易被打印拦截类插件影响。

#### ZIP

适合同时保存结构化会话、Markdown 和可读取到的图片/附件。

### 5. 保存文件

点击导出后，浏览器会弹出保存窗口。

你可以：

- 选择保存目录
- 修改文件名
- 确认保存

### 6. 当前读取范围

扩展直接读取当前页面 DOM 中已经渲染出来的消息。

如果网页本身没有把更早的消息渲染在当前 DOM 中，这些消息不会被导出。

### 7. 使用时间轴

页面右侧会显示一个用户消息时间轴。

用法如下：

- 每个刻度代表一条用户消息
- 鼠标悬停在刻度上，会显示那条用户消息预览
- 点击刻度，会跳到对应用户消息位置
- 当前阅读到的用户消息会高亮

## 开发和构建

运行时代码源码位于：

- `src/content/index.ts`
- `src/background/index.ts`

扩展实际加载的文件仍然是：

- `src/content/index.js`
- `src/background/index.js`

如果你修改了 TypeScript 源码，需要先重新生成运行文件：

```bash
npm run build
```

## 开发时刷新方法

如果你修改了扩展代码，需要做三步：

1. 先运行 `npm run build`
2. 在扩展管理页刷新扩展
3. 回到对应的 ChatGPT、Gemini 或 DeepSeek 页面刷新标签页

否则浏览器可能还在运行旧版 content script。

## 分发与安装

如果你不打算上扩展商店，而是直接发给别人使用，建议走：

- GitHub Release
- 下载 zip
- 开发者模式加载已解压扩展

相关文档：

- 用户安装说明： [INSTALL.zh-CN.md](./docs/INSTALL.zh-CN.md)
- 发布说明： [RELEASE_DISTRIBUTION.zh-CN.md](./docs/RELEASE_DISTRIBUTION.zh-CN.md)

## 当前限制

- 只支持导出当前打开的单个会话
- 不支持批量导出多个会话
- 表格导出还不是高保真版本
- PDF 目前优先保证稳定导出，不追求完全还原页面样式

如果你的目标是稳定地把当前 ChatGPT、Gemini 或 DeepSeek 会话导出为本地文件，这个版本已经可以直接使用。
