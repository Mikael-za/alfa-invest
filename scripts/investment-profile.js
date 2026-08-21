(function () {
  "use strict";

  const SCHEMA_VERSION = "1.0";
  const STORAGE_KEY = "alfa-investment-profile";
  const NONE_OPTION = "none";

  const sections = [
    {
      id: "experience",
      title: "Опыт",
      intro: {
        title: "Счёт открыт — поздравляем!",
        text: "Пара вопросов — и Дзынь будет учитывать твой опыт и объяснять инвестиции понятнее."
      },
      questions: [
        {
          id: "q1",
          type: "single",
          title: "Что из этого больше похоже на тебя?",
          hint: "Выбери один вариант",
          options: [
            { id: "starting", label: "Только начинаю разбираться", score: 0 },
            { id: "studied", label: "Уже изучал инвестиции", score: 1 },
            { id: "tried", label: "Пробовал инвестировать", score: 2 },
            { id: "sometimes", label: "Инвестирую время от времени", score: 3 },
            { id: "regularly", label: "Инвестирую регулярно", score: 4 }
          ]
        },
        {
          id: "q2",
          type: "multiple",
          title: "С чем ты уже знаком?",
          hint: "Можно выбрать несколько вариантов",
          options: [
            { id: "stocks", label: "Акции" },
            { id: "bonds", label: "Облигации" },
            { id: "funds", label: "Фонды" },
            { id: "dividends", label: "Дивиденды" },
            { id: "risk_return", label: "Риск и доходность" },
            { id: NONE_OPTION, label: "Пока ни с чем" }
          ]
        }
      ]
    },
    {
      id: "decisions",
      title: "Как ты принимаешь решения",
      questions: [
        {
          id: "q3",
          type: "single",
          title: "Инвестиция временно снизилась в цене. Что ты скорее сделаешь?",
          hint: "Выбери один вариант",
          options: [
            { id: "sell", label: "Сразу продам", score: 0 },
            { id: "wait", label: "Подожду и ничего не буду менять", score: 1 },
            { id: "check", label: "Посмотрю, что произошло", score: 2 },
            { id: "understand", label: "Разберусь в причинах и рисках", score: 3 },
            { id: "analyze", label: "Проанализирую ситуацию и решу, нужно ли менять стратегию", score: 4 }
          ]
        },
        {
          id: "q4",
          type: "single",
          title: "Когда выбираешь инвестицию, на что обычно смотришь?",
          hint: "Выбери один вариант",
          options: [
            { id: "profit", label: "Сколько можно заработать", score: 0 },
            { id: "safety", label: "Насколько это безопасно", score: 1 },
            { id: "return_risk", label: "Доходность и риск", score: 2 },
            { id: "return_risk_term", label: "Доходность, риск и срок", score: 3 },
            { id: "factors", label: "Компания, рынок и другие факторы", score: 4 }
          ]
        }
      ]
    },
    {
      id: "personalization",
      title: "Персонализация",
      questions: [
        {
          id: "q5",
          type: "single",
          title: "Как ты обычно решаешь, что выбрать?",
          hint: "Выбери один вариант",
          options: [
            { id: "advice", label: "Ориентируюсь на совет", score: 0 },
            { id: "others", label: "Смотрю, что выбирают другие", score: 1 },
            { id: "study", label: "Сначала изучаю вариант", score: 2 },
            { id: "compare", label: "Сравниваю несколько вариантов", score: 3 },
            { id: "independent", label: "Сам анализирую и принимаю решение", score: 4 }
          ]
        },
        {
          id: "q6",
          type: "multiple",
          maxSelections: 2,
          title: "Что тебе сейчас полезнее всего?",
          hint: "Можно выбрать до двух вариантов",
          options: [
            { id: "basics", label: "Понять основы" },
            { id: "small_amount", label: "Начать с небольшой суммы" },
            { id: "choose", label: "Научиться выбирать инвестиции" },
            { id: "risks", label: "Лучше разобраться в рисках" },
            { id: "market", label: "Научиться анализировать рынок" }
          ]
        }
      ]
    }
  ];

  const resultContent = {
    beginner: {
      level: "Начинающий",
      displayLevel: "Только начинаю"
    },
    amateur: {
      level: "Любитель",
      displayLevel: "Уже немного разбираюсь"
    },
    master: {
      level: "Мастер",
      displayLevel: "Уверенно инвестирую"
    }
  };

  const state = {
    currentSection: 0,
    answers: {
      q1: null,
      q2: [],
      q3: null,
      q4: null,
      q5: null,
      q6: []
    },
    confirmation: null,
    completedAt: null
  };

  const app = document.getElementById("investment-profile-app");
  const content = app.querySelector(".profile-content");
  const screen = document.getElementById("questionnaire-screen");
  const cta = document.getElementById("questionnaire-cta");
  const backButton = app.querySelector('[data-action="back"]');
  const progress = app.querySelector(".profile-progress");
  const progressLabel = app.querySelector(".profile-progress__label");
  const progressBar = app.querySelector(".profile-progress__track");
  const progressValue = app.querySelector(".profile-progress__value");

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getQuestion(questionId) {
    return sections.flatMap((section) => section.questions).find((question) => question.id === questionId);
  }

  function optionMarkup(question, option) {
    const answer = state.answers[question.id];
    const selected = question.type === "single"
      ? answer === option.id
      : answer.includes(option.id);
    const selectionLimitReached = question.type === "multiple"
      && question.maxSelections
      && answer.length >= question.maxSelections;
    const disabled = Boolean(selectionLimitReached && !selected);
    const inputType = question.type === "single" ? "radio" : "checkbox";

    return `
      <label class="choice-row choice-row--${inputType}${selected ? " is-selected" : ""}${disabled ? " is-disabled" : ""}">
        <input
          class="choice-row__input"
          type="${inputType}"
          name="${escapeHtml(question.id)}"
          value="${escapeHtml(option.id)}"
          ${selected ? "checked" : ""}
          ${disabled ? "disabled" : ""}
        >
        <span class="choice-row__control" aria-hidden="true"></span>
        <span class="choice-row__text">${escapeHtml(option.label)}</span>
      </label>`;
  }

  function questionMarkup(question) {
    return `
      <fieldset class="question-group" data-question-id="${escapeHtml(question.id)}">
        <legend class="question-group__title">${escapeHtml(question.title)}</legend>
        ${question.hint ? `<p class="question-group__hint">${escapeHtml(question.hint)}</p>` : ""}
        <div class="choice-group">
          ${question.options.map((option) => optionMarkup(question, option)).join("")}
        </div>
      </fieldset>`;
  }

  function isQuestionAnswered(question) {
    const answer = state.answers[question.id];
    return question.type === "single" ? answer !== null : answer.length > 0;
  }

  function isSectionComplete(section = sections[state.currentSection]) {
    return section.questions.every(isQuestionAnswered);
  }

  function updateChrome() {
    const step = state.currentSection + 1;
    const percent = `${(step / sections.length) * 100}%`;
    progressLabel.textContent = `${step} из ${sections.length}`;
    progressBar.setAttribute("aria-valuenow", String(step));
    progressValue.style.width = percent;
    backButton.disabled = state.currentSection === 0;
  }

  function updateCta() {
    const button = cta.querySelector('[data-action="next"]');
    button.disabled = !isSectionComplete();
    button.textContent = state.currentSection === sections.length - 1 ? "Узнать результат" : "Далее";
  }

  function renderSection(options = {}) {
    const section = sections[state.currentSection];
    app.classList.remove("is-result");
    progress.hidden = false;
    screen.innerHTML = `
      <section class="profile-stage${section.intro ? " profile-stage--with-intro" : ""}" aria-labelledby="stage-title">
        ${section.intro ? `
          <div class="profile-stage__intro">
            <p class="profile-stage__intro-title">${escapeHtml(section.intro.title)}</p>
            <p class="profile-stage__intro-text">${escapeHtml(section.intro.text)}</p>
          </div>` : ""}
        <h1 class="profile-stage__title" id="stage-title">${escapeHtml(section.title)}</h1>
        ${section.questions.map(questionMarkup).join("")}
      </section>`;
    updateChrome();
    updateCta();

    if (options.scroll !== false) {
      content.scrollTop = 0;
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }

  function handleSingleAnswer(questionId, value) {
    state.answers[questionId] = value;
  }

  function handleMultipleAnswer(question, value, checked) {
    let selected = state.answers[question.id];

    if (question.id === "q2") {
      if (value === NONE_OPTION && checked) {
        selected = [NONE_OPTION];
      } else if (checked) {
        selected = selected.filter((id) => id !== NONE_OPTION);
        selected.push(value);
      } else {
        selected = selected.filter((id) => id !== value);
      }
    } else if (checked && (!question.maxSelections || selected.length < question.maxSelections)) {
      selected = [...selected, value];
    } else if (!checked) {
      selected = selected.filter((id) => id !== value);
    }

    state.answers[question.id] = [...new Set(selected)];
  }

  function scoreFor(questionId) {
    const question = getQuestion(questionId);
    const option = question.options.find((item) => item.id === state.answers[questionId]);
    return option.score;
  }

  function q2Score() {
    const knownItems = state.answers.q2.filter((id) => id !== NONE_OPTION).length;
    if (knownItems === 0) return 0;
    if (knownItems === 1) return 1;
    if (knownItems === 2) return 2;
    if (knownItems <= 4) return 3;
    return 4;
  }

  function calculateProfile() {
    const experience = scoreFor("q1");
    const risk = (q2Score() + scoreFor("q3")) / 2;
    const thinking = scoreFor("q4");
    const independence = scoreFor("q5");
    const score = experience * 0.25 + risk * 0.25 + thinking * 0.30 + independence * 0.20;
    const allMetricsHigh = [experience, risk, thinking, independence].every((metric) => metric >= 3);

    let key = "amateur";
    if (experience < 1.5 || thinking < 1.5 || score < 1.5) {
      key = "beginner";
    } else if (allMetricsHigh) {
      key = "master";
    }

    return {
      key,
      level: resultContent[key].level,
      score: Number(score.toFixed(3)),
      metrics: {
        experience,
        risk,
        thinking,
        independence
      }
    };
  }

  function answerPayload(question) {
    const value = state.answers[question.id];
    const values = Array.isArray(value) ? value : [value];
    const selectedOptions = values.map((id) => question.options.find((option) => option.id === id));

    return {
      questionId: question.id,
      value,
      labels: selectedOptions.map((option) => option.label)
    };
  }

  function buildPayload() {
    const profile = calculateProfile();
    return {
      schemaVersion: SCHEMA_VERSION,
      completedAt: state.completedAt,
      answers: sections.flatMap((section) => section.questions.map(answerPayload)),
      profile: {
        calculatedLevel: profile.level,
        calculatedLevelCode: profile.key,
        score: profile.score,
        metrics: profile.metrics
      },
      personalization: {
        goals: [...state.answers.q6]
      },
      feedback: {
        confirmed: state.confirmation
      }
    };
  }

  async function persistProfile() {
    state.completedAt = new Date().toISOString();
    const payload = buildPayload();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent("investment-profile:completed", { detail: payload }));

    const submitUrl = app.dataset.submitUrl.trim();
    if (submitUrl) {
      const response = await fetch(submitUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error(`Profile submit failed: ${response.status}`);
    }

    return payload;
  }

  function selectedGoalLabels() {
    const question = getQuestion("q6");
    return state.answers.q6.map((goalId) => {
      return question.options.find((option) => option.id === goalId).label;
    });
  }

  function renderResult() {
    const profile = calculateProfile();
    const content = resultContent[profile.key];
    const goalLabels = selectedGoalLabels();
    app.classList.add("is-result");
    backButton.disabled = false;
    progress.hidden = true;
    screen.innerHTML = `
      <section class="result-screen" aria-labelledby="result-title">
        <h1 class="result-screen__title" id="result-title">Вот что мы поняли о тебе</h1>
        <p class="result-screen__description">Проверь, всё ли верно — так Дзынь сможет объяснять инвестиции на подходящем тебе уровне.</p>

        <div class="result-profile-card" aria-label="Результаты анкеты">
          <dl class="result-details">
            <div class="result-detail">
              <dt>Уровень</dt>
              <dd>${escapeHtml(content.displayLevel)}</dd>
            </div>
            <div class="result-detail">
              <dt>Сейчас важнее всего</dt>
              <dd class="result-detail__values">
                ${goalLabels.map((label) => `<span>${escapeHtml(label)}</span>`).join("")}
              </dd>
            </div>
          </dl>
        </div>

        <div class="result-confirmation">
          <h2>Всё верно?</h2>
          <div class="result-confirmation__actions">
            <button class="primary-button" type="button" data-confirm="yes">Да, продолжить</button>
            <button class="secondary-button" type="button" data-confirm="edit">Изменить ответы</button>
          </div>
        </div>
      </section>`;
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  async function completeProfile() {
    const confirmButton = screen.querySelector('[data-confirm="yes"]');
    if (confirmButton) confirmButton.disabled = true;

    try {
      await persistProfile();
      const successUrl = app.dataset.successUrl.trim() || "index.html";
      if (window.alfaNavigation?.go) {
        window.alfaNavigation.go(successUrl, { replace: true });
      } else {
        window.location.replace(successUrl);
      }
    } catch (error) {
      console.error(error);
      state.completedAt = null;
      if (confirmButton) confirmButton.disabled = false;
      const confirmation = screen.querySelector(".result-confirmation");
      if (confirmation) {
        confirmation.insertAdjacentHTML("beforeend", '<p class="question-group__hint" role="alert">Не удалось сохранить профиль. Попробуй ещё раз.</p>');
      }
    }
  }

  screen.addEventListener("change", (event) => {
    const input = event.target.closest(".choice-row__input");
    if (!input) return;

    const question = getQuestion(input.name);
    if (!question) return;

    if (question.type === "single") {
      handleSingleAnswer(question.id, input.value);
    } else {
      handleMultipleAnswer(question, input.value, input.checked);
    }

    renderSection({ scroll: false });
  });

  screen.addEventListener("click", (event) => {
    const confirmationButton = event.target.closest("[data-confirm]");
    if (!confirmationButton) return;

    if (confirmationButton.dataset.confirm === "yes") {
      state.confirmation = true;
      completeProfile();
    } else if (confirmationButton.dataset.confirm === "edit") {
      state.confirmation = null;
      state.completedAt = null;
      state.currentSection = sections.length - 1;
      renderSection();
    }
  });

  cta.addEventListener("click", (event) => {
    const nextButton = event.target.closest('[data-action="next"]');
    if (!nextButton || nextButton.disabled || !isSectionComplete()) return;

    if (state.currentSection < sections.length - 1) {
      state.currentSection += 1;
      renderSection();
    } else {
      renderResult();
    }
  });

  backButton.addEventListener("click", () => {
    if (app.classList.contains("is-result")) {
      state.confirmation = null;
      state.completedAt = null;
      state.currentSection = sections.length - 1;
      renderSection();
      return;
    }

    if (state.currentSection > 0) {
      state.currentSection -= 1;
      renderSection();
      return;
    }

  });

  window.investmentProfileQuestionnaire = Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    getPayload: buildPayload,
    calculateProfile,
    storageKey: STORAGE_KEY
  });

  renderSection();
})();
