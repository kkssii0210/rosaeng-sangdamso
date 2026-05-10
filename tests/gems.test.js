import test from "node:test";
import assert from "node:assert/strict";
import { normalizeGems } from "../lib/lostark/gems.js";
import { cooldownGemSample, damageGemSample } from "./fixtures/gemSamples.js";

test("normalizes equipped gems with skill and additional effects", () => {
  const normalized = normalizeGems({ Gems: [cooldownGemSample, damageGemSample] });

  assert.equal(normalized.length, 2);
  assert.deepEqual(normalized[0], {
    Slot: 0,
    Name: "10레벨 광휘의 보석",
    Icon: "https://cdn-lostark.game.onstove.com/sample-gem.png",
    Level: 10,
    Grade: "고대",
    SkillName: "글러트니",
    EffectType: "damage",
    EffectTypeText: "피해",
    EffectValue: 44,
    Direction: "증가",
    AdditionalEffects: [{ Name: "기본 공격력", Value: 1.2, Unit: "%", Direction: "증가" }],
    SummaryText: "글러트니 피해 44.00%"
  });
  assert.equal(normalized[1].SkillName, "데스 오더");
  assert.equal(normalized[1].EffectType, "cooldown");
});
