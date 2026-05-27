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
