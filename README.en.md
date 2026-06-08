<div align="center">

# GPT Dialogue Extractor

A browser extension for exporting the current ChatGPT and DeepSeek web conversation.
It reads the rendered conversation directly from the page and exports it to local files.

<p>
  <a href="./README.md">
    <img alt="中文" src="https://img.shields.io/badge/中文-Read-111827?style=for-the-badge&labelColor=475569" />
  </a>
  <a href="./README.en.md">
    <img alt="English" src="https://img.shields.io/badge/English-Current-111827?style=for-the-badge&labelColor=2563eb" />
  </a>
</p>

</div>


## Main Features

- Export the current conversation as `JSON`
- Export the current conversation as `Markdown`
- Export the current conversation as `PDF`
- Export the current conversation as `ZIP`, including readable images and attachments when available
- Choose a custom save location
- Select which messages to export
- Export code blocks
- Export common formulas
- Right-side user-message timeline with hover preview and jump navigation

## Installation

### Edge

1. Open `edge://extensions/`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select the project folder:
   the repository root that contains `manifest.json`

### Chrome

1. Open `chrome://extensions/`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select the project folder:
   the repository root that contains `manifest.json`

## How To Use

### 1. Open a conversation page

Open any ChatGPT or DeepSeek conversation page:

- `https://chatgpt.com/*`
- `https://chat.openai.com/*`
- `https://chat.deepseek.com/*`
- `https://www.deepseek.com/chat*`

The extension injects itself automatically.

### 2. Open the export panel

Click the `导出` button in the top action area of the page.

This opens the export panel.

### 3. Choose the export scope

The panel shows the messages from the current conversation.

You can:

- keep the default full selection
- select only part of the conversation
- click `刷新列表`
- click `全选`
- click `清空`

If no message is selected, export will fail.

### 4. Choose an export format

The panel provides four formats:

- `导出 JSON`
- `导出 Markdown`
- `导出 PDF`
- `导出 ZIP`

#### JSON

Best for structured archiving and post-processing.

#### Markdown

Best for editing in Obsidian, Typora, VS Code, or a knowledge base.

#### PDF

Best for saving and sharing.

The current PDF export does not use the browser print dialog. The extension generates the PDF directly and downloads it, which makes it less likely to be affected by print-blocking extensions.

#### ZIP

Best for complete archiving. The ZIP contains `conversation.json`, `conversation.md`, a bundle manifest, and any images or attachments that can be read directly.

### 5. Save the file

After clicking export, the browser opens a save dialog.

You can:

- choose the destination folder
- rename the file
- confirm the download

### 6. Current Read Scope

The extension only reads messages that are already rendered in the current page DOM.

If older messages in a long conversation are not loaded yet, scroll to them in the web app first, then export or refresh the list.

### 7. Use the timeline

The right side of the page shows a user-message timeline.

Usage:

- each marker represents one user message
- hover on a marker to preview that message
- click a marker to jump to that message
- the currently active user message is highlighted while scrolling

## Development And Build

The runtime source files are:

- `src/content/index.ts`
- `src/background/index.ts`

The actual files loaded by the extension are still:

- `src/content/index.js`
- `src/background/index.js`

If you change the TypeScript source, rebuild the runtime files first:

```bash
npm run build
```

## Refresh During Development

If you change the extension code, do these three steps:

1. run `npm run build`
2. refresh the extension in the extensions page
3. refresh the ChatGPT or DeepSeek tab itself

Otherwise the browser may still be running an older content script.

## Distribution And Installation

If you do not want to publish to the extension store yet, the recommended flow is:

- GitHub Release
- download a zip package
- load the unpacked extension in developer mode

Related docs:

- User installation guide: [INSTALL.en.md](./docs/INSTALL.en.md)
- Release distribution guide: [RELEASE_DISTRIBUTION.en.md](./docs/RELEASE_DISTRIBUTION.en.md)

## Current Limitations

- Only the currently opened conversation can be exported
- No batch export for multiple conversations
- Table export is not yet high fidelity
- PDF currently prioritizes reliable export over exact visual reproduction

If your goal is to reliably export the current ChatGPT or DeepSeek web conversation to local files, this version is already usable.
