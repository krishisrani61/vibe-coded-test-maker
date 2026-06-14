import { fileDataUrlToBytes, getChoiceLetter, slugify } from "./utils.js";
import { PASSAGE_TYPES, QUESTION_TYPES } from "./schema.js";

const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
const PAGE = { width: 612, height: 792, margin: 54 };
const ATTACHMENT = { maxWidth: PAGE.width - PAGE.margin * 2, maxHeight: 560, gap: 10 };

export async function exportPdf(test, mode = "student") {
  const pdf = await PDFDocument.create();

  if (test.coverPdf?.dataUrl && mode !== "key") {
    await appendCoverPdf(pdf, test.coverPdf.dataUrl);
  }

  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const ctx = {
    pdf,
    font,
    bold,
    mode,
    page: null,
    y: 0,
    pageNo: 0,
    test,
    embedCache: new Map()
  };

  addPage(ctx);
  drawTitle(ctx);

  if (mode === "key") drawAnswerKey(ctx);
  else await drawQuestions(ctx);

  const bytes = await pdf.save();
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugify(test.testInfo.title)}-${mode}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
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

async function drawQuestions(ctx) {
  for (const [i, q] of ctx.test.questions.entries()) {
    ensureSpace(ctx, 100);
    drawTextBlock(ctx, `${i + 1}. ${q.prompt || q.title || "Question"}${ctx.test.testInfo.showPoints ? ` (${q.points || 0} pts)` : ""}`, { bold: true });
    await drawLinkedPassages(ctx, q);

    if (q.type === QUESTION_TYPES.MCQ) drawMcq(ctx, q);
    if (q.type === QUESTION_TYPES.SAQ) drawSaq(ctx, q);
    if (q.type === QUESTION_TYPES.DBQ) drawDbq(ctx, q, i);
    ctx.y -= 10;
  }
}

async function drawLinkedPassages(ctx, q) {
  const ids = [...new Set([...(q.passageIds || []), ...(q.documentIds || [])])];
  for (const id of ids) {
    const p = ctx.test.passages.find(item => item.id === id);
    if (!p) continue;

    ensureSpace(ctx, 70);
    drawTextBlock(ctx, p.name, { bold: true, size: 10 });

    if (p.type === PASSAGE_TYPES.TEXT || p.type === PASSAGE_TYPES.TABLE) {
      drawTextBlock(ctx, p.content, { size: 9, x: PAGE.margin + 12, maxWidth: PAGE.width - PAGE.margin * 2 - 12 });
      ctx.y -= 4;
      continue;
    }

    if (p.file?.dataUrl) {
      await drawEmbeddedAttachment(ctx, p);
    } else {
      drawTextBlock(ctx, `[${String(p.type).toUpperCase()} attachment missing: ${p.file?.name || "no file selected"}]`, { size: 9, x: PAGE.margin + 12 });
    }
    ctx.y -= 4;
  }
}

async function drawEmbeddedAttachment(ctx, passage) {
  const type = passage.file?.type || "";
  const name = passage.file?.name || "attached file";

  try {
    if (passage.type === PASSAGE_TYPES.IMAGE || type.startsWith("image/")) {
      await drawImageAttachment(ctx, passage);
      return;
    }

    if (passage.type === PASSAGE_TYPES.PDF || type === "application/pdf" || name.toLowerCase().endsWith(".pdf")) {
      await drawPdfAttachment(ctx, passage);
      return;
    }

    drawTextBlock(ctx, `[Unsupported attachment type: ${name}]`, { size: 9, x: PAGE.margin + 12 });
  } catch (error) {
    console.warn(`Could not embed attachment ${name}`, error);
    drawTextBlock(ctx, `[Attachment could not be embedded: ${name}]`, { size: 9, x: PAGE.margin + 12 });
  }
}

async function drawImageAttachment(ctx, passage) {
  const cacheKey = `image:${passage.id}:${passage.file.name}`;
  let embedded = ctx.embedCache.get(cacheKey);

  if (!embedded) {
    const bytes = fileDataUrlToBytes(passage.file.dataUrl);
    const mime = passage.file.type || "";
    const lower = passage.file.name.toLowerCase();

    if (mime.includes("png") || lower.endsWith(".png")) embedded = await ctx.pdf.embedPng(bytes);
    else if (mime.includes("jpeg") || mime.includes("jpg") || lower.endsWith(".jpg") || lower.endsWith(".jpeg")) embedded = await ctx.pdf.embedJpg(bytes);
    else throw new Error("Only PNG and JPEG images can be embedded by pdf-lib.");

    ctx.embedCache.set(cacheKey, embedded);
  }

  const scaled = scaleToFit(embedded.width, embedded.height, ATTACHMENT.maxWidth, ATTACHMENT.maxHeight);
  ensureSpace(ctx, scaled.height + 26);
  ctx.page.drawText(passage.file.name, { x: PAGE.margin + 12, y: ctx.y, size: 8, font: ctx.font, color: rgb(.35,.35,.35) });
  ctx.y -= 12;
  ctx.page.drawImage(embedded, { x: PAGE.margin + 12, y: ctx.y - scaled.height, width: scaled.width, height: scaled.height });
  ctx.y -= scaled.height + ATTACHMENT.gap;
}

async function drawPdfAttachment(ctx, passage) {
  const bytes = fileDataUrlToBytes(passage.file.dataUrl);
  const src = await PDFDocument.load(bytes);
  const indices = src.getPageIndices();

  for (const [pageIndexIndex, pageIndex] of indices.entries()) {
    const [embeddedPage] = await ctx.pdf.embedPdf(bytes, [pageIndex]);
    const scaled = scaleToFit(embeddedPage.width, embeddedPage.height, ATTACHMENT.maxWidth, ATTACHMENT.maxHeight);

    ensureSpace(ctx, scaled.height + 34);
    const label = `${passage.file.name} - page ${pageIndexIndex + 1} of ${indices.length}`;
    ctx.page.drawText(label, { x: PAGE.margin + 12, y: ctx.y, size: 8, font: ctx.font, color: rgb(.35,.35,.35) });
    ctx.y -= 12;
    ctx.page.drawRectangle({ x: PAGE.margin + 12, y: ctx.y - scaled.height, width: scaled.width, height: scaled.height, borderWidth: .5, borderColor: rgb(.72,.72,.72) });
    ctx.page.drawPage(embeddedPage, { x: PAGE.margin + 12, y: ctx.y - scaled.height, width: scaled.width, height: scaled.height });
    ctx.y -= scaled.height + ATTACHMENT.gap;
  }
}

function scaleToFit(width, height, maxWidth, maxHeight) {
  const factor = Math.min(maxWidth / width, maxHeight / height, 1);
  return { width: width * factor, height: height * factor };
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
