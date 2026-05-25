import test from "node:test";
import assert from "node:assert/strict";
import {
  appendAssistantMessage,
  appendErrorMessage,
  appendUserMessage,
  createInitialConsultMessages
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
