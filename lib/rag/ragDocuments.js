import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const APPROVED_ROOT = path.join("data", "rag", "approved");
const REQUIRED_META = ["title", "sourceUrl", "publishedAt", "status", "category"];
const ALLOWED_CATEGORIES = new Set(["patch-note", "glossary", "formula"]);

function normalizePath(filePath) {
  return filePath.split(path.sep).join("/");
}

function parseFrontmatterValue(value) {
  const trimmed = String(value || "").trim();
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseFrontmatterBlock(block) {
  return block
    .split(/\r?\n/)
    .reduce((meta, line) => {
      const match = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
      if (!match) {
        return meta;
      }

      return {
        ...meta,
        [match[1]]: parseFrontmatterValue(match[2])
      };
    }, {});
}

export function parseRagMarkdown(markdown) {
  const text = String(markdown || "").replace(/\r\n/g, "\n");
  const match = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);

  if (!match) {
    return {
      meta: {},
      body: text.trim()
    };
  }

  return {
    meta: parseFrontmatterBlock(match[1]),
    body: match[2].trim()
  };
}

function hasValidMeta(meta) {
  if (!REQUIRED_META.every((key) => typeof meta[key] === "string" && meta[key].trim())) {
    return false;
  }

  return meta.status === "approved" && ALLOWED_CATEGORIES.has(meta.category);
}

async function listMarkdownFiles(directory) {
  let entries;

  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }

  const nested = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return listMarkdownFiles(entryPath);
    }

    if (entry.isFile() && entry.name.endsWith(".md")) {
      return [entryPath];
    }

    return [];
  }));

  return nested.flat();
}

function idForRelativePath(relativePath) {
  return relativePath
    .replace(/^data\/rag\/approved\//, "")
    .replace(/\.md$/, "");
}

export async function loadApprovedRagDocuments({ rootDir = process.cwd() } = {}) {
  const approvedDir = path.join(rootDir, APPROVED_ROOT);
  const files = await listMarkdownFiles(approvedDir);
  const documents = [];

  for (const filePath of files) {
    const markdown = await readFile(filePath, "utf8");
    const parsed = parseRagMarkdown(markdown);

    if (!hasValidMeta(parsed.meta)) {
      continue;
    }

    const relativePath = normalizePath(path.relative(rootDir, filePath));

    documents.push({
      id: idForRelativePath(relativePath),
      relativePath,
      meta: parsed.meta,
      body: parsed.body
    });
  }

  return documents.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function pushChunk(chunks, document, sectionTitle, lines) {
  const text = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();

  if (!text) {
    return;
  }

  chunks.push({
    documentId: document.id,
    relativePath: document.relativePath,
    title: document.meta.title,
    category: document.meta.category,
    changeType: document.meta.changeType || "",
    publishedAt: document.meta.publishedAt,
    sourceUrl: document.meta.sourceUrl,
    sectionTitle: sectionTitle || document.meta.title,
    text
  });
}

export function chunkRagDocument(document) {
  const lines = String(document?.body || "").split(/\r?\n/);
  const chunks = [];
  let sectionTitle = document?.meta?.title || "";
  let buffer = [];

  for (const line of lines) {
    const heading = line.match(/^(#{1,3})\s+(.+)$/);

    if (heading) {
      pushChunk(chunks, document, sectionTitle, buffer);
      sectionTitle = heading[2].trim();
      buffer = [];
      continue;
    }

    buffer.push(line);
  }

  pushChunk(chunks, document, sectionTitle, buffer);

  return chunks;
}
