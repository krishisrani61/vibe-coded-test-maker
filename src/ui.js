import { $, escapeHtml, getChoiceLetter } from "./utils.js";
import { QUESTION_TYPES } from "./schema.js";

export function renderQuestions(test, handlers) {
  const list = $("#questionList");
  list.innerHTML = "";
  $("#questionCount").textContent = `${test.questions.length} question${test.questions.length === 1 ? "" : "s"}`;

  if (!test.questions.length) {
    list.append($("#emptyStateTemplate").content.cloneNode(true));
    return;
  }

  test.questions.forEach((q, index) => {
    const card = document.createElement("article");
    card.className = "question-card";
    card.dataset.id = q.id;
    card.innerHTML = questionCardHtml(q, index, test.passages);
    list.append(card);
  });

  list.querySelectorAll("[data-action]").forEach(btn => {
    btn.addEventListener("click", () => handlers.onAction(btn.dataset.action, btn.closest(".question-card")?.dataset.id, btn.dataset.extra));
  });

  list.querySelectorAll("input, textarea, select").forEach(el => {
    el.addEventListener("input", () => handlers.onQuestionInput(el));
    el.addEventListener("change", () => handlers.onQuestionInput(el));
  });
}

function questionCardHtml(q, index, passages) {
  const passageOptions = passages.map(p => {
    const selected = q.passageIds?.includes(p.id) || q.documentIds?.includes(p.id) ? "selected" : "";
    return `<option value="${p.id}" ${selected}>${escapeHtml(p.name)}</option>`;
  }).join("");

  let body = "";
  if (q.type === QUESTION_TYPES.MCQ) body = mcqHtml(q);
  if (q.type === QUESTION_TYPES.SAQ) body = saqHtml(q);
  if (q.type === QUESTION_TYPES.DBQ) body = dbqHtml(q, passages);

  return `
    <div class="card-top">
      <div class="card-title">
        <span class="drag-handle" title="Drag to reorder">☰</span>
        <h3>Question ${index + 1}</h3>
        <span class="type-pill">${q.type.toUpperCase()}</span>
      </div>
      <div>
        <button class="small ghost" data-action="duplicate">Duplicate</button>
        <button class="small danger" data-action="delete">Delete</button>
      </div>
    </div>
    <div class="grid-2">
      <label>Internal title<input data-field="title" value="${escapeHtml(q.title)}" /></label>
      <label>Points<input data-field="points" type="number" min="0" step="0.5" value="${escapeHtml(q.points)}" /></label>
    </div>
    <label>Question prompt<textarea data-field="prompt" rows="3">${escapeHtml(q.prompt)}</textarea></label>
    <label>Linked passages/documents
      <select data-field="linkedPassages" multiple size="${Math.min(Math.max(passages.length, 3), 7)}">
        ${passageOptions}
      </select>
    </label>
    ${body}
  `;
}

function mcqHtml(q) {
  const choices = q.choices.map((choice, i) => `
    <div class="choice-row" data-choice-id="${choice.id}">
      <div class="choice-letter">${getChoiceLetter(i)}</div>
      <input data-field="choiceText" data-choice-id="${choice.id}" value="${escapeHtml(choice.text)}" placeholder="Answer choice" />
      <label class="inline"><input data-field="choiceCorrect" data-choice-id="${choice.id}" type="checkbox" ${choice.correct ? "checked" : ""} /> Correct</label>
      <button class="small ghost" data-action="removeChoice" data-extra="${choice.id}">×</button>
    </div>
  `).join("");

  return `
    <div class="choices-block">
      <h4>Choices</h4>
      ${choices}
      <button class="small ghost" data-action="addChoice">+ Add choice</button>
    </div>
    <label>Teacher explanation<textarea data-field="explanation" rows="2">${escapeHtml(q.explanation)}</textarea></label>
  `;
}

function saqHtml(q) {
  return `
    <div class="grid-3">
      <label>Response lines<input data-field="responseLines" type="number" min="1" max="30" value="${escapeHtml(q.responseLines)}" /></label>
      <label>Sample answer<textarea data-field="sampleAnswer" rows="2">${escapeHtml(q.sampleAnswer)}</textarea></label>
      <label>Rubric<textarea data-field="rubric" rows="2">${escapeHtml(q.rubric)}</textarea></label>
    </div>
  `;
}

function dbqHtml(q) {
  const sub = q.subQuestions.map((s, i) => `
    <div class="question-card" data-sub-id="${s.id}">
      <div class="card-top">
        <h4>DBQ Sub-question ${i + 1}</h4>
        <button class="small ghost" data-action="removeSubQuestion" data-extra="${s.id}">Remove</button>
      </div>
      <label>Prompt<textarea data-field="subPrompt" data-sub-id="${s.id}" rows="2">${escapeHtml(s.prompt)}</textarea></label>
      <div class="grid-3">
        <label>Points<input data-field="subPoints" data-sub-id="${s.id}" type="number" min="0" step="0.5" value="${escapeHtml(s.points)}" /></label>
        <label>Response lines<input data-field="subResponseLines" data-sub-id="${s.id}" type="number" min="1" max="30" value="${escapeHtml(s.responseLines)}" /></label>
        <label>Sample answer<textarea data-field="subSampleAnswer" data-sub-id="${s.id}" rows="2">${escapeHtml(s.sampleAnswer)}</textarea></label>
      </div>
      <label>Rubric<textarea data-field="subRubric" data-sub-id="${s.id}" rows="2">${escapeHtml(s.rubric)}</textarea></label>
    </div>
  `).join("");

  return `
    <h4>DBQ Questions</h4>
    <div class="card-list">${sub}</div>
    <button class="small ghost" data-action="addSubQuestion">+ Add DBQ sub-question</button>
  `;
}

export function renderPassages(test, handlers) {
  const list = $("#passageList");
  list.innerHTML = "";

  if (!test.passages.length) {
    list.append($("#emptyStateTemplate").content.cloneNode(true));
    return;
  }

  test.passages.forEach(p => {
    const card = document.createElement("article");
    card.className = "passage-card";
    card.dataset.id = p.id;
    const contentPreview = p.type === "text" || p.type === "table"
      ? escapeHtml((p.content || "").slice(0, 240))
      : p.file ? escapeHtml(p.file.name) : "No file attached";
    card.innerHTML = `
      <div class="card-top">
        <div>
          <h3>${escapeHtml(p.name)}</h3>
          <span class="type-pill">${escapeHtml(p.type)}</span>
        </div>
        <div>
          <button class="small ghost" data-action="editPassage">Edit</button>
          <button class="small danger" data-action="deletePassage">Delete</button>
        </div>
      </div>
      <p class="muted">${contentPreview}</p>
    `;
    list.append(card);
  });

  list.querySelectorAll("[data-action]").forEach(btn => {
    btn.addEventListener("click", () => handlers.onPassageAction(btn.dataset.action, btn.closest(".passage-card")?.dataset.id));
  });
}

export function renderPreview(test, mode = "student") {
  const pane = $("#previewPane");
  const info = test.testInfo;
  pane.innerHTML = `
    <h1>${escapeHtml(info.title || "Untitled Test")}</h1>
    <p><strong>Course:</strong> ${escapeHtml(info.course || "")} &nbsp; <strong>Teacher:</strong> ${escapeHtml(info.teacher || "")}</p>
    <p><strong>Date:</strong> ${escapeHtml(info.date || "")}</p>
    ${mode === "key" ? renderAnswerKey(test) : renderFullTest(test, mode)}
  `;
}

function renderFullTest(test, mode) {
  return test.questions.map((q, i) => {
    const linked = (q.passageIds || q.documentIds || [])
      .map(id => test.passages.find(p => p.id === id))
      .filter(Boolean)
      .map(p => `<div class="linked-passage"><strong>${escapeHtml(p.name)}</strong><p>${escapeHtml(p.content || p.file?.name || "")}</p></div>`)
      .join("");

    let answer = "";
    if (q.type === QUESTION_TYPES.MCQ) {
      answer = `<ol type="A">${q.choices.map(c => `<li>${mode === "teacher" && c.correct ? "<strong>◉ " : ""}${escapeHtml(c.text)}${mode === "teacher" && c.correct ? "</strong>" : ""}</li>`).join("")}</ol>`;
    } else if (q.type === QUESTION_TYPES.SAQ) {
      answer = `<div class="answer-space" style="min-height:${Math.max(1, q.responseLines || 6) * 28}px"></div>${mode === "teacher" ? teacherNotes(q) : ""}`;
    } else {
      answer = q.subQuestions.map((s, subIndex) => `
        <div class="preview-question"><strong>${i + 1}.${subIndex + 1}</strong> ${escapeHtml(s.prompt)}
        <div class="answer-space" style="min-height:${Math.max(1, s.responseLines || 6) * 28}px"></div>
        ${mode === "teacher" ? teacherNotes(s) : ""}</div>
      `).join("");
    }

    return `<section class="preview-question"><h3>${i + 1}. ${escapeHtml(q.prompt || q.title)}</h3>${linked}${answer}</section>`;
  }).join("");
}

function teacherNotes(q) {
  return `<div class="teacher-notes"><p><strong>Sample:</strong> ${escapeHtml(q.sampleAnswer || "")}</p><p><strong>Rubric:</strong> ${escapeHtml(q.rubric || "")}</p></div>`;
}

function renderAnswerKey(test) {
  return test.questions.map((q, i) => {
    if (q.type === QUESTION_TYPES.MCQ) {
      const correct = q.choices.map((c, idx) => c.correct ? getChoiceLetter(idx) : null).filter(Boolean).join(", ") || "—";
      return `<p><strong>${i + 1}.</strong> ${correct}</p>`;
    }
    if (q.type === QUESTION_TYPES.SAQ) {
      return `<p><strong>${i + 1}.</strong> ${escapeHtml(q.sampleAnswer || q.rubric || "SAQ response rubric not provided")}</p>`;
    }
    return `<div><strong>${i + 1}. DBQ</strong>${q.subQuestions.map((s, n) => `<p>${i + 1}.${n + 1}: ${escapeHtml(s.sampleAnswer || s.rubric || "No key provided")}</p>`).join("")}</div>`;
  }).join("");
}
