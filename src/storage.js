import { downloadTextFile, slugify } from "./utils.js";
import { normalizeImportedTest } from "./schema.js";

export function serializeTest(test) {
  return JSON.stringify({ ...test, updatedAt: new Date().toISOString() }, null, 2);
}

export function saveTestFile(test) {
  const safeTitle = slugify(test.testInfo?.title || "test");
  downloadTextFile(`${safeTitle}.testmaker`, serializeTest(test), "application/json");
}

export async function loadTestFromFile(file) {
  const text = await file.text();
  const parsed = JSON.parse(text);
  return normalizeImportedTest(parsed);
}
