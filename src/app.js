import { createBlankTest, createPassage, createQuestion, QUESTION_TYPES } from "./schema.js";
import { $, $all, readFileAsDataUrl } from "./utils.js";
import { saveTestFile, loadTestFromFile } from "./storage.js";
import { exportPdf } from "./pdf-export.js";
import { renderPassages, renderPreview, renderQuestions } from "./ui.js";

let test = createBlankTest();
let activeTab = "questions";

const els = {};

function init() {
  cacheElements();
  bindEvents();
  hydrateForm();
  renderAll();
  setupSortable();
}

function cacheElements() {
  [
    "newTestBtn", "importTestInput", "saveTestBtn", "exportStudentBtn", "exportTeacherBtn", "exportKeyBtn",
    "testTitle", "courseName", "teacherName", "testDate", "headerText", "footerText", "includePageNumbers", "showPoints",
    "coverPdfInput", "coverStatus", "addMcqBtn", "addSaqBtn", "addDbqBtn", "addPassageBtn", "addPassageTopBtn",
    "questionList", "passageList", "previewMode", "passageDialog", "passageForm", "passageId", "passageName", "passageType",
    "passageText", "passageFile", "passageTextWrap", "passageFileWrap", "savePassageModalBtn", "passageModalTitle"
  ].forEach(id => els[id] = document.getElementById(id));
}

function bindEvents() {
  els.newTestBtn.addEventListener("click", () => {
    if (confirm("Start a new test? Unsaved work will be lost.")) {
      test = createBlankTest();
      hydrateForm();
      renderAll();
    }
  });

  els.saveTestBtn.addEventListener("click", () => {
    syncFormToState();
    saveTestFile(test);
  });

  els.importTestInput.addEventListener("change", async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      test = await loadTestFromFile(file);
      hydrateForm();
      renderAll();
    } catch (error) {
      alert("That file could not be opened. Make sure it is a valid .testmaker or JSON file.");
      console.error(error);
    } finally {
      e.target.value = "";
    }
  });

  els.exportStudentBtn.addEventListener("click", () => exportCurrent("student"));
  els.exportTeacherBtn.addEventListener("click", () => exportCurrent("teacher"));
  els.exportKeyBtn.addEventListener("click", () => exportCurrent("key"));

  ["testTitle", "courseName", "teacherName", "testDate", "headerText", "footerText", "includePageNumbers", "showPoints"].forEach(id => {
    els[id].addEventListener("input", () => { syncFormToState(); renderPreview(test, els.previewMode.value); });
    els[id].addEventListener("change", () => { syncFormToState(); renderPreview(test, els.previewMode.value); });
  });

  els.coverPdfInput.addEventListener("change", async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    test.coverPdf = { name: file.name, type: file.type, dataUrl: await readFileAsDataUrl(file) };
    els.coverStatus.textContent = file.name;
  });

  els.addMcqBtn.addEventListener("click", () => addQuestion(QUESTION_TYPES.MCQ));
  els.addSaqBtn.addEventListener("click", () => addQuestion(QUESTION_TYPES.SAQ));
  els.addDbqBtn.addEventListener("click", () => addQuestion(QUESTION_TYPES.DBQ));
  els.addPassageBtn.addEventListener("click", () => openPassageDialog());
  els.addPassageTopBtn.addEventListener("click", () => openPassageDialog());

  $all(".tab").forEach(tab => tab.addEventListener("click", () => setTab(tab.dataset.tab)));
  els.previewMode.addEventListener("change", () => renderPreview(test, els.previewMode.value));
  els.passageType.addEventListener("change", updatePassageDialogInputs);
  els.passageForm.addEventListener("submit", savePassageFromDialog);
}

function hydrateForm() {
  const info = test.testInfo;
  els.testTitle.value = info.title || "";
  els.courseName.value = info.course || "";
  els.teacherName.value = info.teacher || "";
  els.testDate.value = info.date || "";
  els.headerText.value = info.headerText || "";
  els.footerText.value = info.footerText || "";
  els.includePageNumbers.checked = Boolean(info.includePageNumbers);
  els.showPoints.checked = Boolean(info.showPoints);
  els.coverStatus.textContent = test.coverPdf?.name || "No cover selected";
}

function syncFormToState() {
  test.testInfo = {
    ...test.testInfo,
    title: els.testTitle.value,
    course: els.courseName.value,
    teacher: els.teacherName.value,
    date: els.testDate.value,
    headerText: els.headerText.value,
    footerText: els.footerText.value,
    includePageNumbers: els.includePageNumbers.checked,
    showPoints: els.showPoints.checked
  };
}

function setTab(tabName) {
  activeTab = tabName;
  $all(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === tabName));
  $all(".tab-page").forEach(page => page.classList.remove("active"));
  $(`#${tabName}Tab`).classList.add("active");
  if (tabName === "preview") renderPreview(test, els.previewMode.value);
}

function addQuestion(type) {
  test.questions.push(createQuestion(type));
  renderAll();
  setTab("questions");
}

function renderAll() {
  renderQuestions(test, {
    onAction: handleQuestionAction,
    onQuestionInput: handleQuestionInput
  });
  renderPassages(test, { onPassageAction: handlePassageAction });
  renderPreview(test, els.previewMode.value);
}

function setupSortable() {
  new Sortable(els.questionList, {
    handle: ".drag-handle",
    animation: 150,
    onEnd: () => {
      const order = $all(".question-card", els.questionList).map(card => card.dataset.id);
      test.questions.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
      renderAll();
    }
  });
}

function handleQuestionAction(action, questionId, extra) {
  const q = test.questions.find(item => item.id === questionId);
  if (!q) return;

  if (action === "delete") test.questions = test.questions.filter(item => item.id !== questionId);
  if (action === "duplicate") test.questions.splice(test.questions.indexOf(q) + 1, 0, JSON.parse(JSON.stringify({ ...q, id: crypto.randomUUID() })));
  if (action === "addChoice") q.choices.push({ id: crypto.randomUUID(), text: "", correct: false });
  if (action === "removeChoice") q.choices = q.choices.filter(choice => choice.id !== extra);
  if (action === "addSubQuestion") q.subQuestions.push({ id: crypto.randomUUID(), prompt: "", responseLines: 6, sampleAnswer: "", rubric: "", points: 1 });
  if (action === "removeSubQuestion") q.subQuestions = q.subQuestions.filter(s => s.id !== extra);

  renderAll();
}

function handleQuestionInput(el) {
  const card = el.closest(".question-card");
  const q = test.questions.find(item => item.id === card?.dataset.id);
  if (!q) return;
  const field = el.dataset.field;

  if (["title", "prompt", "explanation", "sampleAnswer", "rubric", "notes"].includes(field)) q[field] = el.value;
  if (["points", "responseLines"].includes(field)) q[field] = Number(el.value);
  if (field === "linkedPassages") {
    const selected = [...el.selectedOptions].map(o => o.value);
    q.passageIds = selected;
    if (q.type === QUESTION_TYPES.DBQ) q.documentIds = selected;
  }
  if (field === "choiceText") q.choices.find(c => c.id === el.dataset.choiceId).text = el.value;
  if (field === "choiceCorrect") q.choices.find(c => c.id === el.dataset.choiceId).correct = el.checked;

  const subId = el.dataset.subId;
  if (subId) {
    const sub = q.subQuestions.find(s => s.id === subId);
    if (!sub) return;
    const map = {
      subPrompt: "prompt",
      subPoints: "points",
      subResponseLines: "responseLines",
      subSampleAnswer: "sampleAnswer",
      subRubric: "rubric"
    };
    sub[map[field]] = ["subPoints", "subResponseLines"].includes(field) ? Number(el.value) : el.value;
  }

  renderPreview(test, els.previewMode.value);
}

function openPassageDialog(passage = null) {
  els.passageModalTitle.textContent = passage ? "Edit Passage" : "Add Passage";
  els.passageId.value = passage?.id || "";
  els.passageName.value = passage?.name || "";
  els.passageType.value = passage?.type || "text";
  els.passageText.value = passage?.content || "";
  els.passageFile.value = "";
  updatePassageDialogInputs();
  els.passageDialog.showModal();
}

function updatePassageDialogInputs() {
  const type = els.passageType.value;
  const usesText = type === "text" || type === "table";
  els.passageTextWrap.style.display = usesText ? "grid" : "none";
  els.passageFileWrap.style.display = usesText ? "none" : "grid";
}

async function savePassageFromDialog(event) {
  event.preventDefault();
  const id = els.passageId.value;
  const existing = test.passages.find(p => p.id === id);
  const file = els.passageFile.files?.[0];
  const fileData = file ? { name: file.name, type: file.type, dataUrl: await readFileAsDataUrl(file) } : existing?.file || null;

  const data = {
    name: els.passageName.value,
    type: els.passageType.value,
    content: els.passageText.value,
    file: fileData
  };

  if (existing) Object.assign(existing, data);
  else test.passages.push(createPassage(data));

  els.passageDialog.close();
  renderAll();
}

function handlePassageAction(action, id) {
  const passage = test.passages.find(p => p.id === id);
  if (!passage) return;
  if (action === "editPassage") openPassageDialog(passage);
  if (action === "deletePassage") {
    test.passages = test.passages.filter(p => p.id !== id);
    test.questions.forEach(q => {
      q.passageIds = (q.passageIds || []).filter(pid => pid !== id);
      q.documentIds = (q.documentIds || []).filter(pid => pid !== id);
    });
    renderAll();
  }
}

async function exportCurrent(mode) {
  syncFormToState();
  try {
    await exportPdf(test, mode);
  } catch (error) {
    console.error(error);
    alert("PDF export failed. Check the console for details.");
  }
}

document.addEventListener("DOMContentLoaded", init);
