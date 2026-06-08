"use strict";
// @ts-nocheck
(function () {
    if (window.__chatgptExporterFormattersLoaded) {
        return;
    }
    window.__chatgptExporterFormattersLoaded = true;
    function sanitizeAssetLabel(value, fallback) {
        const cleaned = (value || "")
            .replace(/[\u0000-\u001f]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        return cleaned || fallback;
    }
    function formatAssetMarkdown(asset, index) {
        const fallback = asset.kind === "image" ? `Image ${index + 1}` : `Attachment ${index + 1}`;
        const label = sanitizeAssetLabel(asset.filename || asset.alt || "", fallback);
        const suffix = [];
        if (asset.alt && asset.alt !== label) {
            suffix.push(`alt: ${asset.alt}`);
        }
        if (asset.mimeType) {
            suffix.push(asset.mimeType);
        }
        const note = suffix.length ? ` (${suffix.join(", ")})` : "";
        const prefix = asset.kind === "image" ? "- Image" : "- Attachment";
        return `${prefix}: [${label}](${asset.url})${note}`;
    }
    function toJson(conversation) {
        return JSON.stringify(conversation, null, 2);
    }
    function getMessageDisplayName(message) {
        return `${message.role === "user" ? "user" : message.assistantLabel || "gpt"}${message.index}`;
    }
    function toMarkdown(conversation) {
        const lines = [
            `# ${conversation.metadata.title}`,
            "",
            `- Exported At: ${conversation.metadata.exportedAt}`,
            `- Source: ${conversation.metadata.url}`,
            `- Message Count: ${conversation.metadata.messageCount}`,
            "",
        ];
        conversation.messages.forEach((message) => {
            const heading = getMessageDisplayName(message);
            lines.push(`## ${heading}`);
            lines.push("");
            const body = message.role === "assistant" ? message.markdown : message.text;
            lines.push(body || "(No text content)");
            if (Array.isArray(message.assets) && message.assets.length) {
                lines.push("");
                lines.push("### Assets");
                lines.push("");
                message.assets.forEach((asset, index) => {
                    lines.push(formatAssetMarkdown(asset, index));
                });
            }
            lines.push("");
        });
        return lines.join("\n").trimEnd() + "\n";
    }
    window.ChatGPTExporterFormatters = {
        toJson,
        toMarkdown,
        formatAssetMarkdown,
    };
})();
