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

test("normalizes CRLF markdown frontmatter and body", () => {
  const document = parseRagMarkdown([
    "---",
    "title: \"진화\"",
    "sourceUrl: \"local:glossary/evolution\"",
    "publishedAt: \"2026-05-27\"",
    "status: approved",
    "category: glossary",
    "---",
    "",
    "# 진화",
    "",
    "진화는 공용 전투 성능과 관련된다."
  ].join("\r\n"));

  assert.equal(document.meta.title, "진화");
  assert.equal(document.body, "# 진화\n\n진화는 공용 전투 성능과 관련된다.");
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
  await writeFixture(rootDir, "data/rag/approved/formula/damage.md", `---
title: "피해 공식"
sourceUrl: "local:formula/damage"
publishedAt: "2026-05-27"
status: approved
category: formula
---

피해 공식 문서다.
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
  await writeFixture(rootDir, "data/rag/inbox/glossary/approved-but-inbox.md", `---
title: "인박스 승인 메타"
sourceUrl: "local:glossary/inbox"
publishedAt: "2026-05-27"
status: approved
category: glossary
---

승인 메타지만 인박스 문서다.
`);
  await writeFixture(rootDir, "data/rag/approved/glossary/bad.md", `---
title: "분류 없음"
status: approved
---

필수 메타가 부족하다.
`);

  const documents = await loadApprovedRagDocuments({ rootDir });

  assert.deepEqual(documents.map((document) => document.relativePath), [
    "data/rag/approved/formula/damage.md",
    "data/rag/approved/glossary/ark-passive.md"
  ]);
  assert.deepEqual(documents.map((document) => document.id), [
    "formula/damage",
    "glossary/ark-passive"
  ]);
  assert.equal(documents[1].meta.title, "깨달음");
});

test("returns empty documents when approved directory is missing", async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "sggu-rag-missing-"));

  const documents = await loadApprovedRagDocuments({ rootDir });

  assert.deepEqual(documents, []);
});

test("throws non-missing approved directory read errors", async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "sggu-rag-broken-"));

  await writeFixture(rootDir, "data/rag/approved", "not a directory");

  await assert.rejects(
    () => loadApprovedRagDocuments({ rootDir }),
    (error) => error?.code === "ENOTDIR"
  );
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
