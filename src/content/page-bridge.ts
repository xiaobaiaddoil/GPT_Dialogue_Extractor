// @ts-nocheck
(function () {
  if (window.__chatgptExporterPageBridgeLoaded) {
    return;
  }

  window.__chatgptExporterPageBridgeLoaded = true;

  const PAGE_HOOK_SOURCE = "cge-page-hook";
  const CONTENT_SCRIPT_SOURCE = "cge-content-script";
  const PAGE_HOOK_TYPE = "cge-network-event";
  const PAGE_FETCH_REQUEST_TYPE = "cge-page-fetch-request";
  const PAGE_FETCH_RESPONSE_TYPE = "cge-page-fetch-response";
  const MAX_PAGE_NETWORK_EVENTS = 200;

  const pageNetworkEvents = [];
  const pendingPageFetches = new Map();
  let pageFetchSequence = 0;

  function rememberPageNetworkEvent(detail) {
    if (!detail || typeof detail !== "object") {
      return;
    }

    pageNetworkEvents.push({
      ts: typeof detail.ts === "number" ? detail.ts : Date.now(),
      reason: typeof detail.reason === "string" ? detail.reason : "",
      url: typeof detail.url === "string" ? detail.url : "",
      status: typeof detail.status === "number" ? detail.status : 0,
      ok: detail.ok === true,
      mimeType: typeof detail.mimeType === "string" ? detail.mimeType : "",
      text: typeof detail.text === "string" ? detail.text : "",
      base64: typeof detail.base64 === "string" ? detail.base64 : "",
      urls: Array.isArray(detail.urls) ? detail.urls.filter((value) => typeof value === "string" && value) : [],
      fileIds: Array.isArray(detail.fileIds) ? detail.fileIds.filter((value) => typeof value === "string" && value) : [],
      fileNames: Array.isArray(detail.fileNames) ? detail.fileNames.filter((value) => typeof value === "string" && value) : [],
    });

    if (pageNetworkEvents.length > MAX_PAGE_NETWORK_EVENTS) {
      pageNetworkEvents.splice(0, pageNetworkEvents.length - MAX_PAGE_NETWORK_EVENTS);
    }
  }

  function install() {
    window.addEventListener("message", (event) => {
      if (event.source !== window || event.origin !== window.location.origin) {
        return;
      }

      const data = event.data;
      if (!data || data.source !== PAGE_HOOK_SOURCE || data.type !== PAGE_HOOK_TYPE) {
        if (data && data.source === PAGE_HOOK_SOURCE && data.type === PAGE_FETCH_RESPONSE_TYPE) {
          const requestId = typeof data.requestId === "string" ? data.requestId : "";
          if (!requestId || !pendingPageFetches.has(requestId)) {
            return;
          }

          const pending = pendingPageFetches.get(requestId);
          pendingPageFetches.delete(requestId);
          pending.resolve(data);
        }
        return;
      }

      rememberPageNetworkEvent(data);
    });
  }

  function inject() {
    const runtime = typeof chrome !== "undefined" ? chrome.runtime : null;
    if (!runtime || typeof runtime.getURL !== "function") {
      return;
    }

    if (document.getElementById("cge-page-hook-script")) {
      return;
    }

    const script = document.createElement("script");
    script.id = "cge-page-hook-script";
    script.src = runtime.getURL("src/content/page-hook.js");
    script.async = false;
    (document.head || document.documentElement).appendChild(script);
  }

  function requestPageFetch(url) {
    return new Promise((resolve, reject) => {
      const requestId = `cge-page-fetch-${Date.now()}-${pageFetchSequence + 1}`;
      pageFetchSequence += 1;

      const timeoutId = window.setTimeout(() => {
        pendingPageFetches.delete(requestId);
        reject(new Error("页面上下文下载超时。"));
      }, 20000);

      pendingPageFetches.set(requestId, {
        resolve: (payload) => {
          window.clearTimeout(timeoutId);
          resolve(payload);
        },
      });

      window.postMessage(
        {
          source: CONTENT_SCRIPT_SOURCE,
          type: PAGE_FETCH_REQUEST_TYPE,
          requestId,
          url,
        },
        window.location.origin,
      );
    });
  }

  function getEvents() {
    return pageNetworkEvents;
  }

  window.ChatGPTExporterPageBridge = {
    install,
    inject,
    requestPageFetch,
    getEvents,
  };
})();
