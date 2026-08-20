(function () {
  "use strict";

  const STORAGE_KEY = "alfa-dzyn-history-v2";
  const LEGACY_HISTORY_KEYS = ["alfa-dzyn-history-v1"];
  const PROFILE_STORAGE_KEY = "alfa-investment-profile";
  const MAX_MESSAGE_LENGTH = 700;
  const MAX_SUGGESTED_QUESTIONS = 2;
  const INITIAL_QUESTIONS = [
    "Почему сегодня могут падать акции?",
    "Чем облигации отличаются от вклада?",
    "Что означает ключевая ставка?"
  ];

  const app = document.getElementById("dzyn-app");
  const thread = document.getElementById("dzyn-thread");
  const form = document.getElementById("composer-form");
  const input = document.getElementById("chat-input");
  const sendButton = form.querySelector(".composer-send");
  const hint = document.getElementById("composer-hint");
  const configuredChatEndpoint = app.dataset.chatEndpoint.trim() || "api/chat";
  const isLocalDevelopment = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const chatEndpoint = isLocalDevelopment ? "api/chat" : configuredChatEndpoint;

  try {
    LEGACY_HISTORY_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    console.warn("Legacy Dzyn history could not be cleared", error);
  }

  const state = {
    messages: loadHistory(),
    busy: false,
    retryText: "",
    pendingSession: false
  };

  function loadHistory() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      const filtered = Array.isArray(saved) ? saved.map(normalizeStoredMessage).filter(Boolean) : [];
      const cleaned = removeEmptySessions(filtered).slice(-80);

      if (Array.isArray(saved) && JSON.stringify(cleaned) !== JSON.stringify(saved)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
      }

      return cleaned;
    } catch (error) {
      console.warn("Dzyn history could not be read", error);
      return [];
    }
  }

  function normalizeStoredMessage(message) {
    if (!message || !["user", "assistant", "divider"].includes(message.role)) return null;
    const content = typeof message.content === "string" ? message.content.trim() : "";
    if (message.role !== "divider" && !content) return null;

    const normalized = {
      role: message.role,
      content: (content || "Новая сессия").slice(0, 8_000)
    };
    if (message.role !== "assistant") return normalized;

    const sources = Array.isArray(message.sources) ? message.sources.flatMap((source) => {
      if (!source || typeof source.url !== "string") return [];
      try {
        const url = new URL(source.url);
        if (!["http:", "https:"].includes(url.protocol)) return [];
        return [{
          name: String(source.name || url.hostname).slice(0, 120),
          title: String(source.title || source.name || url.hostname).slice(0, 240),
          date: typeof source.date === "string" ? source.date.slice(0, 80) : undefined,
          url: url.toString()
        }];
      } catch (error) {
        return [];
      }
    }).slice(0, 6) : [];
    const followUps = Array.isArray(message.followUps)
      ? message.followUps.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim().slice(0, 120)).slice(0, 3)
      : [];
    if (sources.length) normalized.sources = sources;
    if (followUps.length) normalized.followUps = followUps;
    return normalized;
  }

  function removeEmptySessions(messages) {
    const cleaned = [];
    let segment = [];
    let isSessionSegment = false;

    function flushSegment() {
      const hasUserQuestion = segment.some((message) => message.role === "user");
      if (!isSessionSegment || hasUserQuestion) cleaned.push(...segment);
    }

    messages.forEach((message) => {
      if (message.role === "divider") {
        flushSegment();
        segment = [message];
        isSessionSegment = true;
        return;
      }

      segment.push(message);
    });

    flushSegment();
    return cleaned;
  }

  function saveHistory() {
    const persisted = state.messages.filter((message) => !message.transient).slice(-80);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
    } catch (error) {
      console.warn("Dzyn history could not be saved", error);
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatAssistantText(value) {
    const safe = escapeHtml(value).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    const blocks = safe.split(/\n{2,}/).filter(Boolean);

    return blocks.map((block) => {
      const lines = block.split("\n");
      if (lines.every((line) => /^[-•] /.test(line))) {
        return `<ul>${lines.map((line) => `<li>${line.replace(/^[-•] /, "")}</li>`).join("")}</ul>`;
      }
      if (lines.length === 1 && /^#{2,3} /.test(lines[0])) {
        return `<h3>${lines[0].replace(/^#{2,3} /, "")}</h3>`;
      }
      return `<p>${lines.join("<br>")}</p>`;
    }).join("");
  }

  function avatarMarkup(className = "") {
    return `<img class="dzyn-avatar ${className}" src="assets/dzyn-mascot.png" alt="">`;
  }

  function assistantHeadingMarkup() {
    return `<div class="assistant-heading">${avatarMarkup()}<strong>Дзынь</strong></div>`;
  }

  function questionListMarkup(questions, compact = false) {
    return `
      <section class="suggested-questions${compact ? " session-suggestions" : ""}" aria-label="Предложенные вопросы">
        ${compact ? "" : "<h3>О чем хочешь узнать?</h3>"}
        <div class="suggested-questions__list">
          ${questions.slice(0, MAX_SUGGESTED_QUESTIONS).map((question) => `
            <button class="suggestion-button" type="button" data-question="${escapeHtml(question)}">
              <span>${escapeHtml(question)}</span>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg>
            </button>`).join("")}
        </div>
      </section>`;
  }

  function welcomeMarkup() {
    return `
      <section class="welcome-state" id="welcome-state">
        ${avatarMarkup("welcome-state__mascot")}
        <h2>Привет, я Дзынь</h2>
        <p>Твой AI-помощник по инвестициям. Могу объяснить термин, разобрать новость или помочь понять, что происходит на рынке.</p>
        ${questionListMarkup(INITIAL_QUESTIONS)}
      </section>`;
  }

  function sourcesMarkup(sources) {
    if (!Array.isArray(sources) || sources.length === 0) return "";

    return `
      <details class="sources">
        <summary>Источники · ${sources.length}</summary>
        <div class="sources__list">
          ${sources.map((source) => `
            <a class="source-link" href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">
              <strong>${escapeHtml(source.name)}</strong>
              <span>${escapeHtml(source.title)}${source.date ? ` · ${escapeHtml(source.date)}` : ""}</span>
            </a>`).join("")}
        </div>
      </details>`;
  }

  function followUpsMarkup(followUps) {
    if (!Array.isArray(followUps) || followUps.length === 0) return "";

    return `
      <div class="follow-ups-block">
        <p class="follow-ups-label">Что еще можно спросить</p>
        <div class="follow-ups" aria-label="Уточняющие вопросы">
          ${followUps.slice(0, MAX_SUGGESTED_QUESTIONS).map((question) => `
            <button class="follow-up-button" type="button" data-question="${escapeHtml(question)}">${escapeHtml(question)}</button>`).join("")}
        </div>
      </div>`;
  }

  function messageMarkup(message, showFollowUps = false) {
    if (message.role === "divider") {
      return `<div class="session-divider"><span>${escapeHtml(message.content || "Новая сессия")}</span></div>`;
    }

    if (message.role === "user") {
      return `<article class="message message--user"><p>${escapeHtml(message.content)}</p></article>`;
    }

    const retry = message.error
      ? `<button class="retry-button" type="button" data-retry="${escapeHtml(message.retryText || "")}">Повторить</button>`
      : "";

    return `
      <article class="message message--assistant${message.loading ? " is-loading" : ""}">
        ${assistantHeadingMarkup()}
        <div class="assistant-copy${message.loading ? " loading-copy" : ""}">
          ${message.loading ? "Дзынь думает" : formatAssistantText(message.content)}
        </div>
        ${message.loading ? "" : sourcesMarkup(message.sources)}
        ${message.loading || !showFollowUps ? "" : followUpsMarkup(message.followUps)}
        ${retry}
      </article>`;
  }

  function render() {
    if (state.messages.length === 0) {
      thread.innerHTML = welcomeMarkup();
      return;
    }

    const lastAssistantIndex = state.messages.findLastIndex((message) => message.role === "assistant");
    thread.innerHTML = state.messages
      .map((message, index) => messageMarkup(message, index === lastAssistantIndex))
      .join("");
  }

  function scrollToBottom(behavior = "smooth") {
    requestAnimationFrame(() => {
      thread.scrollTo({ top: thread.scrollHeight, behavior });
    });
  }

  function pushMessage(message, options = {}) {
    state.messages.push({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      ...message
    });
    if (options.save !== false) saveHistory();
    render();
    scrollToBottom(options.behavior || "smooth");
  }

  function commitPendingSession() {
    if (!state.pendingSession) return;

    state.messages.push(
      { role: "divider", content: "Новая сессия" },
      { role: "assistant", content: "Снова привет 👋 О чем поговорим?" }
    );
    state.pendingSession = false;
  }

  function removeLoading() {
    const index = state.messages.findIndex((message) => message.loading);
    if (index >= 0) state.messages.splice(index, 1);
  }

  function getInvestmentProfile() {
    try {
      const stored = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY));
      if (!stored || typeof stored !== "object" || Array.isArray(stored)) return null;
      return {
        profile: {
          calculatedLevelCode: stored.profile?.calculatedLevelCode,
          metrics: stored.profile?.metrics
        },
        personalization: {
          goals: stored.personalization?.goals
        }
      };
    } catch (error) {
      console.warn("Investment profile could not be read", error);
      return null;
    }
  }

  function apiHistory() {
    return state.messages
      .filter((message) => ["user", "assistant"].includes(message.role) && !message.error && !message.loading)
      .slice(-14)
      .map(({ role, content }) => ({ role, content }));
  }

  async function requestAnswer(text) {
    const history = apiHistory();
    const lastMessage = history.at(-1);
    if (lastMessage?.role === "user" && lastMessage.content === text) history.pop();

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 120_000);
    let response;
    try {
      response = await fetch(chatEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history,
          profile: getInvestmentProfile()
        }),
        signal: controller.signal
      });
    } finally {
      window.clearTimeout(timeoutId);
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || "Не получилось ответить. Попробуй еще раз.");
      error.userFacing = true;
      throw error;
    }
    if (typeof payload.answer !== "string" || !payload.answer.trim()) {
      throw new Error("Chat returned an invalid answer");
    }
    return payload;
  }

  async function sendQuestion(rawText, options = {}) {
    const text = String(rawText || "").trim();
    if (!text || state.busy) return;

    if (text.length > MAX_MESSAGE_LENGTH) {
      hint.textContent = `Сделай вопрос немного короче — до ${MAX_MESSAGE_LENGTH} символов.`;
      updateComposer();
      return;
    }

    state.busy = true;
    state.retryText = text;
    hint.textContent = "";
    input.value = "";
    resizeInput();
    updateComposer();

    if (!options.retry) {
      commitPendingSession();
      pushMessage({ role: "user", content: text }, { behavior: "auto" });
    } else {
      const errorIndex = state.messages.findIndex((message) => message.error);
      if (errorIndex >= 0) state.messages.splice(errorIndex, 1);
    }

    pushMessage({ role: "assistant", content: "", loading: true, transient: true }, { save: false });

    try {
      const payload = await requestAnswer(text);
      removeLoading();
      state.messages.forEach((message) => {
        if (message.followUps) delete message.followUps;
      });
      pushMessage({
        role: "assistant",
        content: payload.answer,
        sources: payload.sources || [],
        followUps: (payload.followUps || []).slice(0, 3)
      });
    } catch (error) {
      console.error(error);
      removeLoading();
      const errorMessage = error?.name === "AbortError"
        ? "Ответ занимает слишком много времени. Попробуй еще раз."
        : error?.userFacing
          ? error.message
          : "Не получилось ответить. Попробуй еще раз.";
      pushMessage({
        role: "assistant",
        content: errorMessage,
        error: true,
        retryText: text
      }, { save: false });
    } finally {
      state.busy = false;
      updateComposer();
      input.focus({ preventScroll: true });
    }
  }

  function resizeInput() {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 112)}px`;
  }

  function updateComposer() {
    const length = input.value.trim().length;
    const tooLong = length > MAX_MESSAGE_LENGTH;
    sendButton.disabled = state.busy || length === 0 || tooLong;
    input.disabled = state.busy;

    if (tooLong) {
      hint.textContent = `Сделай вопрос немного короче — до ${MAX_MESSAGE_LENGTH} символов.`;
    } else if (length > 620) {
      hint.textContent = `${length} из ${MAX_MESSAGE_LENGTH}`;
    } else if (hint.textContent.includes("из 700") || hint.textContent.includes("немного короче")) {
      hint.textContent = "";
    }
  }

  function syncViewport() {
    const viewport = window.visualViewport;
    const height = viewport ? viewport.height : window.innerHeight;
    app.style.setProperty("--dzyn-viewport-height", `${Math.round(height)}px`);
    if (document.activeElement === input) scrollToBottom("auto");
  }

  function startSession() {
    if (state.messages.length === 0) {
      render();
      return;
    }

    state.pendingSession = true;
    render();
    thread.insertAdjacentHTML(
      "beforeend",
      `${messageMarkup({ role: "divider", content: "Новая сессия" })}
       ${messageMarkup({ role: "assistant", content: "Снова привет 👋 О чем поговорим?" })}
       ${questionListMarkup(INITIAL_QUESTIONS, true)}`
    );
    scrollToBottom("auto");
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    sendQuestion(input.value);
  });

  input.addEventListener("input", () => {
    resizeInput();
    updateComposer();
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      sendQuestion(input.value);
    }
  });

  input.addEventListener("focus", () => {
    setTimeout(() => scrollToBottom("smooth"), 50);
  });

  thread.addEventListener("click", (event) => {
    const questionButton = event.target.closest("[data-question]");
    if (questionButton) {
      sendQuestion(questionButton.dataset.question);
      return;
    }

    const retryButton = event.target.closest("[data-retry]");
    if (retryButton) sendQuestion(retryButton.dataset.retry, { retry: true });
  });

  window.visualViewport?.addEventListener("resize", syncViewport);
  window.visualViewport?.addEventListener("scroll", syncViewport);
  window.addEventListener("resize", syncViewport);

  syncViewport();
  startSession();
  updateComposer();
})();
