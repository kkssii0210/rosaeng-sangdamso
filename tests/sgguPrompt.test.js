import test from "node:test";
import assert from "node:assert/strict";
import { buildSgguChatMessages, SGGU_CONSULTANT_SYSTEM_PROMPT } from "../lib/consultant/sgguPrompt.js";

test("system prompt defines grounded Korean Lost Ark consultant behavior", () => {
  assert.match(SGGU_CONSULTANT_SYSTEM_PROMPT, /상담사 슥구/);
  assert.match(SGGU_CONSULTANT_SYSTEM_PROMPT, /제공된 데이터/);
  assert.match(SGGU_CONSULTANT_SYSTEM_PROMPT, /모르면/);
});

test("builds local chat messages with system first and context near current request", () => {
  const messages = buildSgguChatMessages({
    message: "뭐부터 올려?",
    conversation: [{ role: "assistant", content: "장비를 봤어." }],
    context: {
      profile: { characterName: "붐버", className: "스카우터" },
      topSpecUps: [{ label: "무기 11->12", costGold: 100000, gainPercent: 0.3 }]
    }
  });

  assert.equal(messages[0].role, "system");
  assert.equal(messages[1].role, "assistant");
  assert.equal(messages.at(-1).role, "user");
  assert.match(messages.at(-1).content, /캐릭터 데이터/);
  assert.match(messages.at(-1).content, /붐버/);
  assert.match(messages.at(-1).content, /뭐부터 올려\?/);
});

test("handles null options with default context and safe blank question", () => {
  const messages = buildSgguChatMessages(null);

  assert.deepEqual(messages.map(({ role }) => role), ["system", "user"]);
  assert.match(messages.at(-1).content, /\{\}/);
  assert.match(messages.at(-1).content, /\[유저 질문\]\n$/);
  assert.doesNotMatch(messages.at(-1).content, /undefined|null/);
});

test("treats null and non-array conversation as empty", () => {
  for (const conversation of [null, "assistant: hi", { role: "assistant", content: "hi" }]) {
    const messages = buildSgguChatMessages({ message: "질문", conversation });

    assert.deepEqual(messages.map(({ role }) => role), ["system", "user"]);
  }
});

test("filters conversation to Ollama-safe role and content entries", () => {
  const messages = buildSgguChatMessages({
    message: "질문",
    conversation: [
      { role: "assistant", content: "가능한 답변" },
      { role: "user", content: "추가 질문" },
      { role: "system", content: "추가 지시" },
      { role: "tool", content: "도구 결과" },
      { role: "assistant", content: "" },
      { role: "assistant", content: "   " },
      { role: "assistant", content: 123 },
      null,
      "bad entry"
    ]
  });

  assert.deepEqual(messages.slice(1, -1), [
    { role: "assistant", content: "가능한 답변" },
    { role: "user", content: "추가 질문" },
    { role: "system", content: "추가 지시" }
  ]);
});

test("serializes nullish context as empty object", () => {
  for (const context of [undefined, null]) {
    const messages = buildSgguChatMessages({ message: "질문", context });

    assert.match(messages.at(-1).content, /\[캐릭터 데이터\]\n\{\}/);
    assert.doesNotMatch(messages.at(-1).content, /\[캐릭터 데이터\]\n(?:undefined|null)/);
  }
});
