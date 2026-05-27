# Sggu RAG Consultant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reviewed local RAG support to the Sggu consultant using approved patch-note, glossary, and formula documents.

**Architecture:** GitHub Actions fetches official Lost Ark update notices into an inbox for human review, while runtime retrieval reads only `data/rag/approved/**/*.md`. The consultation API retrieves a small set of approved snippets, injects them into the existing local Ollama prompt, and keeps working when no approved documents exist.

**Tech Stack:** Next.js App Router API route, Node.js ES modules, `node:test`, native `fetch`, GitHub Actions scheduled workflow, Markdown frontmatter parsed with local helpers.

---

## File Structure

- Create `lib/rag/ragDocuments.js`: approved document loading, frontmatter parsing, chunking, and metadata validation.
- Create `lib/rag/retriever.js`: keyword extraction, category/intent scoring, snippet selection.
- Create `lib/rag/lostarkPatchNotes.js`: pure crawler helpers for official Lost Ark notice parsing, change classification, Markdown serialization, and inbox writes.
- Create `scripts/fetch-lostark-patch-notes.mjs`: CLI entrypoint used by GitHub Actions.
- Create `.github/workflows/fetch-rag-patch-notes.yml`: weekly Wednesday 10:15 KST scheduled fetch and PR creation.
- Modify `lib/consultant/sgguPrompt.js`: accept references and render `[참고 문서]`.
- Modify `app/api/consult/sggu/route.js`: retrieve references before building chat messages.
- Create tests:
  - `tests/ragDocuments.test.js`
  - `tests/ragRetriever.test.js`
  - `tests/lostarkPatchNotesCrawler.test.js`
- Modify tests:
  - `tests/sgguPrompt.test.js`
  - `tests/sgguConsultApi.test.js`
- Create seed reviewed docs:
  - `data/rag/approved/glossary/ark-passive.md`
  - `data/rag/approved/formulas/combat-power.md`
  - `data/rag/inbox/patch-notes/.gitkeep`
  - `data/rag/approved/patch-notes/.gitkeep`

## Task 1: Approved Document Loader

**Files:**
- Create: `lib/rag/ragDocuments.js`
- Create: `tests/ragDocuments.test.js`

- [ ] **Step 1: Write failing document loader tests**

Create `tests/ragDocuments.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  chunkRagDocument,
  loadApprovedRagDocuments,
  parseRagMarkdown
} from "../lib/rag/ragDocuments.js";

async function writeFixture(rootDir, relativePath, content) {
  const filePath = path.join(rootDir, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
  return filePath;
}

test("parses rag markdown frontmatter and body", () => {
  const document = parseRagMarkdown(`---
title: "깨달음"
sourceUrl: "local:glossary/ark-passive"
publishedAt: "2026-05-27"
status: approved
category: glossary
---

# 깨달음

아크 패시브 포인트 종류다.
`);

  assert.equal(document.meta.title, "깨달음");
  assert.equal(document.meta.status, "approved");
  assert.equal(document.meta.category, "glossary");
  assert.match(document.body, /아크 패시브/);
});

test("loads only approved markdown documents and skips inbox", async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "sggu-rag-docs-"));

  await writeFixture(rootDir, "data/rag/approved/glossary/ark-passive.md", `---
title: "깨달음"
sourceUrl: "local:glossary/ark-passive"
publishedAt: "2026-05-27"
status: approved
category: glossary
---

깨달음은 아크 패시브 포인트다.
`);
  await writeFixture(rootDir, "data/rag/inbox/patch-notes/2026-05-27.md", `---
title: "5월 27일(수) 업데이트 내역 안내"
sourceUrl: "https://lostark.game.onstove.com/News/Notice/1"
publishedAt: "2026-05-27"
status: inbox
category: patch-note
changeType: no-update
---

인박스 문서다.
`);
  await writeFixture(rootDir, "data/rag/approved/glossary/bad.md", `---
title: "분류 없음"
status: approved
---

필수 메타가 부족하다.
`);

  const documents = await loadApprovedRagDocuments({ rootDir });

  assert.equal(documents.length, 1);
  assert.equal(documents[0].meta.title, "깨달음");
  assert.equal(documents[0].relativePath, "data/rag/approved/glossary/ark-passive.md");
});

test("chunks document by headings and paragraph groups", () => {
  const document = {
    id: "glossary/ark-passive",
    relativePath: "data/rag/approved/glossary/ark-passive.md",
    meta: {
      title: "아크 패시브 용어",
      sourceUrl: "local:glossary/ark-passive",
      publishedAt: "2026-05-27",
      status: "approved",
      category: "glossary"
    },
    body: [
      "# 깨달음",
      "깨달음은 직업 특성과 관련된 아크 패시브 포인트다.",
      "",
      "## 진화",
      "진화는 공용 전투 성능과 관련된 아크 패시브 포인트다."
    ].join("\n")
  };

  const chunks = chunkRagDocument(document);

  assert.equal(chunks.length, 2);
  assert.equal(chunks[0].sectionTitle, "깨달음");
  assert.match(chunks[0].text, /직업 특성/);
  assert.equal(chunks[1].sectionTitle, "진화");
});
```

- [ ] **Step 2: Run document loader tests to verify RED**

Run:

```bash
npm test -- tests/ragDocuments.test.js
```

Expected: FAIL with module-not-found for `../lib/rag/ragDocuments.js`.

- [ ] **Step 3: Implement document loader**

Create `lib/rag/ragDocuments.js`:

```js
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
```

- [ ] **Step 4: Run document loader tests to verify GREEN**

Run:

```bash
npm test -- tests/ragDocuments.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit document loader**

```bash
git add lib/rag/ragDocuments.js tests/ragDocuments.test.js
git commit -m "feat: add approved rag document loader"
```

## Task 2: Keyword Retriever

**Files:**
- Create: `lib/rag/retriever.js`
- Create: `tests/ragRetriever.test.js`

- [ ] **Step 1: Write failing retriever tests**

Create `tests/ragRetriever.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { retrieveSgguReferences } from "../lib/rag/retriever.js";

const documents = [
  {
    id: "patch-notes/2026-05-20",
    relativePath: "data/rag/approved/patch-notes/2026-05-20.md",
    meta: {
      title: "5월 20일(수) 업데이트 내역 안내",
      sourceUrl: "https://lostark.game.onstove.com/News/Notice/20",
      publishedAt: "2026-05-20",
      status: "approved",
      category: "patch-note",
      changeType: "major",
      summary: "신규 레이드와 클래스 밸런스 조정"
    },
    body: "# 레이드\n신규 레이드가 추가됐다.\n\n# 클래스 밸런스\n스카우터 스킬 피해량이 조정됐다."
  },
  {
    id: "patch-notes/2026-05-27",
    relativePath: "data/rag/approved/patch-notes/2026-05-27.md",
    meta: {
      title: "5월 27일(수) 업데이트 내역 안내",
      sourceUrl: "https://lostark.game.onstove.com/News/Notice/27",
      publishedAt: "2026-05-27",
      status: "approved",
      category: "patch-note",
      changeType: "no-update",
      summary: "단순 오류 수정 중심의 없데이트"
    },
    body: "# 오류 수정\n일부 퀘스트 진행 오류를 수정했다."
  },
  {
    id: "glossary/ark-passive",
    relativePath: "data/rag/approved/glossary/ark-passive.md",
    meta: {
      title: "아크 패시브 용어",
      sourceUrl: "local:glossary/ark-passive",
      publishedAt: "2026-05-27",
      status: "approved",
      category: "glossary"
    },
    body: "# 깨달음\n깨달음은 직업 특성과 관련된 아크 패시브 포인트다."
  },
  {
    id: "formulas/combat-power",
    relativePath: "data/rag/approved/formulas/combat-power.md",
    meta: {
      title: "전투력 계산 기준",
      sourceUrl: "local:formulas/combat-power",
      publishedAt: "2026-05-27",
      status: "approved",
      category: "formula"
    },
    body: "# 전투력\n전투력은 주스탯과 무기 공격력 기반 시작식에서 출발한다."
  }
];

const context = {
  profile: { className: "스카우터" },
  skillSummary: ["라이징 스피어 10레벨"],
  engravingSummary: "원한 3, 아드레날린 4",
  topSpecUps: [{ type: "weaponHoning", label: "무기 11->12" }]
};

test("returns latest approved patch note for current patch questions", async () => {
  const references = await retrieveSgguReferences({
    message: "이번 주 패치 뭐야?",
    context,
    documents
  });

  assert.equal(references[0].title, "5월 27일(수) 업데이트 내역 안내");
  assert.equal(references[0].changeType, "no-update");
});

test("boosts no-update patch notes for no-update questions", async () => {
  const references = await retrieveSgguReferences({
    message: "이번 주 없데이트야?",
    context,
    documents
  });

  assert.equal(references[0].changeType, "no-update");
  assert.match(references[0].text, /오류 수정/);
});

test("returns formula document for combat-power formula questions", async () => {
  const references = await retrieveSgguReferences({
    message: "전투력 계산 기준이 뭐야?",
    context,
    documents
  });

  assert.equal(references[0].category, "formula");
  assert.match(references[0].text, /주스탯/);
});

test("returns glossary document for terminology questions", async () => {
  const references = await retrieveSgguReferences({
    message: "깨달음이 뭐야?",
    context,
    documents
  });

  assert.equal(references[0].category, "glossary");
  assert.match(references[0].text, /아크 패시브/);
});

test("returns no references when evidence is weak", async () => {
  const references = await retrieveSgguReferences({
    message: "오늘 저녁 뭐 먹지?",
    context,
    documents
  });

  assert.deepEqual(references, []);
});
```

- [ ] **Step 2: Run retriever tests to verify RED**

Run:

```bash
npm test -- tests/ragRetriever.test.js
```

Expected: FAIL with module-not-found for `../lib/rag/retriever.js`.

- [ ] **Step 3: Implement keyword retriever**

Create `lib/rag/retriever.js`:

```js
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
  return {
    title: chunk.title,
    category: chunk.category,
    changeType: chunk.changeType || "",
    publishedAt: chunk.publishedAt,
    sourceUrl: chunk.sourceUrl,
    sectionTitle: chunk.sectionTitle,
    citationLabel: chunk.publishedAt ? `${chunk.publishedAt} ${chunk.title}` : chunk.title,
    text: truncateSnippet(chunk.text),
    score
  };
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

  return loadedDocuments
    .flatMap(chunkRagDocument)
    .map((chunk) => ({ chunk, score: scoreRagChunk(chunk, { message, terms }) }))
    .filter(({ score }) => score >= MIN_SCORE)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(({ chunk, score }) => toReference(chunk, score));
}
```

- [ ] **Step 4: Run retriever tests to verify GREEN**

Run:

```bash
npm test -- tests/ragRetriever.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit retriever**

```bash
git add lib/rag/retriever.js tests/ragRetriever.test.js
git commit -m "feat: add sggu rag retriever"
```

## Task 3: Prompt Reference Injection

**Files:**
- Modify: `lib/consultant/sgguPrompt.js`
- Modify: `tests/sgguPrompt.test.js`

- [ ] **Step 1: Add failing prompt tests**

Append to `tests/sgguPrompt.test.js`:

```js
test("adds approved reference snippets to local chat messages", () => {
  const messages = buildSgguChatMessages({
    message: "이번 주 없데이트야?",
    context: {
      profile: { characterName: "붐버", className: "스카우터" }
    },
    references: [
      {
        title: "5월 27일(수) 업데이트 내역 안내",
        publishedAt: "2026-05-27",
        category: "patch-note",
        changeType: "no-update",
        sectionTitle: "오류 수정",
        sourceUrl: "https://lostark.game.onstove.com/News/Notice/27",
        text: "일부 퀘스트 진행 오류를 수정했다.",
        citationLabel: "2026-05-27 5월 27일(수) 업데이트 내역 안내"
      }
    ]
  });

  assert.match(messages[0].content, /참고 문서/);
  assert.match(messages.at(-1).content, /\[참고 문서\]/);
  assert.match(messages.at(-1).content, /changeType: no-update/);
  assert.match(messages.at(-1).content, /일부 퀘스트 진행 오류/);
});

test("omits reference section when no references exist", () => {
  const messages = buildSgguChatMessages({
    message: "뭐부터 올려?",
    context: {
      profile: { characterName: "붐버" }
    },
    references: []
  });

  assert.doesNotMatch(messages.at(-1).content, /\[참고 문서\]/);
});
```

- [ ] **Step 2: Run prompt tests to verify RED**

Run:

```bash
npm test -- tests/sgguPrompt.test.js
```

Expected: FAIL because references are not rendered.

- [ ] **Step 3: Implement prompt reference rendering**

Modify `lib/consultant/sgguPrompt.js`:

```js
export const SGGU_CONSULTANT_SYSTEM_PROMPT = [
  "너는 로스트아크 성장 상담사 슥구다.",
  "한국어로 짧고 명확하게 답한다.",
  "제공된 데이터와 계산 결과만 근거로 삼는다.",
  "데이터에 없는 내용은 모르면 모른다고 말한다.",
  "가격, 효율, 전투력 상승 수치는 제공된 값만 사용한다.",
  "추천은 비용 대비 효율, 현재 장착 상태, 계산 caveat를 함께 설명한다.",
  "참고 문서가 제공되면 패치, 용어, 계산식 설명의 보조 근거로만 사용한다.",
  "참고 문서에 없는 최신 패치나 용어 설명은 모른다고 말한다.",
  "참고 문서를 사용한 답변은 끝에 짧게 근거 제목을 붙인다.",
  "답변은 2~5문장 또는 짧은 bullet로 제한한다.",
  "유저가 다음 행동을 묻는 경우 가장 먼저 할 1개 행동을 분명히 말한다."
].join("\n");

const OLLAMA_SAFE_ROLES = new Set(["user", "assistant", "system"]);
const MAX_REFERENCE_TEXT_CHARS = 900;

function isSafeConversationEntry(entry) {
  return (
    entry &&
    OLLAMA_SAFE_ROLES.has(entry.role) &&
    typeof entry.content === "string" &&
    entry.content.trim().length > 0
  );
}

function truncateReferenceText(text) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  return normalized.length > MAX_REFERENCE_TEXT_CHARS
    ? `${normalized.slice(0, MAX_REFERENCE_TEXT_CHARS - 1)}…`
    : normalized;
}

function formatReference(reference, index) {
  return [
    `${index + 1}. ${reference.title || "제목 없음"}`,
    `publishedAt: ${reference.publishedAt || ""}`,
    `category: ${reference.category || ""}`,
    `changeType: ${reference.changeType || ""}`,
    `section: ${reference.sectionTitle || ""}`,
    `sourceUrl: ${reference.sourceUrl || ""}`,
    `snippet: ${truncateReferenceText(reference.text)}`
  ].join("\n");
}

function formatReferences(references) {
  const safeReferences = Array.isArray(references)
    ? references.filter((reference) => reference && typeof reference.text === "string" && reference.text.trim())
    : [];

  if (!safeReferences.length) {
    return [];
  }

  return [
    "",
    "[참고 문서]",
    ...safeReferences.slice(0, 5).map(formatReference)
  ];
}

export function buildSgguChatMessages(options = {}) {
  const { message, conversation, context, references } = options ?? {};
  const safeConversation = Array.isArray(conversation) ? conversation.filter(isSafeConversationEntry) : [];
  const contextJson = JSON.stringify(context ?? {}, null, 2);
  const safeMessage = typeof message === "string" ? message : "";

  return [
    { role: "system", content: SGGU_CONSULTANT_SYSTEM_PROMPT },
    ...safeConversation,
    {
      role: "user",
      content: [
        "아래 캐릭터 데이터와 스펙업 후보만 근거로 답해줘.",
        "패치, 용어, 계산식 질문은 참고 문서가 있을 때만 참고 문서 근거를 사용해줘.",
        "",
        "[캐릭터 데이터]",
        contextJson,
        ...formatReferences(references),
        "",
        "[유저 질문]",
        safeMessage
      ].join("\n")
    }
  ];
}
```

- [ ] **Step 4: Run prompt tests to verify GREEN**

Run:

```bash
npm test -- tests/sgguPrompt.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit prompt references**

```bash
git add lib/consultant/sgguPrompt.js tests/sgguPrompt.test.js
git commit -m "feat: add rag references to sggu prompt"
```

## Task 4: Consultation API Retrieval Integration

**Files:**
- Modify: `app/api/consult/sggu/route.js`
- Modify: `tests/sgguConsultApi.test.js`

- [ ] **Step 1: Add failing API helper tests**

Modify the route import in `tests/sgguConsultApi.test.js`:

```js
const {
  POST: consultSggu,
  buildSgguConsultMessagesForRequest
} = await import("../app/api/consult/sggu/route.js");
```

Add tests:

```js
test("builds consult messages with retrieved references", async () => {
  const messages = await buildSgguConsultMessagesForRequest({
    body: {
      message: "이번 주 없데이트야?",
      context: {
        profile: { characterName: "붐버", className: "스카우터" }
      }
    },
    retrieveReferences: async () => [
      {
        title: "5월 27일(수) 업데이트 내역 안내",
        publishedAt: "2026-05-27",
        category: "patch-note",
        changeType: "no-update",
        sectionTitle: "오류 수정",
        sourceUrl: "https://lostark.game.onstove.com/News/Notice/27",
        text: "단순 오류 수정 중심의 없데이트다."
      }
    ]
  });

  assert.match(messages.at(-1).content, /\[참고 문서\]/);
  assert.match(messages.at(-1).content, /단순 오류 수정 중심/);
});

test("builds consult messages without references when retrieval throws", async () => {
  const messages = await buildSgguConsultMessagesForRequest({
    body: {
      message: "뭐부터 올려?",
      context: {
        profile: { characterName: "붐버", className: "스카우터" }
      }
    },
    retrieveReferences: async () => {
      throw new Error("retriever failed");
    }
  });

  assert.doesNotMatch(messages.at(-1).content, /\[참고 문서\]/);
  assert.match(messages.at(-1).content, /"characterName": "붐버"/);
});
```

- [ ] **Step 2: Run API tests to verify RED**

Run:

```bash
npm test -- tests/sgguConsultApi.test.js
```

Expected: FAIL because `buildSgguConsultMessagesForRequest` is not exported.

- [ ] **Step 3: Implement route helper and retrieval**

Modify `app/api/consult/sggu/route.js`:

```js
import { NextResponse } from "next/server";
import {
  buildSgguConsultantContext,
  normalizeConsultConversation,
  sanitizeConsultMessage
} from "../../../../lib/consultant/sgguContext.js";
import { buildSgguChatMessages } from "../../../../lib/consultant/sgguPrompt.js";
import { createLocalLlmClient, LocalLlmError } from "../../../../lib/llm/localLlmClient.js";
import { retrieveSgguReferences } from "../../../../lib/rag/retriever.js";

export const runtime = "nodejs";

const ERROR_CODES = {
  INVALID_MESSAGE: "INVALID_MESSAGE",
  INVALID_ARMORY: "INVALID_ARMORY",
  LOCAL_LLM_UNAVAILABLE: "LOCAL_LLM_UNAVAILABLE",
  LOCAL_LLM_ERROR: "LOCAL_LLM_ERROR"
};

async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function errorResponse(code, message, status) {
  return NextResponse.json({ code, message }, { status });
}

function contextFromBody(body) {
  return body?.context && typeof body.context === "object"
    ? body.context
    : buildSgguConsultantContext({
      armory: body?.armory,
      specUpRecommendation: body?.specUpRecommendation
    });
}

async function safeRetrieveReferences({ message, context, retrieveReferences }) {
  try {
    return await retrieveReferences({ message, context });
  } catch (error) {
    console.warn("Sggu RAG retrieval failed", error);
    return [];
  }
}

export async function buildSgguConsultMessagesForRequest({
  body,
  retrieveReferences = retrieveSgguReferences
} = {}) {
  const message = sanitizeConsultMessage(body?.message);
  const context = contextFromBody(body);
  const conversation = normalizeConsultConversation(body?.conversation);
  const references = await safeRetrieveReferences({ message, context, retrieveReferences });

  return buildSgguChatMessages({ message, conversation, context, references });
}

export async function POST(request) {
  const body = await readJsonBody(request);
  const message = sanitizeConsultMessage(body?.message);

  if (!message) {
    return errorResponse(
      ERROR_CODES.INVALID_MESSAGE,
      "상담할 내용을 입력해줘.",
      400
    );
  }

  const context = contextFromBody(body);

  if (!String(context?.profile?.characterName || "").trim()) {
    return errorResponse(
      ERROR_CODES.INVALID_ARMORY,
      "캐릭터를 먼저 조회해줘.",
      400
    );
  }

  const messages = await buildSgguConsultMessagesForRequest({ body });

  try {
    const client = createLocalLlmClient();
    const completion = await client.createChatCompletion({ messages });

    return NextResponse.json({
      Answer: completion.text,
      Provider: completion.provider,
      Model: completion.model,
      Usage: completion.usage
    });
  } catch (error) {
    if (error instanceof LocalLlmError && error.code === ERROR_CODES.LOCAL_LLM_UNAVAILABLE) {
      return errorResponse(error.code, error.message, 503);
    }

    if (error instanceof LocalLlmError) {
      return errorResponse(
        ERROR_CODES.LOCAL_LLM_ERROR,
        "슥구 로컬 LLM 상담 응답을 만들지 못했어.",
        502
      );
    }

    return errorResponse(
      ERROR_CODES.LOCAL_LLM_ERROR,
      "슥구 로컬 LLM 상담 응답을 만들지 못했어.",
      502
    );
  }
}
```

- [ ] **Step 4: Run API tests to verify GREEN**

Run:

```bash
npm test -- tests/sgguConsultApi.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit API retrieval integration**

```bash
git add app/api/consult/sggu/route.js tests/sgguConsultApi.test.js
git commit -m "feat: retrieve rag references for sggu consult"
```

## Task 5: Lost Ark Patch Note Crawler Helpers

**Files:**
- Create: `lib/rag/lostarkPatchNotes.js`
- Create: `tests/lostarkPatchNotesCrawler.test.js`

- [ ] **Step 1: Write failing crawler helper tests**

Create `tests/lostarkPatchNotesCrawler.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  classifyPatchNoteChange,
  extractNoticeEntries,
  patchNoteToMarkdown,
  writeFetchedPatchNote
} from "../lib/rag/lostarkPatchNotes.js";

async function tempRoot() {
  return mkdtemp(path.join(tmpdir(), "lostark-patch-crawler-"));
}

test("extracts only update notice entries from official notice list html", () => {
  const entries = extractNoticeEntries(`
    <a href="/News/Notice/Views/13001">5월 27일(수) 업데이트 내역 안내</a>
    <a href="/News/Notice/Views/13002">알려진 문제 안내</a>
    <a href="https://lostark.game.onstove.com/News/Notice/Views/13003">5월 20일(수) 업데이트 내역 안내</a>
  `);

  assert.deepEqual(entries, [
    {
      title: "5월 27일(수) 업데이트 내역 안내",
      sourceUrl: "https://lostark.game.onstove.com/News/Notice/Views/13001"
    },
    {
      title: "5월 20일(수) 업데이트 내역 안내",
      sourceUrl: "https://lostark.game.onstove.com/News/Notice/Views/13003"
    }
  ]);
});

test("classifies bug-fix-only notes as no-update", () => {
  assert.equal(
    classifyPatchNoteChange("일부 퀘스트 진행 오류를 수정하였습니다. 알려진 문제를 수정하였습니다.").changeType,
    "no-update"
  );
  assert.equal(
    classifyPatchNoteChange("신규 레이드가 추가되며 클래스 밸런스가 조정됩니다.").changeType,
    "major"
  );
  assert.equal(
    classifyPatchNoteChange("이벤트 보상과 UI 편의성이 개선됩니다.").changeType,
    "minor"
  );
});

test("serializes patch note markdown with frontmatter", () => {
  const markdown = patchNoteToMarkdown({
    title: "5월 27일(수) 업데이트 내역 안내",
    sourceUrl: "https://lostark.game.onstove.com/News/Notice/Views/13001",
    publishedAt: "2026-05-27",
    fetchedAt: "2026-05-27T01:15:00.000Z",
    body: "일부 오류를 수정하였습니다."
  });

  assert.match(markdown, /status: inbox/);
  assert.match(markdown, /category: patch-note/);
  assert.match(markdown, /changeType: no-update/);
  assert.match(markdown, /sourceHash: "sha256:/);
});

test("writes inbox file and skips same url and hash", async () => {
  const rootDir = await tempRoot();
  const note = {
    title: "5월 27일(수) 업데이트 내역 안내",
    sourceUrl: "https://lostark.game.onstove.com/News/Notice/Views/13001",
    publishedAt: "2026-05-27",
    fetchedAt: "2026-05-27T01:15:00.000Z",
    body: "일부 오류를 수정하였습니다."
  };

  const first = await writeFetchedPatchNote({ rootDir, note });
  const second = await writeFetchedPatchNote({ rootDir, note });

  assert.equal(first.action, "written");
  assert.equal(second.action, "skipped");
  assert.match(await readFile(first.filePath, "utf8"), /5월 27일/);
});

test("writes revision inbox file when approved source url changes", async () => {
  const rootDir = await tempRoot();
  await mkdir(path.join(rootDir, "data/rag/approved/patch-notes"), { recursive: true });
  await writeFile(path.join(rootDir, "data/rag/approved/patch-notes/2026-05-27-update.md"), `---
title: "5월 27일(수) 업데이트 내역 안내"
sourceUrl: "https://lostark.game.onstove.com/News/Notice/Views/13001"
publishedAt: "2026-05-27"
fetchedAt: "2026-05-27T01:15:00.000Z"
sourceHash: "sha256:old"
status: approved
category: patch-note
changeType: no-update
summary: "기존 승인본"
---

기존 본문
`, "utf8");

  const result = await writeFetchedPatchNote({
    rootDir,
    note: {
      title: "5월 27일(수) 업데이트 내역 안내",
      sourceUrl: "https://lostark.game.onstove.com/News/Notice/Views/13001",
      publishedAt: "2026-05-27",
      fetchedAt: "2026-05-27T02:00:00.000Z",
      body: "수정된 본문입니다."
    }
  });

  assert.equal(result.action, "revision");
  assert.match(result.filePath, /revision/);
});
```

- [ ] **Step 2: Run crawler helper tests to verify RED**

Run:

```bash
npm test -- tests/lostarkPatchNotesCrawler.test.js
```

Expected: FAIL with module-not-found for `../lib/rag/lostarkPatchNotes.js`.

- [ ] **Step 3: Implement crawler helpers**

Create `lib/rag/lostarkPatchNotes.js`:

```js
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
    return {
      changeType: "major",
      summary: "신규 콘텐츠, 밸런스, 시스템, 성장 구조 변경 포함"
    };
  }

  if (minorHits > 0) {
    return {
      changeType: "minor",
      summary: "편의성, 이벤트, 보상, UI 변경 중심"
    };
  }

  if (noUpdateHits > 0) {
    return {
      changeType: "no-update",
      summary: "단순 오류 수정 중심의 없데이트"
    };
  }

  return {
    changeType: "minor",
    summary: "작은 변경 중심의 업데이트"
  };
}

function frontmatterString(meta) {
  return Object.entries(meta)
    .map(([key, value]) => `${key}: "${String(value).replaceAll("\"", "\\\"")}"`)
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
  } catch {
    return [];
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
  const pattern = new RegExp(`sourceUrl:\\s*["']${escapedUrl}["']`);
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
  const sourceHash = sourceHashForBody(note.body);
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

  return {
    action: approvedExists ? "revision" : "written",
    filePath
  };
}
```

- [ ] **Step 4: Run crawler helper tests to verify GREEN**

Run:

```bash
npm test -- tests/lostarkPatchNotesCrawler.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit crawler helpers**

```bash
git add lib/rag/lostarkPatchNotes.js tests/lostarkPatchNotesCrawler.test.js
git commit -m "feat: add lostark patch note crawler helpers"
```

## Task 6: Fetch Script And GitHub Actions Workflow

**Files:**
- Create: `scripts/fetch-lostark-patch-notes.mjs`
- Create: `.github/workflows/fetch-rag-patch-notes.yml`
- Modify: `package.json`

- [ ] **Step 1: Create fetch script**

Create `scripts/fetch-lostark-patch-notes.mjs`:

```js
import { extractNoticeEntries, writeFetchedPatchNote } from "../lib/rag/lostarkPatchNotes.js";

const NOTICE_LIST_URL = "https://lostark.game.onstove.com/News/Notice/List";

function isoDateFromTitle(title) {
  const match = String(title || "").match(/(\d+)월\s*(\d+)일/);
  const year = new Date().getUTCFullYear();

  if (!match) {
    return new Date().toISOString().slice(0, 10);
  }

  return `${year}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      accept: "text/html,application/xhtml+xml"
    }
  });

  if (!response.ok) {
    throw new Error(`Lost Ark notice fetch failed ${response.status}: ${url}`);
  }

  return response.text();
}

async function main() {
  const fetchedAt = new Date().toISOString();
  const listHtml = await fetchText(NOTICE_LIST_URL);
  const entries = extractNoticeEntries(listHtml).slice(0, 5);
  const results = [];

  for (const entry of entries) {
    const detailHtml = await fetchText(entry.sourceUrl);
    const result = await writeFetchedPatchNote({
      note: {
        title: entry.title,
        sourceUrl: entry.sourceUrl,
        publishedAt: isoDateFromTitle(entry.title),
        fetchedAt,
        body: detailHtml
      }
    });

    results.push({ ...result, title: entry.title });
  }

  for (const result of results) {
    console.log(`${result.action}: ${result.title}`);
  }

  if (!results.length) {
    console.log("No Lost Ark update notices found.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
```

- [ ] **Step 2: Add npm script**

Modify `package.json` scripts:

```json
"rag:fetch": "node scripts/fetch-lostark-patch-notes.mjs"
```

- [ ] **Step 3: Add GitHub Actions workflow**

Create `.github/workflows/fetch-rag-patch-notes.yml`:

```yaml
name: Fetch RAG Patch Notes

on:
  schedule:
    - cron: "15 1 * * 3"
  workflow_dispatch:

permissions:
  contents: write
  pull-requests: write

jobs:
  fetch:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - run: npm run rag:fetch

      - name: Create patch-note review PR
        uses: peter-evans/create-pull-request@v6
        with:
          branch: rag-fetch/${{ github.run_id }}
          title: "docs: fetch Lost Ark patch notes"
          commit-message: "docs: fetch Lost Ark patch notes"
          body: |
            Automated Lost Ark patch-note fetch.

            Review files in `data/rag/inbox/patch-notes/`.
            If valid, move approved files to `data/rag/approved/patch-notes/` and change `status` to `approved`.
          add-paths: |
            data/rag/inbox/patch-notes/**
```

- [ ] **Step 4: Run script syntax check**

Run:

```bash
node --check scripts/fetch-lostark-patch-notes.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit fetch workflow**

```bash
git add scripts/fetch-lostark-patch-notes.mjs .github/workflows/fetch-rag-patch-notes.yml package.json
git commit -m "feat: schedule lostark patch note fetch"
```

## Task 7: Seed Approved Glossary And Formula Docs

**Files:**
- Create: `data/rag/approved/glossary/ark-passive.md`
- Create: `data/rag/approved/formulas/combat-power.md`
- Create: `data/rag/approved/patch-notes/.gitkeep`
- Create: `data/rag/inbox/patch-notes/.gitkeep`

- [ ] **Step 1: Create seed directories and glossary doc**

Create `data/rag/approved/glossary/ark-passive.md`:

```md
---
title: "아크 패시브 용어"
sourceUrl: "local:glossary/ark-passive"
publishedAt: "2026-05-27"
status: approved
category: glossary
---

# 깨달음

깨달음은 직업 특성과 직업별 핵심 효과에 가까운 아크 패시브 포인트다.

# 진화

진화는 공용 전투 성능과 전투 스타일 선택에 가까운 아크 패시브 포인트다.

# 도약

도약은 초각성 스킬과 초각성기 쪽 성장에 연결되는 아크 패시브 포인트다.
```

- [ ] **Step 2: Create formula doc**

Create `data/rag/approved/formulas/combat-power.md`:

```md
---
title: "전투력 계산 기준"
sourceUrl: "local:docs/lostark-damage-formula"
publishedAt: "2026-05-27"
status: approved
category: formula
---

# 전투력 시작식

현재 프로젝트의 전투력 모델은 주스탯과 무기 공격력 기반 시작식에서 출발한다. 전투력은 직접 최종 피해량이 아니라 인게임 표시 전투력을 근사하기 위한 점수 모델이다.

# 효율 추천

스펙업 효율 추천은 전투력 상승률과 예상 골드 비용을 함께 본다. 경매장이나 거래소 시세가 부족하면 후보 신뢰도가 낮아질 수 있다.
```

- [ ] **Step 3: Add patch-note directory keep files**

Create empty files:

```bash
mkdir -p data/rag/approved/patch-notes data/rag/inbox/patch-notes
touch data/rag/approved/patch-notes/.gitkeep data/rag/inbox/patch-notes/.gitkeep
```

- [ ] **Step 4: Verify seeded docs are retrievable**

Run:

```bash
npm test -- tests/ragDocuments.test.js tests/ragRetriever.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit seed docs**

```bash
git add data/rag/approved/glossary/ark-passive.md data/rag/approved/formulas/combat-power.md data/rag/approved/patch-notes/.gitkeep data/rag/inbox/patch-notes/.gitkeep
git commit -m "docs: add seed rag documents"
```

## Task 8: Final Verification

**Files:**
- No source changes.

- [ ] **Step 1: Run focused RAG and consultant tests**

Run:

```bash
npm test -- tests/ragDocuments.test.js tests/ragRetriever.test.js tests/lostarkPatchNotesCrawler.test.js tests/sgguPrompt.test.js tests/sgguConsultApi.test.js
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 3: Run touched-file lint**

Run:

```bash
node node_modules/eslint/bin/eslint.js scripts/fetch-lostark-patch-notes.mjs lib/rag/ragDocuments.js lib/rag/retriever.js lib/rag/lostarkPatchNotes.js lib/consultant/sgguPrompt.js app/api/consult/sggu/route.js tests/ragDocuments.test.js tests/ragRetriever.test.js tests/lostarkPatchNotesCrawler.test.js tests/sgguPrompt.test.js tests/sgguConsultApi.test.js
```

Expected: no output and exit code 0.

- [ ] **Step 4: Run production build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Run local smoke test**

Start Ollama and the dev server, then run:

```bash
npm run smoke:sggu
```

Expected: PASS with `Sggu consult smoke OK`.

- [ ] **Step 6: Note full lint limitation**

Run full lint only after `.worktrees/**/.next` is ignored:

```bash
npm run lint
```

Expected before ignore fix: may fail on generated `.worktrees/**/.next` files unrelated to this feature.

- [ ] **Step 7: Commit final verification note if docs changed**

If implementation added a development-log entry, commit it:

```bash
git add docs/development-log.md
git commit -m "docs: record sggu rag verification"
```

If no docs changed, skip this commit.

## Self-Review

Spec coverage:

- Automatic Wednesday 10:15 KST fetch: Task 6 workflow cron `15 1 * * 3`.
- Human approval gate: Tasks 5 and 6 write to inbox only; Task 1 runtime loader reads approved only.
- Patch-note metadata and `changeType`: Task 5.
- `no-update` classification: Task 5 tests and classifier.
- Glossary and formula local docs: Task 7.
- Approved-only keyword retrieval: Tasks 1 and 2.
- Prompt `[참고 문서]` injection: Task 3.
- Consult API retrieval integration and fallback on failure: Task 4.
- Runtime works with empty approved directory: Task 1 loader and Task 4 fallback behavior.
- Verification commands: Task 8.

Placeholder scan:

- No forbidden placeholder markers or unspecified implementation steps remain.
- Every new file has concrete code or concrete file content.
- Every test step has exact commands and expected result.

Type consistency:

- Document metadata uses `title`, `sourceUrl`, `publishedAt`, `status`, `category`, `changeType`, and `summary`.
- Retriever references use `title`, `category`, `changeType`, `publishedAt`, `sourceUrl`, `sectionTitle`, `citationLabel`, `text`, and `score`.
- Prompt accepts `references`.
- Route helper accepts `{ body, retrieveReferences }` and returns chat messages.
