import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const LOSTARK_ORIGIN = "https://lostark.game.onstove.com";
const NOTICE_DETAIL_PATH_PREFIX = "/News/Notice/Views/";
const PATCH_TITLE_PATTERN = /업데이트\s*내역\s*안내/;
const MAJOR_PATTERNS = [/신규/, /밸런스/, /(레이드|클래스|시스템|콘텐츠)[\s\S]*추가/];
const MINOR_PATTERNS = [/(이벤트|보상|편의|UI)[\s\S]*(추가|개선|변경|조정)/, /편의성이\s*개선/];
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
  let url;

  try {
    url = new URL(String(href || "").trim(), LOSTARK_ORIGIN);
  } catch {
    return null;
  }

  if (url.origin !== LOSTARK_ORIGIN || !url.pathname.startsWith(NOTICE_DETAIL_PATH_PREFIX)) {
    return null;
  }

  return url.href;
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

    const sourceUrl = absoluteNoticeUrl(match[1]);

    if (!sourceUrl) {
      continue;
    }

    entries.push({
      title,
      sourceUrl
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
  const hasMajorSignal = MAJOR_PATTERNS.some((pattern) => pattern.test(text));
  const hasMinorSignal = MINOR_PATTERNS.some((pattern) => pattern.test(text));
  const noUpdateHits = NO_UPDATE_TERMS.filter((term) => text.includes(term)).length;

  if (hasMajorSignal) {
    return { changeType: "major", summary: "신규 콘텐츠, 밸런스, 시스템, 성장 구조 변경 포함" };
  }

  if (noUpdateHits > 0) {
    return { changeType: "no-update", summary: "단순 오류 수정 중심의 없데이트" };
  }

  if (hasMinorSignal) {
    return { changeType: "minor", summary: "편의성, 이벤트, 보상, UI 변경 중심" };
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

function yearForNote(note) {
  const publishedYear = String(note.publishedAt || "").match(/^(\d{4})-/)?.[1];
  const fetchedYear = String(note.fetchedAt || "").match(/^(\d{4})-/)?.[1];

  return publishedYear || fetchedYear || "2026";
}

function slugForTitle(note) {
  const date = String(note.title || "").match(/(\d+)월\s*(\d+)일/);
  const month = date ? date[1].padStart(2, "0") : "00";
  const day = date ? date[2].padStart(2, "0") : "00";

  return `${yearForNote(note)}-${month}-${day}-update`;
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
  const matches = [];

  for (const filePath of files) {
    const content = await readFile(filePath, "utf8");

    if (frontmatterValue(content, "sourceUrl") === sourceUrl) {
      matches.push({ filePath, content });
    }
  }

  return matches;
}

function frontmatterValue(content, key) {
  const frontmatter = String(content || "").match(/^---\n([\s\S]*?)\n---/)?.[1] || "";
  const escapedKey = escapeRegex(key);
  const match = frontmatter.match(new RegExp(`^${escapedKey}:\\s*["']?([^"'\\n]+)["']?\\s*$`, "m"));

  return match?.[1]?.trim() || null;
}

async function unusedRevisionPath(inboxDir, slug) {
  const basePath = path.join(inboxDir, `${slug}-revision.md`);

  try {
    await readFile(basePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      return basePath;
    }

    throw error;
  }

  for (let revision = 2; revision < 1000; revision += 1) {
    const filePath = path.join(inboxDir, `${slug}-revision-${revision}.md`);

    try {
      await readFile(filePath, "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") {
        return filePath;
      }

      throw error;
    }
  }

  throw new Error(`Unable to find unused revision path for ${slug}`);
}

export async function writeFetchedPatchNote({ rootDir = process.cwd(), note }) {
  const markdown = patchNoteToMarkdown(note);
  const sourceHash = sourceHashForBody(cleanPatchNoteBody(note.body));
  const existing = await findExistingBySourceUrl(rootDir, note.sourceUrl);

  if (existing.some(({ content }) => frontmatterValue(content, "sourceHash") === sourceHash)) {
    return { action: "skipped", filePath: existing[0].filePath };
  }

  const inboxDir = path.join(rootDir, "data/rag/inbox/patch-notes");
  await mkdir(inboxDir, { recursive: true });

  const slug = slugForTitle(note);
  const hasChangedExisting = existing.length > 0;
  const filePath = hasChangedExisting
    ? await unusedRevisionPath(inboxDir, slug)
    : path.join(inboxDir, `${slug}.md`);

  await writeFile(filePath, markdown, "utf8");

  return { action: hasChangedExisting ? "revision" : "written", filePath };
}
