// @ts-nocheck
(function () {
  if (window.__chatgptExporterSharedUtilsLoaded) {
    return;
  }

  window.__chatgptExporterSharedUtilsLoaded = true;

  function normalizeWhitespace(value) {
    return value.replace(/\r\n/g, "\n").replace(/\u00a0/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  }

  function sanitizeFileName(value) {
    const cleaned = value
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return cleaned || "chatgpt-conversation";
  }

  function sanitizeAssetLabel(value, fallback) {
    const cleaned = (value || "")
      .replace(/[\u0000-\u001f]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return cleaned || fallback;
  }

  function getMessageDisplayName(message) {
    return `${message.role === "user" ? "user" : "gpt"}${message.index}`;
  }

  window.ChatGPTExporterSharedUtils = {
    normalizeWhitespace,
    sanitizeFileName,
    sanitizeAssetLabel,
    getMessageDisplayName,
  };
})();
