import { chunkRagDocument, loadApprovedRagDocuments } from "./ragDocuments.js";

const MAX_REFERENCES = 5;
const MAX_SNIPPET_CHARS = 700;
const MIN_SCORE = 4;
const PATCH_TERMS = new Set(["패치", "업데이트", "이번", "이번주", "이번 주", "없데이트"]);
const FORMULA_TERMS = new Set(["효율", "계산", "전투력", "공식", "왜"]);
const GLOSSARY_TERMS = new Set(["뭐야", "뜻", "설명", "용어"]);

function normalizeText(value) {
  return String(value || "").toLowerCase();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function tokenize(value) {
  return normalizeText(value)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2);
}

function contextTerms(context = {}) {
  return [
    context.profile?.className,
    ...(Array.isArray(context.skillSummary) ? context.skillSummary : []),
    context.engravingSummary,
    ...(Array.isArray(context.keyEquipment) ? context.keyEquipment.map((item) => item.name) : []),
    ...(Array.isArray(context.accessories) ? context.accessories.flatMap((item) => [item.slot, item.name, ...(item.specialOptions || [])]) : []),
    ...(Array.isArray(context.topSpecUps) ? context.topSpecUps.flatMap((item) => [item.type, item.label, item.target]) : [])
  ].flatMap(tokenize);
}

export function extractSearchTerms({ message = "", context = {} } = {}) {
  return unique([...tokenize(message), ...contextTerms(context)]);
}

function includesAny(message, terms) {
  const normalized = normalizeText(message);
  return [...terms].some((term) => normalized.includes(term));
}

function recencyScore(publishedAt) {
  const time = Date.parse(publishedAt);
  if (!Number.isFinite(time)) {
    return 0;
  }

  return Math.max(0, Math.min(2, (time - Date.parse("2026-01-01")) / 1000 / 60 / 60 / 24 / 365));
}

function hitScore(haystack, terms, weight) {
  const text = normalizeText(haystack);
  return terms.reduce((score, term) => score + (text.includes(term) ? weight : 0), 0);
}

function categoryIntentScore(chunk, message) {
  if (chunk.category === "patch-note" && includesAny(message, PATCH_TERMS)) {
    return 4;
  }

  if (chunk.category === "formula" && includesAny(message, FORMULA_TERMS)) {
    return 4;
  }

  if (chunk.category === "glossary" && includesAny(message, GLOSSARY_TERMS)) {
    return 4;
  }

  return 0;
}

export function scoreRagChunk(chunk, { message = "", terms = [] } = {}) {
  let score = 0;

  score += hitScore(chunk.title, terms, 4);
  score += hitScore(chunk.sectionTitle, terms, 3);
  score += hitScore(chunk.text, terms, 1);
  score += categoryIntentScore(chunk, message);

  if (chunk.category === "patch-note") {
    score += recencyScore(chunk.publishedAt);
  }

  if (chunk.changeType === "no-update" && normalizeText(message).includes("없데이트")) {
    score += 6;
  }

  return score;
}

function truncateSnippet(text) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  return normalized.length > MAX_SNIPPET_CHARS
    ? `${normalized.slice(0, MAX_SNIPPET_CHARS - 1)}…`
    : normalized;
}

function toReference(chunk, score) {
  const text = [chunk.sectionTitle, chunk.text]
    .filter(Boolean)
    .join("\n");

  return {
    title: chunk.title,
    category: chunk.category,
    changeType: chunk.changeType || "",
    publishedAt: chunk.publishedAt,
    sourceUrl: chunk.sourceUrl,
    sectionTitle: chunk.sectionTitle,
    citationLabel: chunk.publishedAt ? `${chunk.publishedAt} ${chunk.title}` : chunk.title,
    text: truncateSnippet(text),
    score
  };
}

function currentPatchBoost(chunk, wantsCurrentPatch, latestPatchTime) {
  if (!wantsCurrentPatch || chunk.category !== "patch-note") {
    return 0;
  }

  return Date.parse(chunk.publishedAt) === latestPatchTime ? 2 : 0;
}

export async function retrieveSgguReferences({
  message = "",
  context = {},
  documents = null,
  rootDir = process.cwd(),
  limit = MAX_REFERENCES
} = {}) {
  const loadedDocuments = Array.isArray(documents)
    ? documents
    : await loadApprovedRagDocuments({ rootDir });
  const terms = extractSearchTerms({ message, context });

  if (!terms.length) {
    return [];
  }

  const chunks = loadedDocuments.flatMap(chunkRagDocument);
  const wantsCurrentPatch = includesAny(message, PATCH_TERMS) && normalizeText(message).includes("이번");
  const latestPatchTime = Math.max(
    ...chunks
      .filter((chunk) => chunk.category === "patch-note")
      .map((chunk) => Date.parse(chunk.publishedAt))
      .filter(Number.isFinite)
  );

  return chunks
    .map((chunk) => ({
      chunk,
      score: scoreRagChunk(chunk, { message, terms }) + currentPatchBoost(chunk, wantsCurrentPatch, latestPatchTime)
    }))
    .filter(({ score }) => score >= MIN_SCORE)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(({ chunk, score }) => toReference(chunk, score));
}
