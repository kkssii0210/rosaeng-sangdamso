import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const LOSTARK_ORIGIN = "https://lostark.game.onstove.com";
const PATCH_TITLE_PATTERN = /업데이트\s*내역\s*안내/;
const MAJOR_TERMS = ["신규 레이드", "신규 클래스", "밸런스", "클래스", "성장", "시스템", "초월", "엘릭서"];
const MINOR_TERMS = ["이벤트", "보상", "편의", "UI", "개선", "조정"];
const NO_UPDATE_TERMS = ["오류 수정", "알려진 문제", "수정하였습니다", "현상이 수정"];

function stripTags(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function absoluteNoticeUrl(href) {
  const value = String(href || "").trim();

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  return `${LOSTARK_ORIGIN}${value.startsWith("/") ? "" : "/"}${value}`;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractNoticeEntries(html) {
  const entries = [];
  const anchorPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = anchorPattern.exec(String(html || ""))) !== null) {
    const title = stripTags(match[2]).replace(/\s+/g, " ").trim();

    if (!PATCH_TITLE_PATTERN.test(title)) {
      continue;
    }

    entries.push({
      title,
      sourceUrl: absoluteNoticeUrl(match[1])
    });
  }

  return entries;
}

export function cleanPatchNoteBody(html) {
  return stripTags(html);
}

export function sourceHashForBody(body) {
  return `sha256:${createHash("sha256").update(String(body || "").trim()).digest("hex")}`;
}

export function classifyPatchNoteChange(body) {
  const text = String(body || "");
  const majorHits = MAJOR_TERMS.filter((term) => text.includes(term)).length;
  const minorHits = MINOR_TERMS.filter((term) => text.includes(term)).length;
  const noUpdateHits = NO_UPDATE_TERMS.filter((term) => text.includes(term)).length;

  if (majorHits > 0) {
    return { changeType: "major", summary: "신규 콘텐츠, 밸런스, 시스템, 성장 구조 변경 포함" };
  }

  if (minorHits > 0) {
    return { changeType: "minor", summary: "편의성, 이벤트, 보상, UI 변경 중심" };
  }

  if (noUpdateHits > 0) {
    return { changeType: "no-update", summary: "단순 오류 수정 중심의 없데이트" };
  }

  return { changeType: "minor", summary: "작은 변경 중심의 업데이트" };
}

function quoteFrontmatterValue(value) {
  return `"${String(value).replaceAll("\"", "\\\"")}"`;
}

function frontmatterString(meta) {
  return Object.entries(meta)
    .map(([key, value]) => {
      if (["status", "category", "changeType"].includes(key)) {
        return `${key}: ${value}`;
      }

      return `${key}: ${quoteFrontmatterValue(value)}`;
    })
    .join("\n");
}

export function patchNoteToMarkdown(note) {
  const body = cleanPatchNoteBody(note.body);
  const sourceHash = sourceHashForBody(body);
  const classification = classifyPatchNoteChange(body);
  const meta = {
    title: note.title,
    sourceUrl: note.sourceUrl,
    publishedAt: note.publishedAt,
    fetchedAt: note.fetchedAt,
    sourceHash,
    status: "inbox",
    category: "patch-note",
    changeType: classification.changeType,
    summary: classification.summary
  };

  return `---\n${frontmatterString(meta)}\n---\n\n${body}\n`;
}

function slugForTitle(title) {
  const date = String(title || "").match(/(\d+)월\s*(\d+)일/);
  const month = date ? date[1].padStart(2, "0") : "00";
  const day = date ? date[2].padStart(2, "0") : "00";

  return `2026-${month}-${day}-update`;
}

async function listMarkdownFiles(directory) {
  let entries;

  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const nested = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return listMarkdownFiles(entryPath);
    }

    return entry.isFile() && entry.name.endsWith(".md") ? [entryPath] : [];
  }));

  return nested.flat();
}

async function findExistingBySourceUrl(rootDir, sourceUrl) {
  const files = await listMarkdownFiles(path.join(rootDir, "data/rag"));
  const escapedUrl = escapeRegex(sourceUrl);
  const pattern = new RegExp(`^sourceUrl:\\s*["']?${escapedUrl}["']?\\s*$`, "m");
  const matches = [];

  for (const filePath of files) {
    const content = await readFile(filePath, "utf8");

    if (pattern.test(content)) {
      matches.push({ filePath, content });
    }
  }

  return matches;
}

export async function writeFetchedPatchNote({ rootDir = process.cwd(), note }) {
  const markdown = patchNoteToMarkdown(note);
  const sourceHash = sourceHashForBody(cleanPatchNoteBody(note.body));
  const existing = await findExistingBySourceUrl(rootDir, note.sourceUrl);

  if (existing.some(({ content }) => content.includes(`sourceHash: "${sourceHash}"`) || content.includes(`sourceHash: ${sourceHash}`))) {
    return { action: "skipped", filePath: existing[0].filePath };
  }

  const inboxDir = path.join(rootDir, "data/rag/inbox/patch-notes");
  await mkdir(inboxDir, { recursive: true });

  const approvedExists = existing.some(({ filePath }) => filePath.includes(`${path.sep}approved${path.sep}`));
  const suffix = approvedExists ? "-revision" : "";
  const filePath = path.join(inboxDir, `${slugForTitle(note.title)}${suffix}.md`);

  await writeFile(filePath, markdown, "utf8");

  return { action: approvedExists ? "revision" : "written", filePath };
}
