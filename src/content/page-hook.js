(function () {
  if (window.__chatgptExporterPageHookLoaded) {
    return;
  }

  window.__chatgptExporterPageHookLoaded = true;

  const PAGE_HOOK_SOURCE = "cge-page-hook";
  const CONTENT_SCRIPT_SOURCE = "cge-content-script";
  const PAGE_HOOK_TYPE = "cge-network-event";
  const PAGE_FETCH_REQUEST_TYPE = "cge-page-fetch-request";
  const PAGE_FETCH_RESPONSE_TYPE = "cge-page-fetch-response";

  function bytesToBase64(bytes) {
    let binary = "";
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      const chunk = bytes.subarray(offset, offset + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  }

  function normalizeUrl(value) {
    try {
      return new URL(String(value || ""), window.location.origin).href;
    } catch (error) {
      return String(value || "");
    }
  }

  function isConversationPayloadUrl(url) {
    const normalized = normalizeUrl(url);
    return /\/backend-api\/conversation\/[^/?#]+/i.test(normalized);
  }

  function postNetworkEvent(detail) {
    try {
      window.postMessage(
        {
          source: PAGE_HOOK_SOURCE,
          type: PAGE_HOOK_TYPE,
          ts: Date.now(),
          ...detail,
        },
        window.location.origin,
      );
    } catch (error) {}
  }

  async function emitConversationFetchResponse(url, response, reason) {
    if (!isConversationPayloadUrl(url)) {
      return;
    }

    try {
      const cloned = response.clone();
      const text = await cloned.text();
      postNetworkEvent({
        reason,
        url: normalizeUrl(url),
        status: response.status,
        ok: response.ok,
        mimeType: (response.headers.get("content-type") || "").split(";")[0].trim(),
        text,
      });
    } catch (error) {
      postNetworkEvent({
        reason: reason + "-failed",
        url: normalizeUrl(url),
        error: error instanceof Error ? error.message : "无法读取会话响应。",
      });
    }
  }

  function installFetchCapture() {
    const nativeFetch = window.fetch;
    if (typeof nativeFetch !== "function" || nativeFetch.__chatgptExporterPatched) {
      return;
    }

    const patchedFetch = async function (...args) {
      const requestUrl = args[0] instanceof Request ? args[0].url : args[0];
      const response = await nativeFetch.apply(this, args);
      void emitConversationFetchResponse(requestUrl, response, "fetch-conversation");
      return response;
    };
    patchedFetch.__chatgptExporterPatched = true;
    window.fetch = patchedFetch;
  }

  function installXhrCapture() {
    const NativeXhr = window.XMLHttpRequest;
    if (typeof NativeXhr !== "function" || NativeXhr.prototype.__chatgptExporterPatched) {
      return;
    }

    const nativeOpen = NativeXhr.prototype.open;
    NativeXhr.prototype.open = function (method, url, ...rest) {
      this.__chatgptExporterUrl = normalizeUrl(url);
      return nativeOpen.call(this, method, url, ...rest);
    };

    const nativeSend = NativeXhr.prototype.send;
    NativeXhr.prototype.send = function (...args) {
      this.addEventListener("loadend", () => {
        const url = this.__chatgptExporterUrl || "";
        if (!isConversationPayloadUrl(url)) {
          return;
        }

        let text = "";
        try {
          if (typeof this.responseText === "string") {
            text = this.responseText;
          }
        } catch (error) {}

        postNetworkEvent({
          reason: "xhr-conversation",
          url,
          status: this.status,
          ok: this.status >= 200 && this.status < 300,
          mimeType: String(this.getResponseHeader("content-type") || "").split(";")[0].trim(),
          text,
        });
      });
      return nativeSend.apply(this, args);
    };

    NativeXhr.prototype.__chatgptExporterPatched = true;
  }

  installFetchCapture();
  installXhrCapture();

  window.addEventListener("message", async (event) => {
    if (event.source !== window || event.origin !== window.location.origin) {
      return;
    }

    const data = event.data;
    if (!data || data.source !== CONTENT_SCRIPT_SOURCE || data.type !== PAGE_FETCH_REQUEST_TYPE) {
      return;
    }

    const requestId = typeof data.requestId === "string" ? data.requestId : "";
    const url = typeof data.url === "string" ? data.url : "";
    if (!requestId || !url) {
      return;
    }

    try {
      const response = await fetch(url, {
        credentials: "include",
        headers: {
          accept: "*/*",
        },
      });
      const bytes = new Uint8Array(await response.arrayBuffer());
      const mimeType = (response.headers.get("content-type") || "").split(";")[0].trim();
      const isTextPayload = /(?:json|text|javascript|xml|html)$/i.test(mimeType) || mimeType.startsWith("text/");

      window.postMessage(
        {
          source: PAGE_HOOK_SOURCE,
          type: PAGE_FETCH_RESPONSE_TYPE,
          requestId,
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          url: response.url,
          mimeType,
          contentDisposition: response.headers.get("content-disposition") || "",
          base64: bytesToBase64(bytes),
          text: isTextPayload ? new TextDecoder().decode(bytes) : "",
        },
        window.location.origin,
      );
    } catch (error) {
      window.postMessage(
        {
          source: PAGE_HOOK_SOURCE,
          type: PAGE_FETCH_RESPONSE_TYPE,
          requestId,
          ok: false,
          error: error instanceof Error ? error.message : "页面上下文请求失败。",
        },
        window.location.origin,
      );
    }
  });
})();
