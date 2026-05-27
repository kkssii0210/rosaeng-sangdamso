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
