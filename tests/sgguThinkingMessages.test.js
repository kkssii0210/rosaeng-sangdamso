import test from "node:test";
import assert from "node:assert/strict";
import { pickSgguThinkingMessage, sgguThinkingMessages } from "../lib/ui/sgguThinkingMessages.js";

test("defines Sggu thinking bubble messages", () => {
  assert.deepEqual(sgguThinkingMessages, ["슥...", "귀찮은놈...", "빨리 좀 가라..."]);
});

test("picks a thinking bubble message with an injectable random source", () => {
  assert.equal(pickSgguThinkingMessage(() => 0), "슥...");
  assert.equal(pickSgguThinkingMessage(() => 0.4), "귀찮은놈...");
  assert.equal(pickSgguThinkingMessage(() => 0.9), "빨리 좀 가라...");
});