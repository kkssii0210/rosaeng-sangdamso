import test from "node:test";
import assert from "node:assert/strict";
import {
  appendAssistantMessage,
  appendErrorMessage,
  appendUserMessage,
  buildConsultRequestBody,
  createInitialConsultMessages,
  getConsultErrorMessage,
  getConsultDisplayText
} from "../lib/ui/sgguConsultantState.js";

test("creates lookup mode starter message", () => {
  assert.deepEqual(createInitialConsultMessages(), [
    { role: "sggu", text: "캐릭터명을 입력해봐. 공식 API 기준으로 장비, 아크패시브, 스킬부터 정리해줄게." }
  ]);
});

test("appends user and assistant messages", () => {
  const messages = createInitialConsultMessages();
  const afterUser = appendUserMessage(messages, "뭐부터 올려?");
  const afterAssistant = appendAssistantMessage(afterUser, "목걸이부터 봐.");

  assert.equal(afterUser.at(-1).role, "user");
  assert.equal(afterAssistant.at(-1).text, "목걸이부터 봐.");
});

test("limits transcript size and appends errors", () => {
  const messages = Array.from({ length: 20 }, (_, index) => ({ role: "user", text: `m${index}` }));
  const next = appendErrorMessage(messages, "실패");

  assert.equal(next.length, 12);
  assert.equal(next.at(-1).role, "error");
  assert.equal(next.at(-1).text, "실패");
});

test("maps local llm unavailable errors to sleeping Sggu copy", () => {
  assert.equal(
    getConsultErrorMessage({
      code: "LOCAL_LLM_UNAVAILABLE",
      message: "로컬 LLM 서버에 연결하지 못했어. Ollama가 켜져 있는지 확인해줘."
    }),
    "현재 슥구가 자고있슥니다."
  );
});

test("builds compact consult request body without raw armory payload", () => {
  const body = buildConsultRequestBody({
    message: "뭐부터 올려?",
    conversation: [{ role: "sggu", text: "장비를 봤어." }],
    armory: {
      profile: {
        CharacterName: "붐버",
        CharacterClassName: "스카우터"
      },
      equipment: [
        { Type: "무기", Name: "+11 세르카 고대 무기", Tooltip: "raw tooltip should stay client-side" }
      ]
    },
    specUpRecommendation: {
      Recommendation: {
        TopCandidates: [{ Label: "무기 11->12", GainPercent: 0.3 }]
      }
    }
  });

  assert.equal(body.message, "뭐부터 올려?");
  assert.equal(body.mode, "main-chat");
  assert.deepEqual(body.conversation, [{ role: "sggu", text: "장비를 봤어." }]);
  assert.equal(body.armory, undefined);
  assert.equal(body.specUpRecommendation, undefined);
  assert.equal(body.context.profile.characterName, "붐버");
  assert.equal(body.context.keyEquipment[0].name, "+11 세르카 고대 무기");
  assert.equal(body.context.topSpecUps[0].label, "무기 11->12");
  assert.doesNotMatch(JSON.stringify(body), /raw tooltip/);
});

test("builds consult request body with explicit mode", () => {
  const body = buildConsultRequestBody({
    message: "효율 요약해줘",
    mode: "efficiency-summary"
  });

  assert.equal(body.mode, "efficiency-summary");
});

test("extracts structured display text before legacy answers", () => {
  assert.equal(
    getConsultDisplayText({
      DisplayText: " 지금은 보석부터 보는 게 좋아. ",
      Answer: "legacy answer"
    }),
    "지금은 보석부터 보는 게 좋아."
  );
  assert.equal(getConsultDisplayText({ DisplayText: " ", Answer: " legacy answer " }), "legacy answer");
  assert.equal(getConsultDisplayText({ DisplayText: "", Answer: "" }), "");
  assert.equal(getConsultDisplayText(null), "");
});
