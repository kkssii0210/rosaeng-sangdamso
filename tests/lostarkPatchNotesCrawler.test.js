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

test("skips duplicate html body using cleaned body hash", async () => {
  const rootDir = await tempRoot();
  const note = {
    title: "5월 27일(수) 업데이트 내역 안내",
    sourceUrl: "https://lostark.game.onstove.com/News/Notice/Views/13001",
    publishedAt: "2026-05-27",
    fetchedAt: "2026-05-27T01:15:00.000Z",
    body: "<p>일부 오류를 수정하였습니다.</p>"
  };

  const first = await writeFetchedPatchNote({ rootDir, note });
  const second = await writeFetchedPatchNote({ rootDir, note });

  assert.equal(first.action, "written");
  assert.equal(second.action, "skipped");
});

test("uses Korean title date for inbox file slug", async () => {
  const rootDir = await tempRoot();
  const result = await writeFetchedPatchNote({
    rootDir,
    note: {
      title: "5월 27일(수) 업데이트 내역 안내",
      sourceUrl: "https://lostark.game.onstove.com/News/Notice/Views/13001",
      publishedAt: "2026-05-28",
      fetchedAt: "2026-05-27T01:15:00.000Z",
      body: "일부 오류를 수정하였습니다."
    }
  });

  assert.equal(path.basename(result.filePath), "2026-05-27-update.md");
});

test("matches existing unquoted source url frontmatter", async () => {
  const rootDir = await tempRoot();
  await mkdir(path.join(rootDir, "data/rag/approved/patch-notes"), { recursive: true });
  await writeFile(path.join(rootDir, "data/rag/approved/patch-notes/2026-05-27-update.md"), `---
title: "5월 27일(수) 업데이트 내역 안내"
sourceUrl: https://lostark.game.onstove.com/News/Notice/Views/13001
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
  assert.equal(path.basename(result.filePath), "2026-05-27-update-revision.md");
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
