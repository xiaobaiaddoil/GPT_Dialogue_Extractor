// @ts-nocheck
(function () {
  if (window.__chatgptExporterLoaded) {
    return;
  }

  window.__chatgptExporterLoaded = true;

  const TURN_SELECTOR = 'section[data-testid^="conversation-turn-"]';
  const HEADER_ACTIONS_SELECTOR = "#conversation-header-actions";
  const USER_ROLE_SELECTOR = '[data-message-author-role="user"]';
  const USER_BODY_SELECTOR = '[data-message-author-role="user"] .whitespace-pre-wrap';
  const ASSISTANT_ROLE_SELECTOR = '[data-message-author-role="assistant"]';
  const ASSISTANT_PRIMARY_SELECTOR =
    '[data-message-author-role="assistant"][data-turn-start-message="true"]';
  const ASSISTANT_BODY_SELECTOR = ".markdown";
  const CODE_CONTENT_SELECTOR = ".cm-content";
  const DEEPSEEK_TURN_ID_ATTR = "data-cge-deepseek-turn-id";
  const DEEPSEEK_VIRTUAL_ITEM_SELECTOR = "[data-virtual-list-item-key]";
  const DEEPSEEK_PRIMARY_MESSAGE_HOST_SELECTOR = [
    DEEPSEEK_VIRTUAL_ITEM_SELECTOR,
    "div.dad65929",
    "div._4f9bf79",
  ].join(", ");
  const DEEPSEEK_MESSAGE_HOST_SELECTOR = [
    DEEPSEEK_PRIMARY_MESSAGE_HOST_SELECTOR,
    ".ds-message",
    "[data-testid*='message' i]",
    "[class*='message' i]",
    "[class*='chat-message' i]",
  ].join(", ");
  const DEEPSEEK_USER_BODY_SELECTOR = [
    ".fbb737a4",
    "[class*='user-message' i]",
    "[class*='user_text' i]",
    "[class*='user-text' i]",
  ].join(", ");
  const DEEPSEEK_ASSISTANT_MAIN_BODY_SELECTOR =
    ".ds-markdown.ds-assistant-message-main-content";
  const DEEPSEEK_ASSISTANT_BODY_SELECTOR = [
    DEEPSEEK_ASSISTANT_MAIN_BODY_SELECTOR,
    ".ds-markdown",
    "[class*='markdown' i]",
  ].join(", ");
  const MATH_ROOT_SELECTOR = [
    ".katex-display",
    ".math-display",
    ".katex",
    "math",
    "mjx-container",
    "[data-latex]",
    "[data-tex]",
    'script[type^="math/tex"]',
  ].join(", ");
  const INLINE_MATH_ROOT_SELECTOR = [
    ".katex",
    "math",
    "mjx-container",
    "[data-latex]",
    "[data-tex]",
    'script[type^="math/tex"]',
  ].join(", ");
  const BLOCK_MATH_ROOT_SELECTOR = [
    ".katex-display",
    ".math-display",
    'mjx-container[display="true"]',
    '[data-tex-display="true"]',
    '[data-latex-display="true"]',
  ].join(", ");
  const WRAPPER_ID = "cge-exporter-toolbar";
  const EXPORT_BUTTON_ID = "cge-exporter-button";
  const PORTAL_ID = "cge-exporter-portal";
  const PANEL_ID = "cge-exporter-panel";
  const BACKDROP_ID = "cge-exporter-backdrop";
  const TIMELINE_PANEL_ID = "cge-timeline-panel";
  const TIMELINE_LIST_ID = "cge-timeline-list";
  const TIMELINE_DIRECTORY_ID = "cge-timeline-directory";
  const TIMELINE_TOGGLE_ID = "cge-timeline-toggle";
  const TIMELINE_TOOLTIP_ID = "cge-timeline-tooltip";
  const STATUS_ID = "cge-exporter-status";
  const SCOPE_ID = "cge-exporter-scope";
  const REFRESH_LIST_ID = "cge-refresh-list";
  const SELECT_ALL_ID = "cge-select-all";
  const CLEAR_ALL_ID = "cge-clear-all";
  const SELECTION_SUMMARY_ID = "cge-selection-summary";
  const MESSAGE_LIST_ID = "cge-message-list";
  const TIMELINE_SCROLL_PADDING = 12;
  const TIMELINE_MIN_TOP_CLEARANCE = 96;
  const TIMELINE_ACTIVE_LOCK_MS = 1200;
  const TIMELINE_CONDENSE_THRESHOLD = 16;
  const TIMELINE_MIN_MARKER_GAP = 8;
  const TIMELINE_MIN_MARKERS = 16;
  const TIMELINE_MAX_MARKERS = 16;
  const TIMELINE_FOCUS_WINDOW = 9;
  const DEEPSEEK_HISTORY_MAX_SCROLL_STEPS = 120;
  const DEEPSEEK_HISTORY_STABLE_ROUNDS = 4;
  const DEEPSEEK_HISTORY_SCROLL_RATIO = 0.82;

  let injectTimer = 0;
  let exportInFlight = false;
  let selectionInFlight = false;
  let timelineInFlight = false;
  let latestConversation = null;
  let selectedMessageIds = new Set();
  let selectionLoaded = false;
  let activeTimelineMessageId = "";
  let currentTimelineScroller = null;
  let timelineScrollFrame = 0;
  let timelineRefreshTimer = 0;
  let lastSelectionSignature = "";
  let lastTimelineSignature = "";
  let timelineLockedMessageId = "";
  let timelineLockedUntil = 0;
  let timelineDirectoryExpanded = false;
  let deepSeekTurnSequence = 0;
  let deepSeekHistoryLoadInFlight = false;
  const deepSeekGeneratedTurnIds = new WeakMap();
  const deepSeekTurnHostCache = new Map();
  const documentAssetHintCache = new Map();
  const primedNativeAssetKeys = new Set();

  function delay(ms) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  function normalizeWhitespace(value) {
    return value.replace(/\r\n/g, "\n").replace(/\u00a0/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  }

  function sanitizeFileName(value, fallback = "chatgpt-conversation") {
    const cleaned = value
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return cleaned || fallback;
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function escapeCssAttributeValue(value) {
    return String(value)
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\A ");
  }

  function buildAttributeSelector(attributeName, value) {
    return `[${attributeName}="${escapeCssAttributeValue(value)}"]`;
  }

  function buildIdSelector(id) {
    if (!id) {
      return "";
    }

    if (window.CSS && typeof window.CSS.escape === "function") {
      return `#${window.CSS.escape(id)}`;
    }

    return buildAttributeSelector("id", id);
  }

  function buildAssetTrackingKey(message, asset) {
    const turnPart = normalizeWhitespace((message && (message.turnId || message.id)) || "");
    const namePart = normalizeWhitespace((asset && (asset.filename || asset.url)) || "");
    return `${turnPart}:${namePart}`;
  }

  function getConversationSignature(conversation) {
    if (!conversation || !Array.isArray(conversation.messages)) {
      return "";
    }

    return conversation.messages.map((message) => message.id).join("|");
  }

  function isDeepSeekPage() {
    return (
      window.location.hostname === "chat.deepseek.com" ||
      (window.location.hostname === "www.deepseek.com" && window.location.pathname.startsWith("/chat"))
    );
  }

  function isChatGPTPage() {
    return window.location.hostname === "chatgpt.com" || window.location.hostname === "chat.openai.com";
  }

  function isSupportedConversationPage() {
    return isChatGPTPage() || isDeepSeekPage();
  }

  function getAssistantDisplayLabel(message) {
    if (message && typeof message.assistantLabel === "string" && message.assistantLabel.trim()) {
      return message.assistantLabel.trim();
    }

    return message && message.platform === "deepseek" ? "deepseek" : "gpt";
  }

  function getMessageDisplayName(message) {
    return `${message.role === "user" ? "user" : getAssistantDisplayLabel(message)}${message.index}`;
  }

  function cleanConversationTitle() {
    const fallback = isDeepSeekPage() ? "deepseek-conversation" : "chatgpt-conversation";
    const rawTitle = document.title || fallback;
    return sanitizeFileName(
      rawTitle
        .replace(/\s*-\s*ChatGPT\s*$/i, "")
        .replace(/\s*\|\s*ChatGPT\s*$/i, "")
        .replace(/\s*-\s*DeepSeek\s*$/i, "")
        .replace(/\s*\|\s*DeepSeek\s*$/i, "")
        .trim(),
      fallback,
    );
  }

  function installPageHookBridge() {
    const pageBridge = window.ChatGPTExporterPageBridge;
    if (pageBridge && typeof pageBridge.install === "function") {
      pageBridge.install();
    }
  }

  function injectPageHook() {
    const pageBridge = window.ChatGPTExporterPageBridge;
    if (pageBridge && typeof pageBridge.inject === "function") {
      pageBridge.inject();
    }
  }

  function createToolbarButton(label, id) {
    const button = document.createElement("button");
    button.id = id;
    button.type = "button";
    button.className = "cge-toolbar-button";
    button.textContent = label;
    return button;
  }

  function createButton(label, format) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cge-panel-button";
    button.dataset.format = format;
    button.textContent = label;
    button.addEventListener("click", () => {
      void runExport(format);
    });
    return button;
  }

  function createUtilityButton(label, id) {
    const button = document.createElement("button");
    button.type = "button";
    button.id = id;
    button.className = "cge-panel-utility-button";
    button.textContent = label;
    return button;
  }

  function updateSelectionRowState(row, selected) {
    row.classList.toggle("is-selected", selected);
    row.setAttribute("aria-checked", selected ? "true" : "false");
  }

  function toggleMessageSelection(messageId, row) {
    if (row.disabled) {
      return;
    }

    const nextSelected = !selectedMessageIds.has(messageId);
    if (nextSelected) {
      selectedMessageIds.add(messageId);
    } else {
      selectedMessageIds.delete(messageId);
    }

    updateSelectionRowState(row, nextSelected);
    updateSelectionSummary();
  }

  function setStatus(message, tone) {
    const status = document.getElementById(STATUS_ID);
    if (!status) {
      return;
    }

    status.textContent = message;
    status.dataset.tone = tone || "muted";
    if (tone === "success") {
      status.style.color = "#0f766e";
      return;
    }

    if (tone === "error") {
      status.style.color = "#b91c1c";
      return;
    }

    status.style.color = "#6b7280";
  }

  function setExportButtonsDisabled(disabled) {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) {
      return;
    }

    const buttons = panel.querySelectorAll("button[data-format]");
    buttons.forEach((button) => {
      button.disabled = disabled;
      button.style.opacity = disabled ? "0.55" : "1";
      button.style.cursor = disabled ? "wait" : "pointer";
    });
  }

  function setSelectionButtonsDisabled(disabled) {
    [REFRESH_LIST_ID, SELECT_ALL_ID, CLEAR_ALL_ID].forEach((id) => {
      const button = document.getElementById(id);
      if (!(button instanceof HTMLButtonElement)) {
        return;
      }

      button.disabled = disabled;
      button.style.opacity = disabled ? "0.55" : "1";
      button.style.cursor = disabled ? "wait" : "pointer";
    });

    const toggles = document.querySelectorAll(`#${MESSAGE_LIST_ID} button[data-message-toggle="true"]`);
    toggles.forEach((toggle) => {
      if (toggle instanceof HTMLButtonElement) {
        toggle.disabled = disabled;
      }
    });
  }

  function updateSelectionSummary() {
    const summary = document.getElementById(SELECTION_SUMMARY_ID);
    if (!summary) {
      return;
    }

    if (!latestConversation || !latestConversation.messages.length) {
      summary.textContent = "还没有读取到可选择的消息。";
      return;
    }

    const selectedCount = latestConversation.messages.filter((message) => selectedMessageIds.has(message.id)).length;
    summary.textContent = `已选择 ${selectedCount} / ${latestConversation.messages.length} 条消息。`;
  }

  function renderSelectionList(conversation) {
    const list = document.getElementById(MESSAGE_LIST_ID);
    if (!list) {
      return;
    }

    list.innerHTML = "";

    conversation.messages.forEach((message, index) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "cge-message-row";
      row.dataset.messageId = message.id;
      row.dataset.messageToggle = "true";
      row.setAttribute("role", "checkbox");
      if (index === 0) {
        row.style.borderTop = "0";
      }
      row.setAttribute(
        "aria-label",
        `选择${getMessageDisplayName(message)}消息`,
      );

      const check = document.createElement("span");
      check.className = "cge-message-check";

      const indicator = document.createElement("span");
      indicator.className = "cge-message-check-indicator";
      check.append(indicator);

      const content = document.createElement("div");

      const title = document.createElement("div");
      title.className = "cge-message-title";
      title.textContent = getMessageDisplayName(message);

      const preview = document.createElement("div");
      preview.className = "cge-message-preview";
      preview.textContent = message.text.slice(0, 120) || "(空消息)";

      content.append(title, preview);
      row.append(check, content);
      updateSelectionRowState(row, selectedMessageIds.has(message.id));
      row.addEventListener("click", () => {
        toggleMessageSelection(message.id, row);
      });
      list.append(row);
    });

    updateSelectionSummary();
  }

  function getTimelineMessages() {
    if (!latestConversation) {
      return [];
    }

    const userMessages = latestConversation.messages.filter((message) => message.role === "user");
    return userMessages;
  }

  function getTimelineMarkerCapacity(listHeight) {
    if (listHeight <= 0) {
      return TIMELINE_CONDENSE_THRESHOLD;
    }

    const usableHeight = Math.max(listHeight - 20, 24);
    return Math.max(
      TIMELINE_MIN_MARKERS,
      Math.min(TIMELINE_MAX_MARKERS, Math.floor(usableHeight / TIMELINE_MIN_MARKER_GAP)),
    );
  }

  function isTimelineCondensed(messages, listHeight) {
    return messages.length > Math.min(TIMELINE_CONDENSE_THRESHOLD, getTimelineMarkerCapacity(listHeight));
  }

  function buildTimelineRenderMessages(messages, listHeight) {
    const maxMarkers = getTimelineMarkerCapacity(listHeight);
    if (messages.length <= TIMELINE_CONDENSE_THRESHOLD) {
      return messages;
    }

    const messageIndexById = new Map(messages.map((message, index) => [message.id, index]));
    const selectedIndices = new Set([0, messages.length - 1]);
    const focusIds = [timelineLockedMessageId, activeTimelineMessageId].filter(Boolean);

    focusIds.forEach((messageId) => {
      const index = messageIndexById.get(messageId);
      if (typeof index !== "number") {
        return;
      }

      const halfWindow = Math.floor(TIMELINE_FOCUS_WINDOW / 2);
      const start = Math.max(0, index - halfWindow);
      const end = Math.min(messages.length - 1, index + halfWindow);
      for (let current = start; current <= end; current += 1) {
        selectedIndices.add(current);
      }
    });

    const remainingSlots = Math.max(maxMarkers - selectedIndices.size, 0);
    if (remainingSlots > 0) {
      const sampleCount = Math.min(messages.length, remainingSlots);
      const denominator = Math.max(sampleCount - 1, 1);
      for (let step = 0; step < sampleCount; step += 1) {
        const ratio = sampleCount === 1 ? 0.5 : step / denominator;
        selectedIndices.add(Math.round(ratio * (messages.length - 1)));
      }
    }

    return Array.from(selectedIndices)
      .sort((left, right) => left - right)
      .slice(0, maxMarkers)
      .map((index) => messages[index]);
  }

  function scrollElementToTop(target, scrollContainer, offset = 0) {
    const containerTop =
      scrollContainer === document.scrollingElement ? 0 : scrollContainer.getBoundingClientRect().top;
    const targetTop = target.getBoundingClientRect().top;
    const nextTop = scrollContainer.scrollTop + targetTop - containerTop - offset;

    scrollContainer.scrollTo({
      top: Math.max(0, nextTop),
      behavior: "smooth",
    });
  }

  function querySelectorSafely(selector) {
    if (!selector) {
      return null;
    }

    try {
      return document.querySelector(selector);
    } catch {
      return null;
    }
  }

  function resolveTimelineTurn(message) {
    if (!message) {
      return null;
    }

    if (message.platform === "deepseek") {
      const hinted = querySelectorSafely(message.hostSelectorHint || "");
      if (hinted instanceof HTMLElement) {
        return hinted;
      }

      if (typeof message.turnId === "string" && message.turnId) {
        const cachedTurn = deepSeekTurnHostCache.get(message.turnId);
        if (cachedTurn instanceof HTMLElement && cachedTurn.isConnected) {
          return cachedTurn;
        }

        const byTurnId = querySelectorSafely(buildAttributeSelector(DEEPSEEK_TURN_ID_ATTR, message.turnId));
        if (byTurnId instanceof HTMLElement) {
          return byTurnId;
        }
      }

      return null;
    }

    if (typeof message.turnId !== "string" || !message.turnId) {
      return null;
    }

    const turn = document.querySelector(`section${buildAttributeSelector("data-testid", message.turnId)}`);
    if (!(turn instanceof HTMLElement)) {
      return null;
    }

    return turn;
  }

  function resolveTimelineTargetElement(message) {
    const turn = resolveTimelineTurn(message);
    if (!(turn instanceof HTMLElement)) {
      return null;
    }

    if (message.platform === "deepseek") {
      const body = resolveDeepSeekMessageBody(turn, message.role);
      return body instanceof HTMLElement ? body : turn;
    }

    const userBody = resolveUserBody(turn);
    return userBody instanceof HTMLElement ? userBody : turn;
  }

  function resolveTimelineTopOffset(scrollContainer, target) {
    const containerTop =
      scrollContainer === document.scrollingElement ? 0 : scrollContainer.getBoundingClientRect().top;
    const targetRect = target.getBoundingClientRect();
    const probeX = Math.max(
      8,
      Math.min(window.innerWidth - 8, Math.round(targetRect.left + Math.min(targetRect.width / 2, 24))),
    );
    const probeY = Math.max(0, Math.min(window.innerHeight - 1, Math.round(containerTop + 8)));
    const elements = document.elementsFromPoint(probeX, probeY);

    let obstructionBottom = containerTop;
    elements.forEach((element) => {
      if (!(element instanceof HTMLElement) || element === target || target.contains(element)) {
        return;
      }

      const style = window.getComputedStyle(element);
      if (style.position !== "fixed" && style.position !== "sticky") {
        return;
      }

      if (
        scrollContainer !== document.scrollingElement &&
        style.position === "sticky" &&
        !scrollContainer.contains(element)
      ) {
        return;
      }

      const rect = element.getBoundingClientRect();
      if (rect.height > window.innerHeight * 0.5 || rect.bottom <= containerTop || rect.top > probeY) {
        return;
      }

      obstructionBottom = Math.max(obstructionBottom, rect.bottom);
    });

    return Math.max(
      TIMELINE_MIN_TOP_CLEARANCE,
      obstructionBottom - containerTop + TIMELINE_SCROLL_PADDING,
    );
  }

  function correctTimelineTargetVisibility(scrollContainer, target) {
    const containerTop =
      scrollContainer === document.scrollingElement ? 0 : scrollContainer.getBoundingClientRect().top;
    const safeTop = containerTop + resolveTimelineTopOffset(scrollContainer, target);
    const currentTop = target.getBoundingClientRect().top;
    const delta = currentTop - safeTop;

    if (delta >= 0) {
      return;
    }

    scrollContainer.scrollTo({
      top: Math.max(0, scrollContainer.scrollTop + delta - TIMELINE_SCROLL_PADDING),
      behavior: "auto",
    });
  }

  function scrollToMessage(message) {
    const target = resolveTimelineTargetElement(message);
    const turn = resolveTimelineTurn(message);
    if (!(target instanceof HTMLElement) || !(turn instanceof HTMLElement)) {
      return;
    }

    const scrollContainer = resolveScrollContainer();
    if (scrollContainer) {
      scrollElementToTop(target, scrollContainer, resolveTimelineTopOffset(scrollContainer, target));
      [180, 420, 760].forEach((delayMs) => {
        window.setTimeout(() => {
          correctTimelineTargetVisibility(scrollContainer, target);
        }, delayMs);
      });
    } else {
      target.scrollIntoView({
        block: message.platform === "deepseek" ? "center" : "start",
        behavior: "smooth",
      });
    }

    if (message.platform === "deepseek") {
      window.setTimeout(() => {
        target.scrollIntoView({
          block: "center",
          inline: "nearest",
          behavior: "smooth",
        });
      }, 280);
    }

    activeTimelineMessageId = message.id;
    timelineLockedMessageId = message.id;
    timelineLockedUntil = Date.now() + TIMELINE_ACTIVE_LOCK_MS;
    updateTimelineActiveStyles();

    const previousTransition = turn.style.transition;
    const previousBoxShadow = turn.style.boxShadow;
    turn.style.transition = "box-shadow 160ms ease";
    turn.style.boxShadow = "0 0 0 3px rgba(37, 99, 235, 0.35)";

    window.setTimeout(() => {
      turn.style.boxShadow = previousBoxShadow;
      turn.style.transition = previousTransition;
    }, 1400);
  }

  function updateTimelineActiveStyles() {
    const list = document.getElementById(TIMELINE_LIST_ID);
    if (!(list instanceof HTMLElement)) {
      return;
    }

    const items = list.querySelectorAll("button[data-message-id]");
    items.forEach((item) => {
      const isActive = item.getAttribute("data-message-id") === activeTimelineMessageId;
      item.style.borderColor = isActive ? "rgba(56, 189, 248, 0.95)" : "rgba(100, 116, 139, 0.36)";
      item.style.background = isActive ? "rgba(56, 189, 248, 0.96)" : "rgba(71, 85, 105, 0.2)";
      item.style.boxShadow = isActive
        ? "0 0 0 4px rgba(56, 189, 248, 0.18), 0 8px 20px rgba(2, 6, 23, 0.18)"
        : "none";
      item.style.transform = isActive ? "translate(-50%, -50%) scaleY(1.12)" : "translate(-50%, -50%)";
      item.style.opacity = isActive ? "1" : "0.78";
    });

    updateTimelineDirectoryActiveStyles();
  }

  function updateTimelineDirectoryActiveStyles() {
    const directory = document.getElementById(TIMELINE_DIRECTORY_ID);
    if (!(directory instanceof HTMLElement)) {
      return;
    }

    const rows = directory.querySelectorAll("button[data-message-id]");
    let activeRow = null;

    rows.forEach((row) => {
      const isActive = row.getAttribute("data-message-id") === activeTimelineMessageId;
      row.classList.toggle("is-active", isActive);
      if (isActive) {
        activeRow = row;
      }
    });

    if (timelineDirectoryExpanded && activeRow instanceof HTMLElement) {
      activeRow.scrollIntoView({
        block: "nearest",
        behavior: "auto",
      });
    }
  }

  function updateTimelinePanelState() {
    const panel = document.getElementById(TIMELINE_PANEL_ID);
    const directory = document.getElementById(TIMELINE_DIRECTORY_ID);
    const toggle = document.getElementById(TIMELINE_TOGGLE_ID);
    if (!(panel instanceof HTMLElement) || !(directory instanceof HTMLElement) || !(toggle instanceof HTMLButtonElement)) {
      return;
    }

    panel.dataset.expanded = timelineDirectoryExpanded ? "true" : "false";
    panel.style.width = timelineDirectoryExpanded ? "320px" : "24px";
    panel.style.borderRadius = timelineDirectoryExpanded ? "20px" : "999px";
    panel.style.padding = timelineDirectoryExpanded ? "10px" : "10px 0";
    panel.style.overflow = timelineDirectoryExpanded ? "hidden" : "visible";
    panel.style.background = timelineDirectoryExpanded ? "rgba(15, 23, 42, 0.84)" : "rgba(15, 23, 42, 0.18)";
    panel.style.borderColor = timelineDirectoryExpanded
      ? "rgba(148, 163, 184, 0.28)"
      : "rgba(71, 85, 105, 0.18)";
    panel.style.boxShadow = timelineDirectoryExpanded
      ? "0 18px 42px rgba(2, 6, 23, 0.32)"
      : "0 12px 30px rgba(2, 6, 23, 0.12)";

    directory.hidden = !timelineDirectoryExpanded;
    directory.style.display = timelineDirectoryExpanded ? "block" : "none";

    toggle.textContent = timelineDirectoryExpanded ? "<<" : ">>";
    toggle.title = timelineDirectoryExpanded ? "收起消息目录" : "展开消息目录";
    toggle.setAttribute("aria-label", toggle.title);
    toggle.style.right = timelineDirectoryExpanded ? "8px" : "30px";
  }

  function toggleTimelineDirectory() {
    timelineDirectoryExpanded = !timelineDirectoryExpanded;
    updateTimelinePanelState();
    if (timelineDirectoryExpanded) {
      renderTimelineDirectory();
      updateTimelineDirectoryActiveStyles();
    }
  }

  function collapseTimelineDirectory() {
    if (!timelineDirectoryExpanded) {
      return;
    }

    timelineDirectoryExpanded = false;
    updateTimelinePanelState();
  }

  function handleTimelineOutsidePointerDown(event) {
    if (!timelineDirectoryExpanded) {
      return;
    }

    const panel = document.getElementById(TIMELINE_PANEL_ID);
    if (!(panel instanceof HTMLElement)) {
      return;
    }

    const target = event.target;
    if (target instanceof Node && panel.contains(target)) {
      return;
    }

    collapseTimelineDirectory();
  }

  function renderTimelineDirectory() {
    const directory = document.getElementById(TIMELINE_DIRECTORY_ID);
    if (!(directory instanceof HTMLElement)) {
      return;
    }

    directory.innerHTML = "";
    const messages = getTimelineMessages();

    if (!messages.length) {
      const empty = document.createElement("div");
      empty.className = "cge-timeline-directory-empty";
      empty.textContent = "还没有可定位的用户消息。";
      directory.append(empty);
      return;
    }

    messages.forEach((message) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "cge-timeline-directory-row";
      row.dataset.messageId = message.id;

      const title = document.createElement("div");
      title.className = "cge-timeline-directory-title";
      title.textContent = getMessageDisplayName(message);

      const preview = document.createElement("div");
      preview.className = "cge-timeline-directory-preview";
      preview.textContent = message.text.slice(0, 120) || "(空消息)";

      row.append(title, preview);
      row.addEventListener("click", () => {
        scrollToMessage(message);
      });
      directory.append(row);
    });

    updateTimelineDirectoryActiveStyles();
  }

  function showTimelineTooltip(message, target) {
    const tooltip = document.getElementById(TIMELINE_TOOLTIP_ID);
    if (!(tooltip instanceof HTMLElement) || !(target instanceof HTMLElement)) {
      return;
    }

    tooltip.textContent = message.text.slice(0, 180) || `${getMessageDisplayName(message)}消息`;
    const rect = target.getBoundingClientRect();
    tooltip.style.display = "block";
    tooltip.style.top = `${Math.max(16, rect.top - 10)}px`;
    tooltip.style.right = "34px";
    tooltip.style.opacity = "1";
    tooltip.style.transform = "translateY(0)";
  }

  function hideTimelineTooltip() {
    const tooltip = document.getElementById(TIMELINE_TOOLTIP_ID);
    if (!(tooltip instanceof HTMLElement)) {
      return;
    }

    tooltip.style.opacity = "0";
    tooltip.style.transform = "translateY(4px)";
    window.setTimeout(() => {
      if (tooltip.style.opacity === "0") {
        tooltip.style.display = "none";
      }
    }, 120);
  }

  function refreshActiveTimelineMessage() {
    if (!latestConversation || !latestConversation.messages.length) {
      return;
    }

    const userMessages = latestConversation.messages.filter((message) => message.role === "user");
    if (!userMessages.length) {
      return;
    }

    const scrollerRect =
      currentTimelineScroller instanceof HTMLElement
        ? currentTimelineScroller.getBoundingClientRect()
        : null;
    const viewportTop = scrollerRect ? scrollerRect.top : 0;
    const referenceLine = viewportTop + TIMELINE_MIN_TOP_CLEARANCE;

    if (timelineLockedMessageId && Date.now() < timelineLockedUntil) {
      const lockedTarget = resolveTimelineTargetElement(
        userMessages.find((message) => message.id === timelineLockedMessageId),
      );
      if (lockedTarget instanceof HTMLElement) {
        const nextActiveId = timelineLockedMessageId;
        if (nextActiveId !== activeTimelineMessageId) {
          activeTimelineMessageId = nextActiveId;
          updateTimelineActiveStyles();
        }
        return;
      }
    } else {
      timelineLockedMessageId = "";
      timelineLockedUntil = 0;
    }

    let bestCandidate = null;

    userMessages.forEach((message) => {
      const target = resolveTimelineTargetElement(message);
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const rect = target.getBoundingClientRect();
      const distance = Math.abs(rect.top - referenceLine);
      if (
        !bestCandidate ||
        distance < bestCandidate.distance ||
        (distance === bestCandidate.distance && rect.top > bestCandidate.top)
      ) {
        bestCandidate = {
          id: message.id,
          top: rect.top,
          distance,
        };
      }
    });

    const nextActiveId = (bestCandidate || {}).id || "";
    if (nextActiveId && nextActiveId !== activeTimelineMessageId) {
      activeTimelineMessageId = nextActiveId;
      const list = document.getElementById(TIMELINE_LIST_ID);
      if (list instanceof HTMLElement && isTimelineCondensed(userMessages, list.clientHeight || 0)) {
        renderTimelineList();
      }
      updateTimelineActiveStyles();
    }
  }

  function scheduleTimelineScrollUpdate() {
    if (timelineScrollFrame) {
      return;
    }

    timelineScrollFrame = window.requestAnimationFrame(() => {
      timelineScrollFrame = 0;
      refreshActiveTimelineMessage();
    });
  }

  function ensureTimelineTracking() {
    const nextScroller = resolveScrollContainer();
    if (currentTimelineScroller === nextScroller) {
      return;
    }

    if (currentTimelineScroller) {
      currentTimelineScroller.removeEventListener("scroll", scheduleTimelineScrollUpdate);
    }

    currentTimelineScroller = nextScroller;
    if (currentTimelineScroller) {
      currentTimelineScroller.addEventListener("scroll", scheduleTimelineScrollUpdate, {
        passive: true,
      });
    }
  }

  function renderTimelineList() {
    const list = document.getElementById(TIMELINE_LIST_ID);
    if (!(list instanceof HTMLElement)) {
      return;
    }

    list.innerHTML = "";
    const messages = getTimelineMessages();
    const renderMessages = buildTimelineRenderMessages(messages, list.clientHeight || 0);

    if (!messages.length) {
      const empty = document.createElement("div");
      empty.style.position = "absolute";
      empty.style.left = "50%";
      empty.style.top = "50%";
      empty.style.width = "4px";
      empty.style.height = "72px";
      empty.style.transform = "translate(-50%, -50%)";
      empty.style.borderRadius = "999px";
      empty.style.background = "linear-gradient(180deg, rgba(71, 85, 105, 0.1), rgba(71, 85, 105, 0.36), rgba(71, 85, 105, 0.1))";
      list.append(empty);
      renderTimelineDirectory();
      return;
    }

    const track = document.createElement("div");
    track.style.position = "absolute";
    track.style.left = "50%";
    track.style.top = "10px";
    track.style.bottom = "10px";
    track.style.width = "4px";
    track.style.transform = "translateX(-50%)";
    track.style.borderRadius = "999px";
    track.style.background = "linear-gradient(180deg, rgba(71, 85, 105, 0.12), rgba(71, 85, 105, 0.42), rgba(71, 85, 105, 0.12))";
    list.append(track);

    const denominator = Math.max(messages.length - 1, 1);
    const usableHeight = Math.max(list.clientHeight - 20, 24);
    const isCondensed = renderMessages.length < messages.length;
    renderMessages.forEach((message) => {
      const messageIndex = messages.findIndex((item) => item.id === message.id);
      const ratio = messages.length === 1 ? 0.5 : Math.max(0, messageIndex) / denominator;
      const item = document.createElement("button");
      item.type = "button";
      item.dataset.messageId = message.id;
      item.title = message.text.slice(0, 160) || `${getMessageDisplayName(message)}消息`;
      item.style.position = "absolute";
      item.style.left = "50%";
      item.style.top = `${10 + usableHeight * ratio}px`;
      item.style.width = isCondensed ? "10px" : "12px";
      item.style.height = isCondensed ? "14px" : "20px";
      item.style.transform = "translate(-50%, -50%)";
      item.style.border = "1px solid rgba(100, 116, 139, 0.36)";
      item.style.borderRadius = "999px";
      item.style.background = "rgba(71, 85, 105, 0.2)";
      item.style.cursor = "pointer";
      item.style.padding = "0";
      item.style.transition = "transform 160ms ease, box-shadow 160ms ease, background 160ms ease, border-color 160ms ease, opacity 160ms ease";
      item.addEventListener("click", () => {
        scrollToMessage(message);
      });
      item.addEventListener("mouseenter", () => {
        item.style.transform = "translate(-50%, -50%) scaleX(1.12)";
        showTimelineTooltip(message, item);
      });
      item.addEventListener("mouseleave", () => {
        if (item.getAttribute("data-message-id") !== activeTimelineMessageId) {
          item.style.transform = "translate(-50%, -50%)";
        }
        hideTimelineTooltip();
      });
      item.addEventListener("focus", () => {
        item.style.transform = "translate(-50%, -50%) scaleX(1.12)";
        showTimelineTooltip(message, item);
      });
      item.addEventListener("blur", () => {
        if (item.getAttribute("data-message-id") !== activeTimelineMessageId) {
          item.style.transform = "translate(-50%, -50%)";
        }
        hideTimelineTooltip();
      });
      list.append(item);
    });

    renderTimelineDirectory();
    updateTimelineActiveStyles();
  }

  function isEveryMessageSelected(conversation) {
    return Boolean(
      conversation &&
        Array.isArray(conversation.messages) &&
        conversation.messages.length > 0 &&
        conversation.messages.every((message) => selectedMessageIds.has(message.id)),
    );
  }

  function getDeepSeekMessageSortKey(message) {
    const value = String((message && (message.turnId || message.id)) || "");
    const match = value.match(/deepseek-turn-(\d+)/i);
    return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
  }

  function getMessageRoleSortKey(message) {
    if (message && message.role === "user") {
      return 0;
    }

    if (message && message.role === "assistant") {
      return 1;
    }

    return 2;
  }

  function mergeDeepSeekConversationSnapshots(snapshots) {
    const validSnapshots = snapshots.filter((snapshot) => snapshot && Array.isArray(snapshot.messages));
    const fallback = {
      metadata: {
        title: cleanConversationTitle(),
        url: window.location.href,
        exportedAt: new Date().toISOString(),
        messageCount: 0,
        platform: "deepseek",
      },
      messages: [],
    };

    if (!validSnapshots.length) {
      return fallback;
    }

    const messagesById = new Map();
    const insertionOrder = new Map();
    let sequence = 0;

    validSnapshots.forEach((snapshot) => {
      snapshot.messages.forEach((message) => {
        if (!message || !message.id) {
          return;
        }

        if (!insertionOrder.has(message.id)) {
          insertionOrder.set(message.id, sequence);
          sequence += 1;
        }

        messagesById.set(message.id, {
          ...(messagesById.get(message.id) || {}),
          ...message,
        });
      });
    });

    const messages = Array.from(messagesById.values()).sort((left, right) => {
      const leftKey = getDeepSeekMessageSortKey(left);
      const rightKey = getDeepSeekMessageSortKey(right);
      if (Number.isFinite(leftKey) && Number.isFinite(rightKey) && leftKey !== rightKey) {
        return leftKey - rightKey;
      }

      const roleDelta = getMessageRoleSortKey(left) - getMessageRoleSortKey(right);
      if (roleDelta) {
        return roleDelta;
      }

      return (insertionOrder.get(left.id) || 0) - (insertionOrder.get(right.id) || 0);
    });

    const latestMetadata = validSnapshots[validSnapshots.length - 1].metadata || fallback.metadata;
    return {
      metadata: {
        ...latestMetadata,
        title: latestMetadata.title || cleanConversationTitle(),
        url: window.location.href,
        exportedAt: new Date().toISOString(),
        messageCount: messages.length,
        platform: "deepseek",
      },
      messages,
    };
  }

  function canMergeWithDeepSeekHistory(conversation) {
    return Boolean(
      isDeepSeekPage() &&
        conversation &&
        conversation.metadata &&
        conversation.metadata.platform === "deepseek" &&
        conversation.metadata.url === window.location.href,
    );
  }

  async function collectDeepSeekConversationWithHistory() {
    const firstSnapshot = collectDeepSeekConversation();
    const scrollContainer = resolveScrollContainer();
    if (!(scrollContainer instanceof HTMLElement) || !firstSnapshot.messages.length) {
      return firstSnapshot;
    }

    const snapshots = [firstSnapshot];
    const initialScrollTop = scrollContainer.scrollTop;
    const previousScrollBehavior = scrollContainer.style.scrollBehavior;
    let mergedConversation = mergeDeepSeekConversationSnapshots(snapshots);
    let previousSignature = getConversationSignature(mergedConversation);
    let stableRounds = 0;

    deepSeekHistoryLoadInFlight = true;
    scrollContainer.style.scrollBehavior = "auto";

    try {
      for (let step = 0; step < DEEPSEEK_HISTORY_MAX_SCROLL_STEPS; step += 1) {
        const beforeTop = scrollContainer.scrollTop;
        const stepSize = Math.max(
          360,
          Math.floor((scrollContainer.clientHeight || window.innerHeight || 800) * DEEPSEEK_HISTORY_SCROLL_RATIO),
        );
        const nextTop = Math.max(0, beforeTop - stepSize);

        scrollContainer.scrollTo({
          top: nextTop,
          behavior: "auto",
        });
        scrollContainer.dispatchEvent(new Event("scroll", { bubbles: true }));

        await delay(step < 4 ? 360 : 220);

        const snapshot = collectDeepSeekConversation();
        if (snapshot.messages.length) {
          snapshots.push(snapshot);
        }

        mergedConversation = mergeDeepSeekConversationSnapshots(snapshots);
        const nextSignature = getConversationSignature(mergedConversation);
        const scrollChanged = Math.abs(scrollContainer.scrollTop - beforeTop) > 2;
        const foundNewMessages = nextSignature !== previousSignature;

        if (foundNewMessages) {
          previousSignature = nextSignature;
          stableRounds = 0;
          setStatus(`正在向上加载 DeepSeek 历史消息，已读取 ${mergedConversation.messages.length} 条…`, "muted");
        } else if (!scrollChanged || scrollContainer.scrollTop <= 2) {
          stableRounds += 1;
        } else {
          stableRounds = 0;
        }

        if (stableRounds >= DEEPSEEK_HISTORY_STABLE_ROUNDS) {
          break;
        }
      }
    } finally {
      scrollContainer.scrollTo({
        top: initialScrollTop,
        behavior: "auto",
      });
      scrollContainer.dispatchEvent(new Event("scroll", { bubbles: true }));
      await delay(180);

      if (previousScrollBehavior) {
        scrollContainer.style.scrollBehavior = previousScrollBehavior;
      } else {
        scrollContainer.style.removeProperty("scroll-behavior");
      }

      deepSeekHistoryLoadInFlight = false;
    }

    const restoredSnapshot = collectDeepSeekConversation();
    if (restoredSnapshot.messages.length) {
      snapshots.push(restoredSnapshot);
    }

    return mergeDeepSeekConversationSnapshots(snapshots);
  }

  async function collectConversationForAction(options = {}) {
    if (isDeepSeekPage() && options.loadHistory) {
      return collectDeepSeekConversationWithHistory();
    }

    return collectConversation();
  }

  async function prepareSelection(forceReload) {
    if (selectionInFlight) {
      return;
    }

    selectionInFlight = true;
    setSelectionButtonsDisabled(true);

    try {
      setStatus("正在读取当前会话消息列表…", "muted");
      const wasFullySelected = selectionLoaded && isEveryMessageSelected(latestConversation);

      if (forceReload || !latestConversation) {
        latestConversation = await collectConversationForAction({
          loadHistory: forceReload && isDeepSeekPage(),
        });
      }

      if (!latestConversation || !latestConversation.messages.length) {
        throw new Error("没有读取到可供选择的消息。");
      }

      if (!selectionLoaded || wasFullySelected) {
        selectedMessageIds = new Set(latestConversation.messages.map((message) => message.id));
      } else {
        selectedMessageIds = new Set(
          latestConversation.messages
            .map((message) => message.id)
            .filter((messageId) => selectedMessageIds.has(messageId)),
        );
      }

      selectionLoaded = true;
      lastSelectionSignature = getConversationSignature(latestConversation);
      renderSelectionList(latestConversation);
      setStatus("消息列表已刷新。", "muted");
    } catch (error) {
      const message = error instanceof Error ? error.message : "读取消息列表失败。";
      setStatus(message, "error");
    } finally {
      setSelectionButtonsDisabled(false);
      selectionInFlight = false;
    }
  }

  function syncLiveConversation() {
    if (deepSeekHistoryLoadInFlight) {
      return;
    }

    const turns = resolveTurns();
    if (!turns.length) {
      return;
    }

    const wasFullySelected = selectionLoaded && isEveryMessageSelected(latestConversation);
    const visibleConversation = collectConversation();
    const nextConversation = canMergeWithDeepSeekHistory(latestConversation)
      ? mergeDeepSeekConversationSnapshots([latestConversation, visibleConversation])
      : visibleConversation;
    const nextSignature = getConversationSignature(nextConversation);
    const selectionChanged = nextSignature !== lastSelectionSignature;
    const timelineChanged = nextSignature !== lastTimelineSignature;

    latestConversation = nextConversation;

    if (selectionLoaded) {
      if (selectionChanged) {
        if (wasFullySelected) {
          selectedMessageIds = new Set(latestConversation.messages.map((message) => message.id));
        } else {
          selectedMessageIds = new Set(
            latestConversation.messages
              .map((message) => message.id)
              .filter((messageId) => selectedMessageIds.has(messageId)),
          );
        }
        renderSelectionList(latestConversation);
        lastSelectionSignature = nextSignature;
      }
    }

    if (timelineChanged) {
      renderTimelineList();
      lastTimelineSignature = nextSignature;
    }
    ensureTimelineTracking();
    refreshActiveTimelineMessage();
  }

  function requestTimelineRefresh() {
    if (timelineRefreshTimer) {
      window.clearTimeout(timelineRefreshTimer);
    }

    timelineRefreshTimer = window.setTimeout(() => {
      timelineRefreshTimer = 0;
      syncLiveConversation();
    }, 180);
  }

  async function prepareTimeline(forceReload) {
    if (timelineInFlight) {
      return;
    }

    timelineInFlight = true;
    try {
      if (forceReload || !latestConversation) {
        latestConversation = collectConversation();
      }

      if (!latestConversation || !latestConversation.messages.length) {
        throw new Error("没有读取到可供定位的消息。");
      }

      renderTimelineList();
      lastTimelineSignature = getConversationSignature(latestConversation);
      ensureTimelineTracking();
      refreshActiveTimelineMessage();
    } catch (error) {
      void error;
    } finally {
      timelineInFlight = false;
    }
  }

  function ensureToolbar() {
    const headerActions = document.querySelector(HEADER_ACTIONS_SELECTOR);
    if (!headerActions && !isDeepSeekPage()) {
      return;
    }

    if (document.getElementById(WRAPPER_ID)) {
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.id = WRAPPER_ID;
    wrapper.className = "cge-toolbar";
    wrapper.style.display = "flex";
    wrapper.style.alignItems = "center";
    wrapper.style.gap = "8px";

    const exportButton = createToolbarButton("导出", EXPORT_BUTTON_ID);
    exportButton.addEventListener("click", (event) => {
      event.stopPropagation();
      togglePanel();
    });

    wrapper.append(exportButton);
    if (headerActions) {
      headerActions.prepend(wrapper);
    } else {
      wrapper.style.position = "fixed";
      wrapper.style.top = "16px";
      wrapper.style.right = "16px";
      wrapper.style.zIndex = "2147483647";
      wrapper.style.padding = "6px";
      wrapper.style.border = "1px solid rgba(148, 163, 184, 0.24)";
      wrapper.style.borderRadius = "999px";
      wrapper.style.background = "rgba(255, 255, 255, 0.92)";
      wrapper.style.backdropFilter = "blur(12px)";
      wrapper.style.boxShadow = "0 14px 32px rgba(15, 23, 42, 0.14)";
      document.documentElement.append(wrapper);
    }

    ensurePanel();
    ensureTimelinePanel();
  }

  function togglePanel() {
    const backdrop = document.getElementById(BACKDROP_ID);
    if (!backdrop) {
      return;
    }

    backdrop.hidden = !backdrop.hidden;
    backdrop.style.display = backdrop.hidden ? "none" : "flex";

    if (!backdrop.hidden && !latestConversation) {
      void prepareSelection(true);
    }
  }

  function closePanel() {
    const backdrop = document.getElementById(BACKDROP_ID);
    if (!backdrop) {
      return;
    }

    backdrop.hidden = true;
    backdrop.style.display = "none";
  }

  function ensurePanel() {
    if (document.getElementById(PORTAL_ID)) {
      return;
    }

    const portal = document.createElement("div");
    portal.id = PORTAL_ID;
    portal.style.position = "fixed";
    portal.style.inset = "0";
    portal.style.zIndex = "2147483647";
    portal.style.pointerEvents = "none";
    document.documentElement.append(portal);

    const backdrop = document.createElement("div");
    backdrop.id = BACKDROP_ID;
    backdrop.className = "cge-backdrop";
    backdrop.hidden = true;
    backdrop.style.position = "fixed";
    backdrop.style.inset = "0";
    backdrop.style.zIndex = "2147483647";
    backdrop.style.display = "none";
    backdrop.style.alignItems = "center";
    backdrop.style.justifyContent = "center";
    backdrop.style.padding = "16px";
    backdrop.style.background = "rgba(15, 23, 42, 0.2)";
    backdrop.style.backdropFilter = "blur(4px)";
    backdrop.style.pointerEvents = "auto";
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) {
        closePanel();
      }
    });

    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.className = "cge-panel";
    panel.style.width = "min(420px, calc(100vw - 32px))";
    panel.style.maxHeight = "min(80vh, 720px)";
    panel.style.overflow = "auto";
    panel.style.border = "1px solid rgba(0, 0, 0, 0.1)";
    panel.style.borderRadius = "20px";
    panel.style.background = "#ffffff";
    panel.style.color = "#111111";
    panel.style.padding = "18px";
    panel.style.boxShadow = "0 24px 80px rgba(0, 0, 0, 0.24)";
    panel.style.pointerEvents = "auto";

    const header = document.createElement("div");
    header.className = "cge-panel-header";
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.justifyContent = "space-between";
    header.style.gap = "12px";

    const title = document.createElement("div");
    title.className = "cge-panel-title";
    title.textContent = "导出当前对话";
    title.style.fontSize = "15px";
    title.style.fontWeight = "700";

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "cge-panel-close";
    closeButton.textContent = "关闭";
    closeButton.addEventListener("click", () => {
      closePanel();
    });

    header.append(title, closeButton);

    const description = document.createElement("div");
    description.className = "cge-panel-description";
    description.textContent = "直接读取当前已加载的对话，再下载 JSON、Markdown、PDF 或 ZIP。";
    description.style.marginTop = "6px";
    description.style.fontSize = "12px";
    description.style.lineHeight = "1.5";
    description.style.color = "#4b5563";

    const scope = document.createElement("div");
    scope.id = SCOPE_ID;
    scope.className = "cge-panel-scope";
    scope.textContent = "当前范围：可勾选当前已打开会话中的消息；默认全选。";
    scope.style.marginTop = "12px";
    scope.style.borderRadius = "14px";
    scope.style.background = "#f8fafc";
    scope.style.color = "#334155";
    scope.style.padding = "10px 12px";
    scope.style.fontSize = "12px";
    scope.style.lineHeight = "1.5";

    const actions = document.createElement("div");
    actions.className = "cge-panel-actions";
    actions.style.display = "grid";
    actions.style.gridTemplateColumns = "repeat(2, minmax(0, 1fr))";
    actions.style.gap = "8px";
    actions.style.marginTop = "14px";
    actions.append(createButton("导出 JSON", "json"));
    actions.append(createButton("导出 Markdown", "markdown"));
    actions.append(createButton("导出 PDF", "pdf"));
    actions.append(createButton("导出 ZIP", "zip"));

    const selectionHeader = document.createElement("div");
    selectionHeader.style.display = "flex";
    selectionHeader.style.alignItems = "center";
    selectionHeader.style.justifyContent = "space-between";
    selectionHeader.style.gap = "8px";
    selectionHeader.style.marginTop = "16px";

    const selectionTitle = document.createElement("div");
    selectionTitle.textContent = "选择导出消息";
    selectionTitle.style.fontSize = "13px";
    selectionTitle.style.fontWeight = "700";
    selectionTitle.style.color = "#0f172a";

    const selectionTools = document.createElement("div");
    selectionTools.style.display = "flex";
    selectionTools.style.gap = "6px";

    const refreshButton = createUtilityButton("刷新列表", REFRESH_LIST_ID);
    refreshButton.addEventListener("click", () => {
      void prepareSelection(true);
    });

    const selectAllButton = createUtilityButton("全选", SELECT_ALL_ID);
    selectAllButton.addEventListener("click", () => {
      if (!latestConversation) {
        return;
      }

      selectedMessageIds = new Set(latestConversation.messages.map((message) => message.id));
      renderSelectionList(latestConversation);
    });

    const clearAllButton = createUtilityButton("清空", CLEAR_ALL_ID);
    clearAllButton.addEventListener("click", () => {
      selectedMessageIds = new Set();
      if (latestConversation) {
        renderSelectionList(latestConversation);
        return;
      }
      updateSelectionSummary();
    });

    selectionTools.append(refreshButton, selectAllButton, clearAllButton);
    selectionHeader.append(selectionTitle, selectionTools);

    const selectionSummary = document.createElement("div");
    selectionSummary.id = SELECTION_SUMMARY_ID;
    selectionSummary.textContent = "还没有读取到可选择的消息。";
    selectionSummary.style.marginTop = "10px";
    selectionSummary.style.fontSize = "12px";
    selectionSummary.style.lineHeight = "1.4";
    selectionSummary.style.color = "#475569";

    const messageList = document.createElement("div");
    messageList.id = MESSAGE_LIST_ID;
    messageList.className = "cge-message-list";

    const status = document.createElement("div");
    status.id = STATUS_ID;
    status.className = "cge-panel-status";
    status.dataset.tone = "muted";
    status.textContent = "等待导出。";
    status.style.marginTop = "12px";
    status.style.fontSize = "12px";
    status.style.lineHeight = "1.5";
    status.style.color = "#6b7280";

    panel.append(
      header,
      description,
      scope,
      actions,
      selectionHeader,
      selectionSummary,
      messageList,
      status,
    );
    backdrop.append(panel);
    portal.append(backdrop);
  }

  function ensureTimelinePanel() {
    if (document.getElementById(TIMELINE_PANEL_ID)) {
      return;
    }

    const portal = document.getElementById(PORTAL_ID);
    if (!(portal instanceof HTMLElement)) {
      return;
    }

    const panel = document.createElement("aside");
    panel.id = TIMELINE_PANEL_ID;
    panel.hidden = false;
    panel.style.position = "fixed";
    panel.style.top = "118px";
    panel.style.right = "12px";
    panel.style.bottom = "92px";
    panel.style.width = "24px";
    panel.style.display = "flex";
    panel.style.alignItems = "stretch";
    panel.style.gap = "10px";
    panel.style.borderRadius = "999px";
    panel.style.background = "rgba(2, 6, 23, 0.08)";
    panel.style.backdropFilter = "blur(10px)";
    panel.style.border = "1px solid rgba(71, 85, 105, 0.14)";
    panel.style.boxShadow = "0 12px 30px rgba(2, 6, 23, 0.12)";
    panel.style.padding = "10px 0";
    panel.style.pointerEvents = "auto";
    panel.style.transition = "width 180ms ease, border-radius 180ms ease, padding 180ms ease";

    const list = document.createElement("div");
    list.id = TIMELINE_LIST_ID;
    list.style.position = "relative";
    list.style.flex = "0 0 24px";
    list.style.width = "24px";
    list.style.height = "100%";
    list.style.padding = "0";
    list.style.overflow = "hidden";

    const directory = document.createElement("div");
    directory.id = TIMELINE_DIRECTORY_ID;
    directory.className = "cge-timeline-directory";
    directory.hidden = true;

    const toggle = document.createElement("button");
    toggle.id = TIMELINE_TOGGLE_ID;
    toggle.type = "button";
    toggle.className = "cge-timeline-toggle";
    toggle.addEventListener("click", () => {
      toggleTimelineDirectory();
    });

    const tooltip = document.createElement("div");
    tooltip.id = TIMELINE_TOOLTIP_ID;
    tooltip.style.position = "fixed";
    tooltip.style.zIndex = "2147483647";
    tooltip.style.display = "none";
    tooltip.style.maxWidth = "260px";
    tooltip.style.borderRadius = "14px";
    tooltip.style.background = "rgba(15, 23, 42, 0.94)";
    tooltip.style.color = "#f8fafc";
    tooltip.style.padding = "10px 12px";
    tooltip.style.fontSize = "12px";
    tooltip.style.lineHeight = "1.45";
    tooltip.style.boxShadow = "0 16px 40px rgba(15, 23, 42, 0.28)";
    tooltip.style.pointerEvents = "none";
    tooltip.style.opacity = "0";
    tooltip.style.transform = "translateY(4px)";
    tooltip.style.transition = "opacity 120ms ease, transform 120ms ease";

    panel.title = "用户消息时间轴";
    panel.append(directory, list, toggle);
    portal.append(panel, tooltip);
    document.addEventListener("pointerdown", handleTimelineOutsidePointerDown, true);
    updateTimelinePanelState();
  }

  function scheduleToolbarInjection() {
    if (injectTimer) {
      window.clearTimeout(injectTimer);
    }

    injectTimer = window.setTimeout(() => {
      injectTimer = 0;
      ensureToolbar();
      requestTimelineRefresh();
    }, 120);
  }

  function installObservers() {
    const observer = new MutationObserver(() => {
      scheduleToolbarInjection();
      requestTimelineRefresh();
      scheduleFormulaCopyEnhancement();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closePanel();
      }
    });

    window.addEventListener(
      "resize",
      () => {
        requestTimelineRefresh();
      },
      { passive: true },
    );
  }

  function resolveTurns() {
    if (isDeepSeekPage()) {
      return resolveDeepSeekMessageHosts().map((item) => item.host);
    }

    return Array.from(document.querySelectorAll(TURN_SELECTOR));
  }

  function isScrollable(element) {
    const style = window.getComputedStyle(element);
    return /(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 32;
  }

  function resolveScrollContainer() {
    const turns = resolveTurns();
    const firstTurn = turns[0];
    if (!firstTurn) {
      return null;
    }

    let current = firstTurn.parentElement;
    while (current && current !== document.body) {
      if (isScrollable(current)) {
        return current;
      }
      current = current.parentElement;
    }

    const scrollingElement = document.scrollingElement;
    return scrollingElement instanceof HTMLElement ? scrollingElement : null;
  }

  function resolveUserBody(turn) {
    return turn.querySelector(USER_BODY_SELECTOR) || turn.querySelector(USER_ROLE_SELECTOR);
  }

  function resolveAssistantMessageNode(turn) {
    const primary = turn.querySelector(ASSISTANT_PRIMARY_SELECTOR);
    if (primary) {
      return primary;
    }

    const nodes = Array.from(turn.querySelectorAll(ASSISTANT_ROLE_SELECTOR));
    return nodes[nodes.length - 1] || null;
  }

  function resolveDeepSeekMessageHost(body) {
    if (!(body instanceof HTMLElement)) {
      return null;
    }

    let current = body;
    const candidates = [];
    while (current && current !== document.body && current !== document.documentElement) {
      if (current.matches(DEEPSEEK_VIRTUAL_ITEM_SELECTOR)) {
        return current;
      }

      if (current.matches(DEEPSEEK_PRIMARY_MESSAGE_HOST_SELECTOR)) {
        return current;
      }

      if (current.matches(DEEPSEEK_MESSAGE_HOST_SELECTOR)) {
        candidates.push(current);
      }

      current = current.parentElement;
    }

    return candidates[0] || body;
  }

  function resolveDeepSeekMessageBody(host, role) {
    if (!(host instanceof HTMLElement)) {
      return null;
    }

    if (role === "assistant") {
      if (host.matches(DEEPSEEK_ASSISTANT_MAIN_BODY_SELECTOR)) {
        return host;
      }

      const mainBody = host.querySelector(DEEPSEEK_ASSISTANT_MAIN_BODY_SELECTOR);
      if (mainBody instanceof HTMLElement) {
        return mainBody;
      }
    }

    const selector = role === "assistant" ? DEEPSEEK_ASSISTANT_BODY_SELECTOR : DEEPSEEK_USER_BODY_SELECTOR;
    if (host.matches(selector)) {
      return host;
    }

    const body = host.querySelector(selector);
    return body instanceof HTMLElement ? body : host;
  }

  function inferDeepSeekHostRole(host) {
    if (!(host instanceof HTMLElement)) {
      return "";
    }

    if (host.matches(DEEPSEEK_ASSISTANT_BODY_SELECTOR) || host.querySelector(DEEPSEEK_ASSISTANT_BODY_SELECTOR)) {
      return "assistant";
    }

    if (host.matches(DEEPSEEK_USER_BODY_SELECTOR) || host.querySelector(DEEPSEEK_USER_BODY_SELECTOR)) {
      return "user";
    }

    const roleHint = normalizeWhitespace(
      [
        host.getAttribute("data-role"),
        host.getAttribute("data-author"),
        host.getAttribute("aria-label"),
        host.getAttribute("class"),
      ]
        .filter(Boolean)
        .join(" "),
    ).toLowerCase();

    if (/\b(assistant|deepseek|model|ai)\b/.test(roleHint)) {
      return "assistant";
    }

    if (/\b(user|human|you|me)\b/.test(roleHint)) {
      return "user";
    }

    return "";
  }

  function hasDeepSeekMessageText(body) {
    return Boolean(body instanceof HTMLElement && normalizeWhitespace(body.innerText || body.textContent || ""));
  }

  function addDeepSeekMessageHost(items, host, role, body) {
    if (!(host instanceof HTMLElement) || !(body instanceof HTMLElement) || !role || !hasDeepSeekMessageText(body)) {
      return;
    }

    const duplicate = items.some((item) => {
      if (item.host === host || item.body === body) {
        return true;
      }

      return item.role === role && (item.body.contains(body) || body.contains(item.body));
    });

    if (duplicate) {
      return;
    }

    items.push({
      host,
      role,
      body,
    });
  }

  function sortDeepSeekMessageHosts(items) {
    return items.sort((left, right) => {
      if (left.host === right.host) {
        return 0;
      }

      const position = left.host.compareDocumentPosition(right.host);
      if (position & Node.DOCUMENT_POSITION_PRECEDING) {
        return 1;
      }

      if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
        return -1;
      }

      return 0;
    });
  }

  function resolveDeepSeekMessageHosts() {
    const items = [];

    document.querySelectorAll(DEEPSEEK_PRIMARY_MESSAGE_HOST_SELECTOR).forEach((host) => {
      if (!(host instanceof HTMLElement)) {
        return;
      }

      const virtualHost = host.closest(DEEPSEEK_VIRTUAL_ITEM_SELECTOR);
      if (virtualHost instanceof HTMLElement && virtualHost !== host) {
        return;
      }

      const role = inferDeepSeekHostRole(host);
      const body = resolveDeepSeekMessageBody(host, role);
      addDeepSeekMessageHost(items, host, role, body);
    });

    document.querySelectorAll(`${DEEPSEEK_ASSISTANT_MAIN_BODY_SELECTOR}, ${DEEPSEEK_USER_BODY_SELECTOR}`).forEach((body) => {
      if (!(body instanceof HTMLElement)) {
        return;
      }

      const role = body.matches(DEEPSEEK_USER_BODY_SELECTOR) ? "user" : "assistant";
      const host = resolveDeepSeekMessageHost(body);
      addDeepSeekMessageHost(items, host, role, body);
    });

    document.querySelectorAll(DEEPSEEK_MESSAGE_HOST_SELECTOR).forEach((host) => {
      if (!(host instanceof HTMLElement)) {
        return;
      }

      const role = inferDeepSeekHostRole(host);
      const body = resolveDeepSeekMessageBody(host, role);
      addDeepSeekMessageHost(items, host, role, body);
    });

    return sortDeepSeekMessageHosts(items);
  }

  function ensureDeepSeekTurnId(host) {
    const virtualListKey = normalizeWhitespace(host.getAttribute("data-virtual-list-item-key") || "");
    const existingTurnId = normalizeWhitespace(host.getAttribute(DEEPSEEK_TURN_ID_ATTR) || "");
    let turnId = virtualListKey ? `deepseek-turn-${virtualListKey}` : existingTurnId;

    if (!turnId) {
      turnId = deepSeekGeneratedTurnIds.get(host) || "";
    }

    if (!turnId) {
      deepSeekTurnSequence += 1;
      turnId = `deepseek-turn-${deepSeekTurnSequence}`;
      deepSeekGeneratedTurnIds.set(host, turnId);
    }

    deepSeekTurnHostCache.set(turnId, host);
    return turnId;
  }

  function buildDeepSeekHostSelectorHint(host, body, turnId) {
    if (host instanceof HTMLElement && host.id) {
      return buildIdSelector(host.id);
    }

    if (host instanceof HTMLElement && host.hasAttribute("data-virtual-list-item-key")) {
      return buildAttributeSelector(
        "data-virtual-list-item-key",
        host.getAttribute("data-virtual-list-item-key") || "",
      );
    }

    if (body instanceof HTMLElement && body.id) {
      return buildIdSelector(body.id);
    }

    if (host instanceof HTMLElement && host.hasAttribute(DEEPSEEK_TURN_ID_ATTR)) {
      return buildAttributeSelector(DEEPSEEK_TURN_ID_ATTR, host.getAttribute(DEEPSEEK_TURN_ID_ATTR) || turnId);
    }

    return "";
  }

  function resolveCodeLanguage(codeNode) {
    let current = codeNode.parentElement;
    while (current && current !== document.body) {
      const hasCode = current.querySelector(CODE_CONTENT_SELECTOR);
      const copyButton = current.querySelector('button[aria-label="复制"], button[aria-label="Copy"]');
      if (hasCode && copyButton) {
        const candidates = Array.from(current.querySelectorAll("div"))
          .map((element) => normalizeWhitespace(element.textContent || ""))
          .filter((text) => text && text.length <= 32 && !text.includes("\n"))
          .filter((text) => text !== "复制" && text.toLowerCase() !== "copy");

        const language = candidates.find((text) => /^[a-z0-9+#.\- ]+$/i.test(text));
        return normalizeCodeLanguage(language || "");
      }

      current = current.parentElement;
    }

    return "";
  }

  function normalizeCodeLanguage(language) {
    const lower = language.toLowerCase();
    const map = {
      bash: "bash",
      shell: "bash",
      sh: "bash",
      powershell: "powershell",
      javascript: "javascript",
      typescript: "typescript",
      python: "python",
      json: "json",
      html: "html",
      css: "css",
      sql: "sql",
    };

    return map[lower] || lower;
  }

  function readCodeMirrorText(codeNode) {
    const lines = [];
    let currentLine = "";

    Array.from(codeNode.childNodes).forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        currentLine += node.textContent || "";
        return;
      }

      if (!(node instanceof HTMLElement)) {
        return;
      }

      if (node.tagName === "BR") {
        lines.push(currentLine);
        currentLine = "";
        return;
      }

      currentLine += node.innerText;
    });

    lines.push(currentLine);
    return lines.join("\n").replace(/\u00a0/g, " ").replace(/\n+$/g, "");
  }

  function extractMathSource(node) {
    if (!(node instanceof Element)) {
      return "";
    }

    const annotation = node.matches('annotation[encoding="application/x-tex"], annotation[encoding="application/x-tex; mode=display"]')
      ? node
      : node.querySelector('annotation[encoding="application/x-tex"], annotation[encoding="application/x-tex; mode=display"]');
    if (annotation) {
      return normalizeWhitespace(annotation.textContent || "");
    }

    const dataLatex = node.getAttribute("data-latex") || node.getAttribute("data-tex");
    if (dataLatex) {
      return normalizeWhitespace(dataLatex);
    }

    const mathScript = node.matches('script[type^="math/tex"]') ? node : node.querySelector('script[type^="math/tex"]');
    if (mathScript) {
      return normalizeWhitespace(mathScript.textContent || "");
    }

    return "";
  }

  function getTopLevelMathNodes(root) {
    if (!(root instanceof Element)) {
      return [];
    }

    const candidates = [];
    if (root.matches(MATH_ROOT_SELECTOR)) {
      candidates.push(root);
    }

    const all = candidates.concat(Array.from(root.querySelectorAll(MATH_ROOT_SELECTOR)));
    return all.filter((node) => {
      let current = node.parentElement;
      while (current && current !== root) {
        if (current.matches(MATH_ROOT_SELECTOR)) {
          return false;
        }
        current = current.parentElement;
      }
      return true;
    });
  }

  function isMathRootNode(node) {
    return node instanceof Element && node.matches(INLINE_MATH_ROOT_SELECTOR);
  }

  function isMathBlockNode(node) {
    return node instanceof Element && node.matches(BLOCK_MATH_ROOT_SELECTOR);
  }

  function isMathInlineNode(node) {
    return isMathRootNode(node) && !isMathBlockNode(node);
  }

  function getFormulaCopyOptions() {
    return {
      getTopLevelMathNodes,
      extractMathSource,
    };
  }

  function installFormulaCopyHandler() {
    const formulaCopy = window.ChatGPTExporterFormulaCopy;
    if (formulaCopy && typeof formulaCopy.install === "function") {
      formulaCopy.install(getFormulaCopyOptions());
    }
  }

  function scheduleFormulaCopyEnhancement() {
    const formulaCopy = window.ChatGPTExporterFormulaCopy;
    if (formulaCopy && typeof formulaCopy.scheduleEnhancement === "function") {
      formulaCopy.scheduleEnhancement(getFormulaCopyOptions());
    }
  }

  function serializeMathNode(node, displayMode) {
    const latex = extractMathSource(node);
    if (!latex) {
      return "";
    }

    return displayMode ? `$$\n${latex}\n$$` : `$${latex}$`;
  }

  function replaceMathNodesInClone(root) {
    if (!(root instanceof Element)) {
      return;
    }

    const mathNodes = getTopLevelMathNodes(root);
    mathNodes.forEach((node) => {
      const replacement = serializeMathNode(node, isMathBlockNode(node));
      node.replaceWith(root.ownerDocument.createTextNode(replacement));
    });
  }

  function serializeNodeViaClone(node) {
    if (!(node instanceof Element)) {
      return "";
    }

    const clone = node.cloneNode(true);
    if (!(clone instanceof Element)) {
      return "";
    }

    clone.querySelectorAll(".katex-html[aria-hidden='true']").forEach((noise) => {
      noise.remove();
    });
    replaceMathNodesInClone(clone);

    clone.querySelectorAll("annotation, mjx-assistive-mml, .MJX_Assistive_MathML").forEach((noise) => {
      noise.remove();
    });

    return Array.from(clone.childNodes).map(serializeInline).join("");
  }

  function serializeInline(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || "";
    }

    if (!(node instanceof HTMLElement)) {
      return "";
    }

    if (isMathInlineNode(node)) {
      return serializeMathNode(node, false);
    }

    if (node.matches('[data-testid="webpage-citation-pill"]')) {
      const anchor = node.querySelector("a[href]");
      if (!anchor) {
        return "";
      }

      const label = normalizeWhitespace(anchor.textContent || "链接");
      const href = anchor.getAttribute("href") || "";
      return href ? ` [${label}](${href})` : ` ${label}`;
    }

    const children = Array.from(node.childNodes).map(serializeInline).join("");

    if (node.tagName === "BR") {
      return "\n";
    }

    if (node.tagName === "STRONG" || node.tagName === "B") {
      return `**${children.trim()}**`;
    }

    if (node.tagName === "EM" || node.tagName === "I") {
      return `*${children.trim()}*`;
    }

    if (node.tagName === "CODE") {
      return `\`${children.replace(/`/g, "\\`")}\``;
    }

    if (node.tagName === "A") {
      const href = node.getAttribute("href") || "";
      const label = children.trim() || href;
      return href ? `[${label}](${href})` : label;
    }

    if (node.matches(MATH_ROOT_SELECTOR) || node.querySelector(MATH_ROOT_SELECTOR)) {
      return serializeNodeViaClone(node);
    }

    return children;
  }

  function serializeList(node, ordered) {
    const items = Array.from(node.children).filter((child) => child.tagName === "LI");
    return items
      .map((item, index) => {
        const prefix = ordered ? `${index + 1}. ` : "- ";
        const text = normalizeWhitespace(Array.from(item.childNodes).map(serializeInline).join(""));
        return `${prefix}${text}`;
      })
      .join("\n");
  }

  function serializeTable(node) {
    const rows = Array.from(node.querySelectorAll("tr"));
    if (!rows.length) {
      return normalizeWhitespace(node.innerText);
    }

    const serializedRows = rows.map((row) =>
      Array.from(row.querySelectorAll("th, td"))
        .map((cell) => normalizeWhitespace(cell.innerText).replace(/\|/g, "\\|"))
        .join(" | "),
    );

    if (serializedRows.length === 1) {
      return `| ${serializedRows[0]} |`;
    }

    const firstRowColumns = serializedRows[0].split(" | ").length;
    const separator = Array.from({ length: firstRowColumns }, () => "---").join(" | ");
    return [`| ${serializedRows[0]} |`, `| ${separator} |`, ...serializedRows.slice(1).map((row) => `| ${row} |`)].join("\n");
  }

  function serializeBlock(node) {
    if (!(node instanceof HTMLElement)) {
      return "";
    }

    if (isMathBlockNode(node)) {
      return serializeMathNode(node, true);
    }

    if (isMathInlineNode(node)) {
      return serializeMathNode(node, false);
    }

    if (node.matches(CODE_CONTENT_SELECTOR)) {
      const code = readCodeMirrorText(node);
      const language = resolveCodeLanguage(node);
      return `\`\`\`${language}\n${code}\n\`\`\``;
    }

    const nestedCode = node.querySelector(CODE_CONTENT_SELECTOR);
    if (nestedCode) {
      return serializeBlock(nestedCode);
    }

    const tagName = node.tagName;
    if (tagName === "P") {
      return normalizeWhitespace(Array.from(node.childNodes).map(serializeInline).join(""));
    }

    if (tagName === "UL") {
      return serializeList(node, false);
    }

    if (tagName === "OL") {
      return serializeList(node, true);
    }

    if (tagName === "BLOCKQUOTE") {
      return normalizeWhitespace(node.innerText)
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
    }

    if (/^H[1-6]$/.test(tagName)) {
      const depth = Number(tagName[1]);
      return `${"#".repeat(depth)} ${normalizeWhitespace(node.innerText)}`;
    }

    if (tagName === "TABLE") {
      return serializeTable(node);
    }

    if (tagName === "PRE") {
      return `\`\`\`\n${node.innerText.replace(/\n+$/g, "")}\n\`\`\``;
    }

    if (tagName === "HR") {
      return "---";
    }

    const childBlocks = Array.from(node.children).map(serializeBlock).filter(Boolean);
    if (childBlocks.length) {
      return childBlocks.join("\n\n");
    }

    return normalizeWhitespace(node.innerText);
  }

  function serializeAssistantMarkdown(bodyNode) {
    if (!(bodyNode instanceof HTMLElement)) {
      return "";
    }

    const blocks = Array.from(bodyNode.childNodes)
      .map((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          return normalizeWhitespace(node.textContent || "");
        }

        if (!(node instanceof HTMLElement)) {
          return "";
        }

        return serializeBlock(node);
      })
      .filter(Boolean);

    return normalizeWhitespace(blocks.join("\n\n"));
  }

  function normalizeAssetUrl(rawUrl) {
    if (typeof rawUrl !== "string") {
      return "";
    }

    const trimmed = rawUrl.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.toLowerCase().startsWith("javascript:")) {
      return "";
    }

    try {
      return new URL(trimmed, window.location.href).href;
    } catch {
      return trimmed;
    }
  }

  function sanitizeAssetLabel(value, fallback) {
    const text = normalizeWhitespace(value || "").replace(/[\[\]]/g, "");
    return text || fallback;
  }

  function fileNameFromUrl(url) {
    try {
      const parsed = new URL(url);
      const segments = parsed.pathname.split("/").filter(Boolean);
      const lastSegment = segments[segments.length - 1] || "";
      return decodeURIComponent(lastSegment);
    } catch {
      return "";
    }
  }

  function inferMimeTypeFromUrl(url) {
    const lower = url.toLowerCase();
    if (lower.startsWith("data:")) {
      const match = lower.match(/^data:([^;,]+)/);
      return match ? match[1] : "";
    }

    if (/\.(png)(?:$|[?#])/i.test(lower)) return "image/png";
    if (/\.(jpe?g)(?:$|[?#])/i.test(lower)) return "image/jpeg";
    if (/\.(gif)(?:$|[?#])/i.test(lower)) return "image/gif";
    if (/\.(webp)(?:$|[?#])/i.test(lower)) return "image/webp";
    if (/\.(svg)(?:$|[?#])/i.test(lower)) return "image/svg+xml";
    if (/\.(pdf)(?:$|[?#])/i.test(lower)) return "application/pdf";
    if (/\.(docx)(?:$|[?#])/i.test(lower)) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (/\.(doc)(?:$|[?#])/i.test(lower)) return "application/msword";
    if (/\.(xlsx)(?:$|[?#])/i.test(lower)) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    if (/\.(xls)(?:$|[?#])/i.test(lower)) return "application/vnd.ms-excel";
    if (/\.(pptx)(?:$|[?#])/i.test(lower)) return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    if (/\.(ppt)(?:$|[?#])/i.test(lower)) return "application/vnd.ms-powerpoint";
    if (/\.(txt|md|json|csv)(?:$|[?#])/i.test(lower)) return "text/plain";
    if (/\.(zip|rar|7z|tar|gz)(?:$|[?#])/i.test(lower)) return "application/octet-stream";
    return "";
  }

  function looksLikeStaticAssetUrl(url) {
    if (typeof url !== "string" || !url) {
      return false;
    }

    const normalized = normalizeAssetUrl(url);
    if (!normalized) {
      return false;
    }

    const lower = normalized.toLowerCase();
    if (lower === window.location.href.toLowerCase()) {
      return false;
    }

    if (/^https?:\/\/chatgpt\.com\/c\/[a-z0-9-]+\/?$/i.test(normalized)) {
      return false;
    }

    if (
      lower.startsWith("blob:") ||
      lower.startsWith("data:") ||
      lower.includes("/backend-api/estuary/content") ||
      lower.includes("/backend-api/files/") ||
      lower.includes("oaiusercontent.com") ||
      lower.includes("/download") ||
      lower.includes("/attachment") ||
      lower.includes("/asset")
    ) {
      return true;
    }

    return Boolean(inferMimeTypeFromUrl(normalized));
  }

  function getAnchorLabel(anchor) {
    return (
      anchor.getAttribute("download") ||
      anchor.getAttribute("title") ||
      anchor.getAttribute("aria-label") ||
      anchor.textContent ||
      ""
    );
  }

  function looksLikeFilename(value) {
    return /[^\s]+\.[a-z0-9]{1,10}(?:$|\s)/i.test(value.trim());
  }

  function isLikelyFileNameText(value) {
    const text = normalizeWhitespace(value || "");
    if (!text || text.length > 180) {
      return false;
    }

    return /[^\s]+\.(pdf|docx?|xlsx?|pptx?|csv|txt|md|json|zip|rar|7z|png|jpe?g|webp|gif|svg)(?:$|\s)/i.test(text);
  }

  function extractUrlCandidates(value) {
    if (typeof value !== "string" || !value) {
      return [];
    }

    const candidates = new Set();
    const normalized = value
      .replace(/&amp;/g, "&")
      .replace(/\\u002F/g, "/")
      .replace(/\\\//g, "/");

    const patterns = [
      /https?:\/\/[^\s"'<>]+/gi,
      /\/backend-api\/estuary\/content\?[^\s"'<>]+/gi,
      /\/backend-api\/files\/[^\s"'<>]+/gi,
    ];

    patterns.forEach((pattern) => {
      const matches = normalized.match(pattern) || [];
      matches.forEach((match) => {
        const trimmed = match.replace(/[),.;]+$/g, "");
        if (trimmed) {
          candidates.add(trimmed);
        }
      });
    });

    return Array.from(candidates);
  }

  function extractFileIds(value) {
    if (typeof value !== "string" || !value) {
      return [];
    }

    const matches = value.match(/file[_-][a-z0-9]+/gi) || [];
    return Array.from(new Set(matches.map((match) => match.replace("-", "_"))));
  }

  function findDirectAssetUrl(root) {
    if (!(root instanceof Element)) {
      return "";
    }

    const nodes = [root, ...Array.from(root.querySelectorAll("*"))];
    if (root instanceof HTMLElement) {
      const closestForm = root.closest("form");
      if (closestForm instanceof Element && !nodes.includes(closestForm)) {
        nodes.push(closestForm);
      }

      const parentForm = root.parentElement ? root.parentElement.closest("form") : null;
      if (parentForm instanceof Element && !nodes.includes(parentForm)) {
        nodes.push(parentForm);
      }
    }

    for (const node of nodes) {
      if (!(node instanceof Element)) {
        continue;
      }

      const attributes = [];
      if (node instanceof HTMLElement && node.dataset) {
        Object.entries(node.dataset).forEach((entry) => {
          attributes.push({
            name: `data-${entry[0]}`,
            value: String(entry[1] || ""),
          });
        });
      }

      Array.from(node.attributes).forEach((attribute) => {
        attributes.push(attribute);
      });

      for (const attribute of attributes) {
        const candidates = extractUrlCandidates(attribute.value);
        for (const candidate of candidates) {
          const normalized = normalizeAssetUrl(candidate);
          if (looksLikeStaticAssetUrl(normalized)) {
            return normalized;
          }
        }
      }

      if (node instanceof HTMLButtonElement) {
        const formAction = node.formAction || node.getAttribute("formaction") || "";
        const normalized = normalizeAssetUrl(formAction);
        if (looksLikeStaticAssetUrl(normalized)) {
          return normalized;
        }
      }

      if (node instanceof HTMLFormElement) {
        const action = node.action || node.getAttribute("action") || "";
        const normalized = normalizeAssetUrl(action);
        if (looksLikeStaticAssetUrl(normalized)) {
          return normalized;
        }
      }
    }

    return "";
  }

  function collectAssetHintsFromString(value, state) {
    if (typeof value !== "string" || !value) {
      return;
    }

    extractUrlCandidates(value).forEach((candidate) => {
      const normalized = normalizeAssetUrl(candidate);
      if (looksLikeStaticAssetUrl(normalized)) {
        state.urls.add(normalized);
      }
    });

    extractFileIds(value).forEach((id) => {
      state.fileIds.add(id);
    });

    if (isLikelyFileNameText(value)) {
      state.fileNames.add(sanitizeAssetLabel(value, "attachment"));
    }
  }

  function walkAssetHintValue(value, state, seen, depth) {
    if (value == null || depth > 6) {
      return;
    }

    if (typeof value === "string") {
      collectAssetHintsFromString(value, state);
      return;
    }

    if (typeof value !== "object") {
      return;
    }

    if (seen.has(value)) {
      return;
    }
    seen.add(value);

    if (Array.isArray(value)) {
      value.slice(0, 40).forEach((item) => {
        walkAssetHintValue(item, state, seen, depth + 1);
      });
      return;
    }

    const entries = Object.entries(value).slice(0, 80);
    entries.forEach(([key, nextValue]) => {
      collectAssetHintsFromString(key, state);
      walkAssetHintValue(nextValue, state, seen, depth + 1);
    });
  }

  function extractReactAssetMetadata(root) {
    if (!(root instanceof HTMLElement)) {
      return {
        urls: [],
        fileIds: [],
        fileNames: [],
      };
    }

    const state = {
      urls: new Set(),
      fileIds: new Set(),
      fileNames: new Set(),
    };
    const seen = new WeakSet();
    const nodes = [root, ...Array.from(root.querySelectorAll("*")).slice(0, 40)];

    nodes.forEach((node) => {
      if (!(node instanceof HTMLElement)) {
        return;
      }

      Object.getOwnPropertyNames(node)
        .filter((name) => name.startsWith("__reactProps$") || name.startsWith("__reactFiber$") || name.startsWith("__reactEventHandlers$"))
        .forEach((name) => {
          try {
            walkAssetHintValue(node[name], state, seen, 0);
          } catch {
            // Ignore opaque React internals that throw during traversal.
          }
        });
    });

    return {
      urls: Array.from(state.urls),
      fileIds: Array.from(state.fileIds),
      fileNames: Array.from(state.fileNames),
    };
  }

  function extractDocumentAssetMetadata(filename) {
    const normalizedName = normalizeWhitespace(filename || "");
    if (!normalizedName) {
      return {
        urls: [],
        fileIds: [],
        fileNames: [],
      };
    }

    if (documentAssetHintCache.has(normalizedName)) {
      return documentAssetHintCache.get(normalizedName);
    }

    const state = {
      urls: new Set(),
      fileIds: new Set(),
      fileNames: new Set(),
    };
    const needle = escapeRegExp(normalizedName);
    const pattern = new RegExp(`.{0,600}${needle}.{0,600}`, "gi");
    const scriptTexts = Array.from(document.querySelectorAll("script"))
      .map((node) => node.textContent || "")
      .filter((text) => text.includes(normalizedName))
      .slice(0, 20);

    scriptTexts.forEach((text) => {
      const matches = text.match(pattern) || [];
      if (!matches.length) {
        collectAssetHintsFromString(text, state);
        return;
      }

      matches.slice(0, 12).forEach((match) => {
        collectAssetHintsFromString(match, state);
      });
    });

    const metadata = {
      urls: Array.from(state.urls),
      fileIds: Array.from(state.fileIds),
      fileNames: Array.from(state.fileNames),
    };
    documentAssetHintCache.set(normalizedName, metadata);
    return metadata;
  }

  function findFileIdHints(root) {
    if (!(root instanceof HTMLElement)) {
      return [];
    }

    const hints = new Set();
    const nodes = [root, ...Array.from(root.querySelectorAll("*"))];
    for (const node of nodes) {
      if (!(node instanceof HTMLElement)) {
        continue;
      }

      Array.from(node.attributes).forEach((attribute) => {
        extractFileIds(attribute.value).forEach((id) => {
          hints.add(id);
        });
      });

      extractFileIds(node.textContent || "").forEach((id) => {
        hints.add(id);
      });
    }

    return Array.from(hints);
  }

  function findCandidateAssetCards(root) {
    if (!(root instanceof HTMLElement)) {
      return [];
    }

    const selectors = [
      '[data-testid*="file"]',
      '[data-testid*="attachment"]',
      '[data-testid*="upload"]',
      '[data-testid*="image"]',
      '[data-testid*="preview"]',
      '[aria-label*="download" i]',
      '[aria-label*="attachment" i]',
      '[aria-label*="image" i]',
    ];

    const results = new Set();
    selectors.forEach((selector) => {
      root.querySelectorAll(selector).forEach((node) => {
        if (node instanceof HTMLElement) {
          results.add(node);
        }
      });
    });

    root.querySelectorAll("button, div, article, li").forEach((node) => {
      if (!(node instanceof HTMLElement)) {
        return;
      }

      const text = normalizeWhitespace(node.textContent || "");
      if (isLikelyFileNameText(text)) {
        results.add(node);
      }
    });

    return Array.from(results);
  }

  function isLikelyAttachmentAnchor(anchor) {
    const rawHref = anchor.getAttribute("href") || "";
    const href = normalizeAssetUrl(rawHref);
    if (!href) {
      return false;
    }

    if (anchor.querySelector("img")) {
      return false;
    }

    if (anchor.hasAttribute("download")) {
      return true;
    }

    if (href.startsWith("blob:")) {
      return true;
    }

    const lowerHref = href.toLowerCase();
    if (
      lowerHref.includes("/files/") ||
      lowerHref.includes("/file-") ||
      lowerHref.includes("/download") ||
      lowerHref.includes("/asset") ||
      lowerHref.includes("/attachment")
    ) {
      return true;
    }

    const label = getAnchorLabel(anchor);
    if (looksLikeFilename(label) || looksLikeFilename(fileNameFromUrl(href))) {
      return true;
    }

    const testId = anchor.getAttribute("data-testid") || "";
    if (/file|attachment|download/i.test(testId)) {
      return true;
    }

    return false;
  }

  function extractMessageAssets(...roots) {
    const validRoots = roots.filter((root) => root instanceof HTMLElement);
    if (!validRoots.length) {
      return [];
    }

    const seen = new Set();
    const assets = [];

    validRoots.forEach((root) => {
      root.querySelectorAll("img").forEach((node) => {
        if (!(node instanceof HTMLImageElement)) {
          return;
        }

        const url = normalizeAssetUrl(node.currentSrc || node.getAttribute("src") || "");
        if (!url || seen.has(`image:${url}`)) {
          return;
        }

        seen.add(`image:${url}`);
        const alt = normalizeWhitespace(node.getAttribute("alt") || "");
        const filename = sanitizeAssetLabel(fileNameFromUrl(url), alt || "image");
        assets.push({
          kind: "image",
          url,
          filename,
          mimeType: inferMimeTypeFromUrl(url),
          alt,
        });
      });

      root.querySelectorAll("a[href]").forEach((node) => {
        if (!(node instanceof HTMLAnchorElement) || !isLikelyAttachmentAnchor(node)) {
          return;
        }

        const url = normalizeAssetUrl(node.getAttribute("href") || "");
        if (!url || seen.has(`file:${url}`)) {
          return;
        }

        seen.add(`file:${url}`);
        const label = getAnchorLabel(node);
        const filename = sanitizeAssetLabel(label || fileNameFromUrl(url), "attachment");
        assets.push({
          kind: "file",
          url,
          filename,
          mimeType: inferMimeTypeFromUrl(url),
        });
      });
    });

    validRoots.flatMap((root) => findCandidateAssetCards(root)).forEach((card, index) => {
      const anchor = card.closest("a[href]") || card.querySelector("a[href]");
      if (anchor instanceof HTMLAnchorElement) {
        const url = normalizeAssetUrl(anchor.getAttribute("href") || "");
        if (url && !seen.has(`file:${url}`) && !seen.has(`image:${url}`)) {
          const label = getAnchorLabel(anchor) || card.textContent || "";
          assets.push({
            kind: "file",
            url,
            filename: sanitizeAssetLabel(label || fileNameFromUrl(url), `attachment-${index + 1}`),
            mimeType: inferMimeTypeFromUrl(url),
          });
          seen.add(`file:${url}`);
        }
        return;
      }

      const directUrl = findDirectAssetUrl(card);
      if (
        directUrl &&
        !seen.has(`file:${directUrl}`) &&
        !seen.has(`image:${directUrl}`) &&
        isCompatibleFileCardUrl(directUrl, card.textContent || "", findFileIdHints(card))
      ) {
        const label = card.textContent || "";
        assets.push({
          kind: "file",
          url: directUrl,
          filename: sanitizeAssetLabel(label || fileNameFromUrl(directUrl), `attachment-${index + 1}`),
          mimeType: inferMimeTypeFromUrl(directUrl),
        });
        seen.add(`file:${directUrl}`);
        return;
      }

      const reactMetadata = extractReactAssetMetadata(card);
      const reactUrl = reactMetadata.urls.find(
        (candidate) =>
          !seen.has(`file:${candidate}`) &&
          !seen.has(`image:${candidate}`) &&
          isCompatibleFileCardUrl(candidate, card.textContent || reactMetadata.fileNames[0] || "", reactMetadata.fileIds),
      );
      if (reactUrl) {
        const label = card.textContent || reactMetadata.fileNames[0] || "";
        assets.push({
          kind: "file",
          url: reactUrl,
          filename: sanitizeAssetLabel(label || fileNameFromUrl(reactUrl), `attachment-${index + 1}`),
          mimeType: inferMimeTypeFromUrl(reactUrl),
        });
        seen.add(`file:${reactUrl}`);
        return;
      }

      const text = normalizeWhitespace(card.textContent || "");
      if (!isLikelyFileNameText(text)) {
        return;
      }

      const documentMetadata = extractDocumentAssetMetadata(text);
      const documentUrl = documentMetadata.urls.find(
        (candidate) =>
          !seen.has(`file:${candidate}`) &&
          !seen.has(`image:${candidate}`) &&
          isCompatibleFileCardUrl(candidate, text, documentMetadata.fileIds),
      );
      if (documentUrl) {
        assets.push({
          kind: "file",
          url: documentUrl,
          filename: sanitizeAssetLabel(text || fileNameFromUrl(documentUrl), `attachment-${index + 1}`),
          mimeType: inferMimeTypeFromUrl(documentUrl),
        });
        seen.add(`file:${documentUrl}`);
        return;
      }

      const syntheticKey = `file-card:${text}`;
      if (seen.has(syntheticKey)) {
        return;
      }

      seen.add(syntheticKey);
      const fileIdHints = Array.from(
        new Set([...findFileIdHints(card), ...reactMetadata.fileIds, ...documentMetadata.fileIds]),
      );
      const hintSuffix = fileIdHints.length ? ` File id hints: ${fileIdHints.join(", ")}.` : "";
      assets.push({
        kind: "file",
        url: "",
        filename: sanitizeAssetLabel(text, `attachment-${index + 1}`),
        downloadStatus: "failed",
        error: `Detected an attachment card in the message, but no direct download URL was found in the DOM.${hintSuffix}`,
      });
    });

    return assets;
  }

  function collectChatGPTConversation() {
    const turns = resolveTurns();
    const messages = [];
    let userMessageIndex = 0;
    let assistantMessageIndex = 0;

    turns.forEach((turn, index) => {
      const turnId = turn.getAttribute("data-testid") || `conversation-turn-${index + 1}`;
      const userBody = resolveUserBody(turn);
      if (userBody instanceof HTMLElement) {
        const text = normalizeWhitespace(userBody.innerText);
        const assets = extractMessageAssets(turn, userBody);
        if (text || assets.length) {
          userMessageIndex += 1;
          messages.push({
            id: `${turnId}:user`,
            turnId,
            platform: "chatgpt",
            assistantLabel: "gpt",
            index: userMessageIndex,
            role: "user",
            text,
            markdown: text,
            html: userBody.innerHTML,
            assets,
          });
        }
        return;
      }

      const assistantNode = resolveAssistantMessageNode(turn);
      if (!(assistantNode instanceof HTMLElement)) {
        return;
      }

      const assistantBody = assistantNode.querySelector(ASSISTANT_BODY_SELECTOR) || assistantNode;
      if (!(assistantBody instanceof HTMLElement)) {
        return;
      }

      const markdown = serializeAssistantMarkdown(assistantBody);
      const text = normalizeWhitespace(assistantBody.innerText || markdown);
      const assets = extractMessageAssets(turn, assistantNode, assistantBody);
      if (!text && !markdown && !assets.length) {
        return;
      }

      assistantMessageIndex += 1;
      messages.push({
        id: `${turnId}:assistant`,
        turnId,
        platform: "chatgpt",
        assistantLabel: "gpt",
        index: assistantMessageIndex,
        role: "assistant",
        text,
        markdown: markdown || text,
        html: assistantBody.innerHTML,
        assets,
      });
    });

    return {
      metadata: {
        title: cleanConversationTitle(),
        url: window.location.href,
        exportedAt: new Date().toISOString(),
        messageCount: messages.length,
        platform: "chatgpt",
      },
      messages,
    };
  }

  function collectDeepSeekConversation() {
    const items = resolveDeepSeekMessageHosts();
    const messages = [];
    let userMessageIndex = 0;
    let assistantMessageIndex = 0;

    items.forEach((item) => {
      const host = item.host;
      const role = item.role;
      const body = resolveDeepSeekMessageBody(host, role) || item.body || host;
      if (!(host instanceof HTMLElement) || !(body instanceof HTMLElement)) {
        return;
      }

      const turnId = ensureDeepSeekTurnId(host);
      const assets = extractMessageAssets(host, body);

      if (role === "user") {
        const text = normalizeWhitespace(body.innerText || body.textContent || "");
        if (!text && !assets.length) {
          return;
        }

        userMessageIndex += 1;
        messages.push({
          id: `${turnId}:user`,
          turnId,
          platform: "deepseek",
          assistantLabel: "deepseek",
          hostSelectorHint: buildDeepSeekHostSelectorHint(host, body, turnId),
          index: userMessageIndex,
          role: "user",
          text,
          markdown: text,
          html: body.innerHTML,
          assets,
        });
        return;
      }

      if (role !== "assistant") {
        return;
      }

      const markdown = serializeAssistantMarkdown(body);
      const text = normalizeWhitespace(body.innerText || markdown);
      if (!text && !markdown && !assets.length) {
        return;
      }

      assistantMessageIndex += 1;
      messages.push({
        id: `${turnId}:assistant`,
        turnId,
        platform: "deepseek",
        assistantLabel: "deepseek",
        hostSelectorHint: buildDeepSeekHostSelectorHint(host, body, turnId),
        index: assistantMessageIndex,
        role: "assistant",
        text,
        markdown: markdown || text,
        html: body.innerHTML,
        assets,
      });
    });

    return {
      metadata: {
        title: cleanConversationTitle(),
        url: window.location.href,
        exportedAt: new Date().toISOString(),
        messageCount: messages.length,
        platform: "deepseek",
      },
      messages,
    };
  }

  function collectConversation() {
    if (isDeepSeekPage()) {
      return collectDeepSeekConversation();
    }

    return collectChatGPTConversation();
  }

  function applySelection(conversation) {
    if (!selectionLoaded) {
      return conversation;
    }

    const messages = conversation.messages.filter((message) => selectedMessageIds.has(message.id));
    return {
      metadata: {
        ...conversation.metadata,
        messageCount: messages.length,
      },
      messages,
    };
  }

  function toJson(conversation) {
    const formatters = window.ChatGPTExporterFormatters;
    if (formatters && typeof formatters.toJson === "function") {
      return formatters.toJson(conversation);
    }

    return JSON.stringify(conversation, null, 2);
  }

  function toMarkdown(conversation) {
    const formatters = window.ChatGPTExporterFormatters;
    if (formatters && typeof formatters.toMarkdown === "function") {
      return formatters.toMarkdown(conversation);
    }

    throw new Error("Markdown 导出模块未加载。");
  }

  function buildDataUrl(content, mimeType) {
    const downloadBridge = window.ChatGPTExporterDownloadBridge;
    if (downloadBridge && typeof downloadBridge.buildDataUrl === "function") {
      return downloadBridge.buildDataUrl(content, mimeType);
    }

    return `data:${mimeType};charset=utf-8,${encodeURIComponent(content)}`;
  }

  function binaryStringToUint8Array(binary) {
    const binaryUtils = window.ChatGPTExporterBinaryUtils;
    if (binaryUtils && typeof binaryUtils.binaryStringToUint8Array === "function") {
      return binaryUtils.binaryStringToUint8Array(binary);
    }

    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index) & 0xff;
    }
    return bytes;
  }

  function parseDataUrl(dataUrl) {
    const binaryUtils = window.ChatGPTExporterBinaryUtils;
    if (binaryUtils && typeof binaryUtils.parseDataUrl === "function") {
      return binaryUtils.parseDataUrl(dataUrl);
    }

    throw new Error("Data URL 解析模块未加载。");
  }

  function requestPageFetch(url) {
    const pageBridge = window.ChatGPTExporterPageBridge;
    if (pageBridge && typeof pageBridge.requestPageFetch === "function") {
      return pageBridge.requestPageFetch(url);
    }

    return Promise.resolve({ ok: false, error: "页面上下文下载桥接模块未加载。" });
  }

  function stringToUtf8Bytes(value) {
    const binaryUtils = window.ChatGPTExporterBinaryUtils;
    if (binaryUtils && typeof binaryUtils.stringToUtf8Bytes === "function") {
      return binaryUtils.stringToUtf8Bytes(value);
    }

    return new TextEncoder().encode(value);
  }

  function buildBinaryDataUrl(bytes, mimeType) {
    const downloadBridge = window.ChatGPTExporterDownloadBridge;
    if (downloadBridge && typeof downloadBridge.buildBinaryDataUrl === "function") {
      return downloadBridge.buildBinaryDataUrl(bytes, mimeType);
    }

    throw new Error("二进制下载模块未加载。");
  }

  function requestBrowserDownloadBytes(filename, bytes, mimeType) {
    const downloadBridge = window.ChatGPTExporterDownloadBridge;
    if (downloadBridge && typeof downloadBridge.requestBrowserDownloadBytes === "function") {
      return downloadBridge.requestBrowserDownloadBytes(filename, bytes, mimeType);
    }

    return requestBrowserDownloadUrl(filename, buildBinaryDataUrl(bytes, mimeType));
  }

  function getFileExtensionFromMimeType(mimeType) {
    const lower = (mimeType || "").toLowerCase();
    const map = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/gif": "gif",
      "image/webp": "webp",
      "image/svg+xml": "svg",
      "application/pdf": "pdf",
      "application/msword": "doc",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
      "application/vnd.ms-excel": "xls",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
      "application/vnd.ms-powerpoint": "ppt",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
      "application/json": "json",
      "text/markdown": "md",
      "text/plain": "txt",
      "text/csv": "csv",
      "application/zip": "zip",
    };
    return map[lower] || "";
  }

  function getFileExtensionFromName(value) {
    const match = (value || "").match(/\.([a-z0-9]{1,10})(?:$|[?#])/i);
    return match ? match[1].toLowerCase() : "";
  }

  function getExpectedAssetExtension(asset) {
    if (!asset) {
      return "";
    }

    return (
      getFileExtensionFromName(asset.filename || "") ||
      getFileExtensionFromName(asset.url || "") ||
      getFileExtensionFromMimeType(asset.mimeType || "") ||
      ""
    ).toLowerCase();
  }

  function ensureAssetPayloadMatchesExpectation(asset, payload, resolvedMimeType) {
    if (!asset || asset.kind !== "file") {
      return;
    }

    const expectedExtension = getExpectedAssetExtension(asset);
    if (!expectedExtension) {
      return;
    }

    const actualExtension = (
      getFileExtensionFromName((payload && payload.filename) || "") ||
      getFileExtensionFromMimeType(resolvedMimeType || "") ||
      getFileExtensionFromName((asset && asset.url) || "") ||
      ""
    ).toLowerCase();

    if (!actualExtension) {
      return;
    }

    if (expectedExtension !== actualExtension) {
      throw new Error(`附件类型不匹配：期望 .${expectedExtension}，实际得到 .${actualExtension}`);
    }
  }

  function ensureFileExtension(filename, extension) {
    const cleanExtension = (extension || "").replace(/^\./, "").toLowerCase();
    if (!cleanExtension) {
      return filename;
    }

    if (getFileExtensionFromName(filename) === cleanExtension) {
      return filename;
    }

    return `${filename}.${cleanExtension}`;
  }

  function createUniquePath(path, usedPaths) {
    if (!usedPaths.has(path)) {
      usedPaths.add(path);
      return path;
    }

    const lastSlash = path.lastIndexOf("/");
    const directory = lastSlash >= 0 ? path.slice(0, lastSlash + 1) : "";
    const name = lastSlash >= 0 ? path.slice(lastSlash + 1) : path;
    const extension = getFileExtensionFromName(name);
    const baseName = extension ? name.slice(0, -(extension.length + 1)) : name;

    let attempt = 2;
    while (true) {
      const candidateName = extension ? `${baseName}-${attempt}.${extension}` : `${baseName}-${attempt}`;
      const candidatePath = `${directory}${candidateName}`;
      if (!usedPaths.has(candidatePath)) {
        usedPaths.add(candidatePath);
        return candidatePath;
      }
      attempt += 1;
    }
  }

  function parseContentDispositionFilename(header) {
    if (!header) {
      return "";
    }

    const utf8Match = header.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
    if (utf8Match) {
      try {
        return decodeURIComponent(utf8Match[1].trim());
      } catch {
        return utf8Match[1].trim();
      }
    }

    const quotedMatch = header.match(/filename\s*=\s*"([^"]+)"/i);
    if (quotedMatch) {
      return quotedMatch[1].trim();
    }

    const plainMatch = header.match(/filename\s*=\s*([^;]+)/i);
    return plainMatch ? plainMatch[1].trim() : "";
  }

  function extractFileIdHintsFromText(value) {
    if (typeof value !== "string") {
      return [];
    }

    return Array.from(new Set(extractFileIds(value)));
  }

  function getResourceEntryNames() {
    return new Set(
      performance
        .getEntriesByType("resource")
        .map((entry) => entry && typeof entry.name === "string" ? entry.name : "")
        .filter(Boolean),
    );
  }

  function findTurnElement(turnId, message) {
    if (message && message.platform === "deepseek") {
      const hinted = querySelectorSafely(message.hostSelectorHint || "");
      if (hinted instanceof HTMLElement) {
        return hinted;
      }

      if (turnId) {
        const cachedTurn = deepSeekTurnHostCache.get(turnId);
        if (cachedTurn instanceof HTMLElement && cachedTurn.isConnected) {
          return cachedTurn;
        }

        const byTurnId = querySelectorSafely(buildAttributeSelector(DEEPSEEK_TURN_ID_ATTR, turnId));
        if (byTurnId instanceof HTMLElement) {
          return byTurnId;
        }
      }

      return null;
    }

    if (!turnId) {
      return null;
    }

    return document.querySelector(`section${buildAttributeSelector("data-testid", turnId)}`);
  }

  function findAttachmentTrigger(message, asset) {
    const turn = findTurnElement(message.turnId, message);
    if (!(turn instanceof HTMLElement)) {
      return null;
    }

    const filename = normalizeWhitespace(asset.filename || "");
    const candidates = Array.from(turn.querySelectorAll("button, [role='button'], [aria-label], [title]"));
    const exact = candidates.find((node) => {
      if (!(node instanceof HTMLElement)) {
        return false;
      }

      const label = normalizeWhitespace(node.getAttribute("aria-label") || node.getAttribute("title") || node.textContent || "");
      return Boolean(filename) && label === filename;
    });
    if (exact instanceof HTMLElement) {
      return exact;
    }

    const fuzzy = candidates.find((node) => {
      if (!(node instanceof HTMLElement)) {
        return false;
      }

      const label = normalizeWhitespace(node.getAttribute("aria-label") || node.getAttribute("title") || node.textContent || "");
      return Boolean(filename) && label.includes(filename);
    });

    return fuzzy instanceof HTMLElement ? fuzzy : turn;
  }

  function looksLikeDirectDownloadOnlyAsset(asset) {
    if (!asset || asset.kind !== "file") {
      return false;
    }

    if (asset.url) {
      return false;
    }

    const filename = normalizeWhitespace(asset.filename || "").toLowerCase();
    return /\.(pdf|docx?|xlsx?|pptx?|csv|zip|rar|7z)$/i.test(filename);
  }

  function triggerNativeDownloadElement(trigger) {
    if (!(trigger instanceof HTMLElement)) {
      return;
    }

    try {
      trigger.focus();
    } catch (error) {}

    ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach((type) => {
      try {
        trigger.dispatchEvent(
          new MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            view: window,
            button: 0,
          }),
        );
      } catch (error) {}
    });

    try {
      trigger.click();
    } catch (error) {}
  }

  function primeNativeAttachmentDownloadsFromCurrentDom() {
    const conversation = collectConversation();
    if (!conversation || !Array.isArray(conversation.messages)) {
      return 0;
    }

    const clicked = new Set();
    let count = 0;

    conversation.messages.forEach((message) => {
      if (!Array.isArray(message.assets)) {
        return;
      }

      message.assets.forEach((asset) => {
        if (!looksLikeDirectDownloadOnlyAsset(asset)) {
          return;
        }

        const dedupeKey = `${message.turnId || message.id}:${asset.filename || ""}`;
        if (clicked.has(dedupeKey)) {
          return;
        }

        const trigger = findAttachmentTrigger(message, asset);
        if (!(trigger instanceof HTMLElement)) {
          return;
        }

        clicked.add(dedupeKey);
        primedNativeAssetKeys.add(buildAssetTrackingKey(message, asset));
        triggerNativeDownloadElement(trigger);
        count += 1;
      });
    });

    return count;
  }

  function looksLikeAssetRequestUrl(url, fileIdHints) {
    if (typeof url !== "string" || !url) {
      return false;
    }

    const lower = url.toLowerCase();
    if (lower.includes("/backend-api/files/library")) {
      return false;
    }

    if (lower.startsWith("blob:")) {
      return true;
    }

    if (
      lower.includes("/backend-api/estuary/content") ||
      lower.includes("/backend-api/files/") ||
      lower.includes("/download") ||
      lower.includes("/attachment") ||
      lower.includes("/asset")
    ) {
      return true;
    }

    return fileIdHints.some((hint) => lower.includes(hint.toLowerCase()));
  }

  function buildBackendFileDownloadUrl(fileId) {
    const normalized = typeof fileId === "string" ? fileId.trim() : "";
    if (!normalized) {
      return "";
    }

    return `${window.location.origin}/backend-api/files/download/${normalized}?post_id=&inline=false`;
  }

  function isDirectFileDownloadUrl(url) {
    return typeof url === "string" && /\/backend-api\/files\/download\/file_/i.test(url);
  }

  function isCompatibleFileCardUrl(candidateUrl, expectedFilename, fileIdHints) {
    const normalizedUrl = normalizeAssetUrl(candidateUrl);
    if (!looksLikeStaticAssetUrl(normalizedUrl)) {
      return false;
    }

    const expectedExtension = getFileExtensionFromName(expectedFilename || "");
    if (!expectedExtension) {
      return true;
    }

    if (isDirectFileDownloadUrl(normalizedUrl)) {
      return true;
    }

    const lower = normalizedUrl.toLowerCase();
    const normalizedName = normalizeWhitespace(expectedFilename || "").toLowerCase();
    if (normalizedName && lower.includes(normalizedName)) {
      return true;
    }

    const matchedFileId = Array.isArray(fileIdHints)
      ? fileIdHints.some((hint) => lower.includes(String(hint || "").toLowerCase()))
      : false;
    if (matchedFileId) {
      return true;
    }

    const candidateExtension =
      getFileExtensionFromName(normalizedUrl) || getFileExtensionFromMimeType(inferMimeTypeFromUrl(normalizedUrl));
    if (candidateExtension) {
      return candidateExtension.toLowerCase() === expectedExtension.toLowerCase();
    }

    if (
      /^(pdf|doc|docx|xls|xlsx|ppt|pptx|csv|zip|rar|7z)$/i.test(expectedExtension) &&
      lower.includes("/backend-api/estuary/content")
    ) {
      return false;
    }

    return false;
  }

  function findCapturedAssetUrl(sinceTs, filename, fileIdHints) {
    const normalizedFileName = normalizeWhitespace(filename || "").toLowerCase();
    const pageBridge = window.ChatGPTExporterPageBridge;
    const pageNetworkEvents =
      pageBridge && typeof pageBridge.getEvents === "function" ? pageBridge.getEvents() : [];

    for (let index = pageNetworkEvents.length - 1; index >= 0; index -= 1) {
      const entry = pageNetworkEvents[index];
      if (!entry || entry.ts < sinceTs) {
        continue;
      }

      const urls = Array.from(new Set([entry.url, ...(entry.urls || [])])).filter(Boolean);
      const fileIdMatched = Array.isArray(entry.fileIds)
        ? entry.fileIds.some((id) => fileIdHints.some((hint) => hint.toLowerCase() === id.toLowerCase()))
        : false;
      const fileNameMatched = Array.isArray(entry.fileNames)
        ? entry.fileNames.some((name) => normalizeWhitespace(name).toLowerCase() === normalizedFileName)
        : false;
      const synthesizedUrl =
        fileNameMatched && Array.isArray(entry.fileIds) && entry.fileIds.length === 1
          ? buildBackendFileDownloadUrl(entry.fileIds[0])
          : "";
      const exactDownloadUrl = urls.find((candidate) => isDirectFileDownloadUrl(candidate));

      if (exactDownloadUrl && (fileNameMatched || fileIdMatched || sinceTs > 0)) {
        return exactDownloadUrl;
      }

      const matchedUrl = urls.find((candidate) => {
        const lower = candidate.toLowerCase();
        const urlFileIdMatched = fileIdHints.some((hint) => lower.includes(hint.toLowerCase()));
        const urlFileNameMatched = normalizedFileName ? lower.includes(normalizedFileName) : false;

        if (urlFileIdMatched || urlFileNameMatched) {
          return true;
        }

        if (isDirectFileDownloadUrl(candidate) && (fileNameMatched || fileIdMatched)) {
          return true;
        }

        return false;
      });

      const directDownloadReason =
        entry.reason === "anchor-click" ||
        entry.reason === "window-open" ||
        entry.reason === "create-object-url";

      if (matchedUrl && (fileIdMatched || fileNameMatched || (directDownloadReason && normalizedFileName && fileNameMatched))) {
        return matchedUrl;
      }

      if (synthesizedUrl && (fileNameMatched || fileIdMatched)) {
        return synthesizedUrl;
      }
    }

    return "";
  }

  async function tryResolveAssetUrlViaInteraction(message, asset) {
    const trigger = findAttachmentTrigger(message, asset);
    if (!(trigger instanceof HTMLElement)) {
      return "";
    }

    const beforeResources = getResourceEntryNames();
    const turn = findTurnElement(message.turnId, message);
    const scope = trigger.closest("section") || turn || trigger;
    const beforeDirectUrl = findDirectAssetUrl(scope);
    if (beforeDirectUrl) {
      return beforeDirectUrl;
    }

    const fileIdHints = extractFileIdHintsFromText(asset.error || "");
    const networkStartTs = Date.now();

    triggerNativeDownloadElement(trigger);

    for (let attempt = 0; attempt < 12; attempt += 1) {
      await delay(250);

      const scopedUrl = findDirectAssetUrl(scope);
      if (scopedUrl) {
        return scopedUrl;
      }

      const documentUrl = findDirectAssetUrl(document.body);
      if (documentUrl && looksLikeAssetRequestUrl(documentUrl, fileIdHints)) {
        return documentUrl;
      }

      const capturedUrl = findCapturedAssetUrl(networkStartTs, asset.filename, fileIdHints);
      if (capturedUrl) {
        return capturedUrl;
      }

      const afterResources = getResourceEntryNames();
      const nextUrl = Array.from(afterResources).find((name) => !beforeResources.has(name) && looksLikeAssetRequestUrl(name, fileIdHints));
      if (nextUrl) {
        return nextUrl;
      }
    }

    return "";
  }

  function buildZip(entries) {
    const binaryUtils = window.ChatGPTExporterBinaryUtils;
    if (binaryUtils && typeof binaryUtils.buildZip === "function") {
      return binaryUtils.buildZip(entries);
    }

    throw new Error("ZIP 构建模块未加载。");
  }

  async function fetchAssetPayload(url) {
    if (!url) {
      throw new Error("附件地址为空。");
    }

    if (url.startsWith("data:")) {
      return parseDataUrl(url);
    }

    const response = await fetch(url, {
      credentials: "include",
    });
    if (!response.ok) {
      const pagePayload = await requestPageFetch(url).catch(() => null);
      if (pagePayload && pagePayload.ok === true && typeof pagePayload.base64 === "string") {
        return {
          bytes: binaryStringToUint8Array(atob(pagePayload.base64)),
          mimeType: (pagePayload.mimeType || "").trim(),
          filename: parseContentDispositionFilename(pagePayload.contentDisposition || ""),
        };
      }

      const pageError =
        pagePayload && pagePayload.ok === false && pagePayload.error
          ? `；页面上下文下载失败：${pagePayload.error}`
          : "";
      throw new Error(`下载失败：HTTP ${response.status}${pageError}`);
    }

    return {
      bytes: new Uint8Array(await response.arrayBuffer()),
      mimeType: (response.headers.get("content-type") || "").split(";")[0].trim(),
      filename: parseContentDispositionFilename(response.headers.get("content-disposition") || ""),
    };
  }

  async function buildConversationZip(conversation) {
    const clonedConversation = JSON.parse(JSON.stringify(conversation));
    const usedPaths = new Set(["conversation.json", "conversation.md", "bundle-manifest.json"]);
    const assetFetchCache = new Map();
    const assetEntries = [];
    const assetRecords = [];
    const conversationTitle = clonedConversation.metadata.title || "chatgpt-conversation";
    const totalAssets = clonedConversation.messages.reduce((count, message) => {
      return count + (Array.isArray(message.assets) ? message.assets.length : 0);
    }, 0);
    let processedAssets = 0;
    let downloadedAssets = 0;
    let browserQueuedAssets = 0;

    for (const message of clonedConversation.messages) {
      if (!Array.isArray(message.assets) || !message.assets.length) {
        continue;
      }

      for (let assetIndex = 0; assetIndex < message.assets.length; assetIndex += 1) {
        const asset = message.assets[assetIndex];
        const assetTrackingKey = buildAssetTrackingKey(message, asset);
        processedAssets += 1;
        setStatus(`正在打包附件 ${processedAssets}/${totalAssets}…`, "muted");

        if (!asset.url) {
          const capturedUrl = findCapturedAssetUrl(0, asset.filename, extractFileIdHintsFromText(asset.error || ""));
          if (capturedUrl) {
            asset.url = capturedUrl;
            asset.mimeType = asset.mimeType || inferMimeTypeFromUrl(capturedUrl);
          }
        }

        if (!asset.url) {
          const resolvedUrl = await tryResolveAssetUrlViaInteraction(message, asset);
          if (resolvedUrl) {
            asset.url = resolvedUrl;
            asset.mimeType = asset.mimeType || inferMimeTypeFromUrl(resolvedUrl);
          }
        }

        if (!asset.url) {
          if (looksLikeDirectDownloadOnlyAsset(asset) && primedNativeAssetKeys.has(assetTrackingKey)) {
            asset.error =
              asset.error ||
              "已尝试触发文件卡片下载，但没有捕获到可复用的下载地址。";
          }

          asset.downloadStatus = "failed";
          asset.error = asset.error || "No direct download URL was found in the DOM.";
          delete asset.zipPath;
          assetRecords.push({
            messageId: message.id,
            role: message.role,
            sourceUrl: "",
            filename: asset.filename || "",
            mimeType: asset.mimeType || "",
            status: "failed",
            error: asset.error,
          });
          continue;
        }

        asset.downloadStatus = "pending";

        try {
          if (!assetFetchCache.has(asset.url)) {
            assetFetchCache.set(asset.url, fetchAssetPayload(asset.url));
          }

          const payload = await assetFetchCache.get(asset.url);
          const resolvedMimeType = payload.mimeType || asset.mimeType || inferMimeTypeFromUrl(asset.url) || "application/octet-stream";
          ensureAssetPayloadMatchesExpectation(asset, payload, resolvedMimeType);
          const extension =
            getFileExtensionFromName(payload.filename || "") ||
            getFileExtensionFromName(asset.filename || "") ||
            getFileExtensionFromName(asset.url) ||
            getFileExtensionFromMimeType(resolvedMimeType) ||
            (asset.kind === "image" ? "bin" : "bin");
          const preferredName =
            payload.filename ||
            asset.filename ||
            fileNameFromUrl(asset.url) ||
            `${message.role}-${message.index}-${asset.kind}-${assetIndex + 1}`;
          const finalName = ensureFileExtension(sanitizeFileName(preferredName), extension);
          const zipPath = createUniquePath(
            `assets/${String(processedAssets).padStart(3, "0")}-${finalName}`,
            usedPaths,
          );

          asset.filename = finalName;
          asset.mimeType = resolvedMimeType;
          asset.zipPath = zipPath;
          asset.downloadStatus = "downloaded";
          delete asset.error;

          assetEntries.push({
            path: zipPath,
            bytes: payload.bytes,
          });
          assetRecords.push({
            messageId: message.id,
            role: message.role,
            sourceUrl: asset.url,
            zipPath,
            filename: finalName,
            mimeType: resolvedMimeType,
            status: "downloaded",
          });
          downloadedAssets += 1;
        } catch (error) {
          const messageText = error instanceof Error ? error.message : "未知错误";
          const shouldQueueBrowserDownload = Boolean(asset.url) && /HTTP 401|HTTP 403/i.test(messageText);
          if (shouldQueueBrowserDownload) {
            try {
              const queued = await queueBrowserAssetDownload(conversationTitle, asset, browserQueuedAssets);
              asset.filename = queued.filename;
              asset.downloadStatus = "browser-download-queued";
              asset.error = `ZIP 打包读取失败，已改由浏览器原生下载保存到：${queued.downloadPath}`;
              delete asset.zipPath;
              assetRecords.push({
                messageId: message.id,
                role: message.role,
                sourceUrl: asset.url,
                filename: queued.filename,
                mimeType: asset.mimeType || "",
                status: "browser-download-queued",
                browserDownloadPath: queued.downloadPath,
                browserDownloadId: queued.downloadId,
                error: messageText,
              });
              browserQueuedAssets += 1;
              continue;
            } catch (downloadError) {
              const browserMessage = downloadError instanceof Error ? downloadError.message : "浏览器下载请求失败。";
              asset.downloadStatus = "failed";
              asset.error = `${messageText}；浏览器原生下载失败：${browserMessage}`;
              delete asset.zipPath;
              assetRecords.push({
                messageId: message.id,
                role: message.role,
                sourceUrl: asset.url,
                filename: asset.filename || "",
                mimeType: asset.mimeType || "",
                status: "failed",
                error: asset.error,
              });
              continue;
            }
          }

          asset.downloadStatus = "failed";
          asset.error = messageText;
          delete asset.zipPath;
          assetRecords.push({
            messageId: message.id,
            role: message.role,
            sourceUrl: asset.url,
            filename: asset.filename || "",
            mimeType: asset.mimeType || "",
            status: "failed",
            error: messageText,
          });
        }
      }
    }

    const bundleManifest = {
      generatedAt: new Date().toISOString(),
      title: clonedConversation.metadata.title,
      url: clonedConversation.metadata.url,
      messageCount: clonedConversation.metadata.messageCount,
      assetCount: totalAssets,
      downloadedAssetCount: downloadedAssets,
      browserDownloadQueuedCount: browserQueuedAssets,
      failedAssetCount: totalAssets - downloadedAssets - browserQueuedAssets,
      assets: assetRecords,
    };

    const zipBytes = buildZip([
      {
        path: "conversation.json",
        bytes: stringToUtf8Bytes(JSON.stringify(clonedConversation, null, 2)),
      },
      {
        path: "conversation.md",
        bytes: stringToUtf8Bytes(toMarkdown(clonedConversation)),
      },
      {
        path: "bundle-manifest.json",
        bytes: stringToUtf8Bytes(JSON.stringify(bundleManifest, null, 2)),
      },
      ...assetEntries,
    ]);

    return {
      bytes: zipBytes,
      assetCount: totalAssets,
      downloadedAssetCount: downloadedAssets,
      browserDownloadQueuedCount: browserQueuedAssets,
      failedAssetCount: totalAssets - downloadedAssets - browserQueuedAssets,
    };
  }

  function buildConversationPdfDataUrl(conversation) {
    const pdfExport = window.ChatGPTExporterPdfExport;
    if (pdfExport && typeof pdfExport.buildConversationPdfDataUrl === "function") {
      return pdfExport.buildConversationPdfDataUrl(conversation);
    }

    throw new Error("PDF 导出模块未加载。");
  }

  function requestBrowserDownloadUrl(filename, url, options) {
    const downloadBridge = window.ChatGPTExporterDownloadBridge;
    if (downloadBridge && typeof downloadBridge.requestBrowserDownloadUrl === "function") {
      return downloadBridge.requestBrowserDownloadUrl(filename, url, options);
    }

    return Promise.reject(new Error("浏览器下载桥接模块未加载。"));
  }

  function requestBrowserDownload(filename, content, mimeType) {
    const downloadBridge = window.ChatGPTExporterDownloadBridge;
    if (downloadBridge && typeof downloadBridge.requestBrowserDownload === "function") {
      return downloadBridge.requestBrowserDownload(filename, content, mimeType);
    }

    return requestBrowserDownloadUrl(filename, buildDataUrl(content, mimeType));
  }

  function buildBrowserDownloadPath(conversationTitle, filename, index) {
    const safeTitle = sanitizeFileName(conversationTitle || "chatgpt-conversation");
    const safeFileName = sanitizeFileName(filename || `attachment-${index + 1}`);
    return `${safeTitle} attachments/${String(index + 1).padStart(3, "0")}-${safeFileName}`;
  }

  async function queueBrowserAssetDownload(conversationTitle, asset, index) {
    if (!asset.url) {
      throw new Error("附件地址为空。");
    }

    const filename =
      asset.filename ||
      fileNameFromUrl(asset.url) ||
      `attachment-${index + 1}${getFileExtensionFromMimeType(asset.mimeType || "") ? `.${getFileExtensionFromMimeType(asset.mimeType || "")}` : ""}`;
    const downloadPath = buildBrowserDownloadPath(conversationTitle, filename, index);
    const response = await requestBrowserDownloadUrl(downloadPath, asset.url, {
      saveAs: false,
      conflictAction: "uniquify",
    });

    return {
      downloadId: response && response.downloadId ? response.downloadId : null,
      downloadPath,
      filename,
    };
  }

  async function runExport(format) {
    if (exportInFlight) {
      return;
    }

    exportInFlight = true;
    setExportButtonsDisabled(true);
    let primedNativeDownloads = 0;
    if (format === "zip") {
      primedNativeAssetKeys.clear();
      primedNativeDownloads = primeNativeAttachmentDownloadsFromCurrentDom();
    }
    setStatus(
      primedNativeDownloads > 0
        ? `已触发 ${primedNativeDownloads} 个附件的浏览器原生下载，正在整理导出数据…`
        : "正在整理导出数据…",
      "muted",
    );

    try {
      const wasFullySelected = selectionLoaded && isEveryMessageSelected(latestConversation);
      latestConversation = await collectConversationForAction({
        loadHistory: isDeepSeekPage(),
      });
      if (selectionLoaded && wasFullySelected) {
        selectedMessageIds = new Set(latestConversation.messages.map((message) => message.id));
      }
      const conversation = applySelection(latestConversation);

      if (!conversation.messages.length) {
        throw new Error("当前没有可导出的消息。请先刷新消息列表并至少勾选一条消息。");
      }

      renderSelectionList(latestConversation);
      renderTimelineList();

      if (format === "pdf") {
        const filename = `${cleanConversationTitle()}.pdf`;
        setStatus("正在生成 PDF…", "muted");
        const pdfUrl = buildConversationPdfDataUrl(conversation);
        setStatus("正在请求浏览器保存 PDF…", "muted");
        await requestBrowserDownloadUrl(filename, pdfUrl);
        setStatus(`导出完成：${filename}`, "success");
        return;
      }

      if (format === "zip") {
        const filename = `${cleanConversationTitle()}.zip`;
        setStatus("正在整理 ZIP 导出内容…", "muted");
        const zipResult = await buildConversationZip(conversation);
        setStatus("正在请求浏览器保存 ZIP…", "muted");
        await requestBrowserDownloadBytes(filename, zipResult.bytes, "application/zip");
        const assetNote =
          zipResult.assetCount > 0
            ? `，附件 ${zipResult.downloadedAssetCount}/${zipResult.assetCount} 已打包`
            : "，当前所选消息没有可打包附件";
        const browserNote =
          zipResult.browserDownloadQueuedCount > 0
            ? `，${zipResult.browserDownloadQueuedCount} 个附件已改为浏览器原生下载`
            : "";
        const failedNote = zipResult.failedAssetCount > 0 ? `，${zipResult.failedAssetCount} 个附件下载失败` : "";
        setStatus(`导出完成：${filename}${assetNote}${browserNote}${failedNote}`, "success");
        return;
      }

      const extension = format === "json" ? "json" : "md";
      const content = format === "json" ? toJson(conversation) : toMarkdown(conversation);
      const mimeType = format === "json" ? "application/json" : "text/markdown";
      const filename = `${cleanConversationTitle()}.${extension}`;

      setStatus("正在请求浏览器保存文件…", "muted");
      await requestBrowserDownload(filename, content, mimeType);

      setStatus(`导出完成：${filename}`, "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "导出失败。";
      setStatus(message, "error");
    } finally {
      setExportButtonsDisabled(false);
      exportInFlight = false;
    }
  }

  function start() {
    if (!isSupportedConversationPage()) {
      return;
    }

    installPageHookBridge();
    injectPageHook();
    ensurePanel();
    ensureToolbar();
    ensureTimelinePanel();
    installFormulaCopyHandler();
    installObservers();
    void prepareTimeline(true);
    requestTimelineRefresh();
    scheduleFormulaCopyEnhancement();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
