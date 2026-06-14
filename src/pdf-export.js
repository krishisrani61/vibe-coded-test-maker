import { escapeHtml, fileDataUrlToBytes, getChoiceLetter, slugify } from "./utils.js";
import { QUESTION_TYPES } from "./schema.js";

const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
const PAGE = { width: 612, height: 792, margin: 54 };

export async function exportPdf(test, mode = "student") {
  const pdf = await PDFDocument.create();

  if (test.coverPdf?.dataUrl && mode !== "key") {
    await appendCoverPdf(pdf, test.coverPdf.dataUrl);
  }

  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const ctx = { pdf, font, bold, mode, page: null, y: 0, pageNo: 0, test };

  addPage(ctx);
  drawTitle(ctx);

  if (mode === "key") drawAnswerKey(ctx);
  else drawQuestions(ctx);

  const bytes = await pdf.save();
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugify(test.testInfo.title)}-${mode}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

async function appendCoverPdf(pdf, dataUrl) {
  try {
    const src = await PDFDocument.load(fileDataUrlToBytes(dataUrl));
    const pages = await pdf.copyPages(src, src.getPageIndices());
    pages.forEach(page => pdf.addPage(page));
  } catch (error) {
    console.warn("Cover PDF could not be merged", error);
  }
}

function addPage(ctx) {
  ctx.page = ctx.pdf.addPage([PAGE.width, PAGE.height]);
  ctx.pageNo += 1;
  ctx.y = PAGE.height - PAGE.margin;
  drawHeaderFooter(ctx);
}

function drawHeaderFooter(ctx) {
  const info = ctx.test.testInfo;
  if (info.headerText) {
    ctx.page.drawText(info.headerText, { x: PAGE.margin, y: PAGE.height - 30, size: 9, font: ctx.font, color: rgb(.35,.35,.35) });
  }
  if (info.footerText) {
    ctx.page.drawText(info.footerText, { x: PAGE.margin, y: 28, size: 9, font: ctx.font, color: rgb(.35,.35,.35) });
  }
  if (info.includePageNumbers) {
    ctx.page.drawText(`Page ${ctx.pageNo}`, { x: PAGE.width - PAGE.margin - 45, y: 28, size: 9, font: ctx.font, color: rgb(.35,.35,.35) });
  }
}

function ensureSpace(ctx, amount = 80) {
  if (ctx.y - amount < PAGE.margin) addPage(ctx);
}

function drawTextBlock(ctx, text, opts = {}) {
  const size = opts.size || 11;
  const font = opts.bold ? ctx.bold : ctx.font;
  const maxWidth = opts.maxWidth || PAGE.width - PAGE.margin * 2;
  const lines = wrapText(text || "", font, size, maxWidth);
  for (const line of lines) {
    ensureSpace(ctx, size + 6);
    ctx.page.drawText(line, { x: opts.x || PAGE.margin, y: ctx.y, size, font, color: rgb(0,0,0) });
    ctx.y -= size + 4;
  }
}

function drawTitle(ctx) {
  const info = ctx.test.testInfo;
  drawCentered(ctx, info.title || "Untitled Test", 18, true);
  drawCentered(ctx, [info.course, info.teacher, info.date].filter(Boolean).join(" • "), 10, false);
  ctx.y -= 18;
}

function drawCentered(ctx, text, size, useBold) {
  const font = useBold ? ctx.bold : ctx.font;
  const width = font.widthOfTextAtSize(text, size);
  ctx.page.drawText(text, { x: (PAGE.width - width) / 2, y: ctx.y, size, font });
  ctx.y -= size + 8;
}

function drawQuestions(ctx) {
  ctx.test.questions.forEach((q, i) => {
    ensureSpace(ctx, 100);
    drawTextBlock(ctx, `${i + 1}. ${q.prompt || q.title || "Question"}${ctx.test.testInfo.showPoints ? ` (${q.points || 0} pts)` : ""}`, { bold: true });
    drawLinkedPassages(ctx, q);

    if (q.type === QUESTION_TYPES.MCQ) drawMcq(ctx, q);
    if (q.type === QUESTION_TYPES.SAQ) drawSaq(ctx, q);
    if (q.type === QUESTION_TYPES.DBQ) drawDbq(ctx, q, i);
    ctx.y -= 10;
  });
}

function drawLinkedPassages(ctx, q) {
  const ids = q.passageIds || q.documentIds || [];
  ids.forEach(id => {
    const p = ctx.test.passages.find(item => item.id === id);
    if (!p) return;
    ensureSpace(ctx, 70);
    drawTextBlock(ctx, p.name, { bold: true, size: 10 });
    if (p.content) drawTextBlock(ctx, p.content, { size: 9, x: PAGE.margin + 12, maxWidth: PAGE.width - PAGE.margin * 2 - 12 });
    else drawTextBlock(ctx, `[${p.type.toUpperCase()} attachment: ${p.file?.name || "attached file"}]`, { size: 9, x: PAGE.margin + 12 });
    ctx.y -= 4;
  });
}

function drawMcq(ctx, q) {
  q.choices.forEach((choice, i) => {
    const letter = getChoiceLetter(i);
    const marker = ctx.mode === "teacher" && choice.correct ? "◉" : "○";
    drawTextBlock(ctx, `${marker} ${letter}. ${choice.text}`, { x: PAGE.margin + 18 });
  });
  if (ctx.mode === "teacher" && q.explanation) {
    drawTextBlock(ctx, `Explanation: ${q.explanation}`, { size: 9, x: PAGE.margin + 18 });
  }
}

function drawSaq(ctx, q) {
  drawLines(ctx, q.responseLines || 6);
  if (ctx.mode === "teacher") drawTeacherNotes(ctx, q);
}

function drawDbq(ctx, q, index) {
  q.subQuestions.forEach((s, subIndex) => {
    drawTextBlock(ctx, `${index + 1}.${subIndex + 1} ${s.prompt}${ctx.test.testInfo.showPoints ? ` (${s.points || 0} pts)` : ""}`, { bold: true, x: PAGE.margin + 12 });
    drawLines(ctx, s.responseLines || 6);
    if (ctx.mode === "teacher") drawTeacherNotes(ctx, s);
  });
}

function drawLines(ctx, count) {
  for (let i = 0; i < count; i++) {
    ensureSpace(ctx, 24);
    ctx.page.drawLine({ start: { x: PAGE.margin, y: ctx.y }, end: { x: PAGE.width - PAGE.margin, y: ctx.y }, thickness: .6, color: rgb(.65,.65,.65) });
    ctx.y -= 24;
  }
}

function drawTeacherNotes(ctx, item) {
  if (item.sampleAnswer) drawTextBlock(ctx, `Sample answer: ${item.sampleAnswer}`, { size: 9, x: PAGE.margin + 18 });
  if (item.rubric) drawTextBlock(ctx, `Rubric: ${item.rubric}`, { size: 9, x: PAGE.margin + 18 });
}

function drawAnswerKey(ctx) {
  ctx.test.questions.forEach((q, i) => {
    if (q.type === QUESTION_TYPES.MCQ) {
      const correct = q.choices.map((c, idx) => c.correct ? getChoiceLetter(idx) : null).filter(Boolean).join(", ") || "—";
      drawTextBlock(ctx, `${i + 1}. ${correct}`);
    } else if (q.type === QUESTION_TYPES.SAQ) {
      drawTextBlock(ctx, `${i + 1}. ${q.sampleAnswer || q.rubric || "No key provided"}`);
    } else {
      drawTextBlock(ctx, `${i + 1}. DBQ`, { bold: true });
      q.subQuestions.forEach((s, n) => drawTextBlock(ctx, `${i + 1}.${n + 1} ${s.sampleAnswer || s.rubric || "No key provided"}`, { x: PAGE.margin + 18 }));
    }
  });
}

function wrapText(text, font, size, maxWidth) {
  const cleaned = String(text).replace(/\s+/g, " ").trim();
  if (!cleaned) return [""];
  const words = cleaned.split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(testLine, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = testLine;
    }
  }
  if (line) lines.push(line);
  return lines;
}
