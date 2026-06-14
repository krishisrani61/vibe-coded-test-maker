# ExamForge Test Maker

A browser-only, GitHub Pages-compatible test maker for teachers.

## Features included in this starter project

- Plain HTML/CSS/JavaScript
- Runs entirely in the browser
- Test metadata editor
- Cover PDF upload field
- MCQ, SAQ, and DBQ question creation
- Custom MCQ answer choices
- Optional answer keys, rubrics, and sample answers
- Reusable passage/document library
- Drag-and-drop question ordering with SortableJS
- Save/open `.testmaker` files, internally JSON
- Export Student PDF, Teacher PDF, and Answer Key PDF
- Basic PDF generation using PDF-lib
- GitHub Pages-ready static structure

## File structure

```txt
/index.html
/styles.css
/src/app.js
/src/schema.js
/src/ui.js
/src/storage.js
/src/pdf-export.js
/src/utils.js
```

## Deployment on GitHub Pages

1. Create a GitHub repository.
2. Upload these files.
3. Go to Settings → Pages.
4. Set source to the main branch root folder.
5. Open the published GitHub Pages URL.

## Notes

This is a strong starter structure, not a final commercial app. PDF export works for basic text-based tests and cover-page merging. Image/PDF document embedding is represented as attachment references in the generated PDF for now. The next improvement would be full embedding of uploaded DBQ image/PDF documents inside the generated test booklet.

## Suggested next upgrades

- Full rich text editing
- Better print layout controls
- Regents-style section templates
- Embed image passages directly into PDF export
- Embed DBQ PDF pages into the correct location
- Question bank import/export
- Randomize choices
- Theme selector
- Validation warnings before export


## DBQ attachment embedding

Uploaded PNG/JPEG images and PDF documents linked to a question are now drawn directly inside the generated Student and Teacher PDFs. Multi-page DBQ PDFs are scaled into the booklet one page at a time. Unsupported attachment types fall back to a warning line in the export.
