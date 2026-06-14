export const VERSION = "1.0.0";

export const QUESTION_TYPES = {
  MCQ: "mcq",
  SAQ: "saq",
  DBQ: "dbq"
};

export const PASSAGE_TYPES = {
  TEXT: "text",
  IMAGE: "image",
  TABLE: "table",
  PDF: "pdf"
};

export function createBlankTest() {
  return {
    version: VERSION,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    testInfo: {
      title: "Untitled Test",
      course: "",
      teacher: "",
      date: "",
      headerText: "",
      footerText: "",
      includePageNumbers: true,
      showPoints: true
    },
    coverPdf: null,
    passages: [],
    questions: []
  };
}

export function createQuestion(type) {
  const base = {
    id: crypto.randomUUID(),
    type,
    title: "",
    prompt: "",
    passageIds: [],
    points: 1,
    notes: ""
  };

  if (type === QUESTION_TYPES.MCQ) {
    return {
      ...base,
      title: "Multiple Choice Question",
      choices: [
        { id: crypto.randomUUID(), text: "", correct: false },
        { id: crypto.randomUUID(), text: "", correct: false },
        { id: crypto.randomUUID(), text: "", correct: false },
        { id: crypto.randomUUID(), text: "", correct: false }
      ],
      explanation: ""
    };
  }

  if (type === QUESTION_TYPES.SAQ) {
    return {
      ...base,
      title: "Short Answer Question",
      responseLines: 6,
      sampleAnswer: "",
      rubric: ""
    };
  }

  if (type === QUESTION_TYPES.DBQ) {
    return {
      ...base,
      title: "Document-Based Question",
      documentIds: [],
      subQuestions: [
        {
          id: crypto.randomUUID(),
          prompt: "",
          responseLines: 6,
          sampleAnswer: "",
          rubric: "",
          points: 1
        }
      ]
    };
  }

  throw new Error(`Unknown question type: ${type}`);
}

export function createPassage({ name = "New Passage", type = PASSAGE_TYPES.TEXT, content = "", file = null } = {}) {
  return {
    id: crypto.randomUUID(),
    name,
    type,
    content,
    file,
    createdAt: new Date().toISOString()
  };
}

export function normalizeImportedTest(raw) {
  const blank = createBlankTest();
  return {
    ...blank,
    ...raw,
    testInfo: { ...blank.testInfo, ...(raw.testInfo || {}) },
    passages: Array.isArray(raw.passages) ? raw.passages : [],
    questions: Array.isArray(raw.questions) ? raw.questions : []
  };
}
