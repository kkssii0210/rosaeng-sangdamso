import test from "node:test";
import assert from "node:assert/strict";
import { buildSpecUpRecommendation } from "../lib/spec/specUpRecommendation.js";

test("builds unified top five recommendations from accessories and upgrades", () => {
  const recommendation = buildSpecUpRecommendation({
    accessoryRecommendation: {
      Status: "ready",
      Comparisons: [
        {
          Type: "accessory",
          Candidate: { Name: "효율 반지", Type: "반지" },
          ReplacedAccessory: { Name: "현재 반지", Type: "반지" },
          BuyPrice: 100000,
          CombatPowerGainPercent: 1
        }
      ]
    },
    upgradeEfficiency: {
      MarketDataStatus: "ready",
      Candidates: [
        {
          Id: "weapon-11-12",
          Type: "weaponHoning",
          Label: "무기 11->12",
          CostGold: 500000,
          NetCostGold: 500000,
          GainPercent: 1,
          GainType: "combatPower",
          EfficiencyScore: 0.2,
          ScoreUnit: "전투력 % / 10만 골드"
        },
        {
          Id: "armor-head-11-12",
          Type: "armorHoning",
          Label: "투구 11->12",
          CostGold: 100000,
          NetCostGold: 100000,
          GainPercent: 0.5,
          GainType: "combatPower",
          EfficiencyScore: 0.5,
          ScoreUnit: "전투력 % / 10만 골드"
        }
      ]
    }
  });

  assert.equal(recommendation.Status, "ready");
  assert.deepEqual(
    recommendation.TopCandidates.map((candidate) => candidate.Type),
    ["accessory", "armorHoning", "weaponHoning"]
  );
  assert.equal(recommendation.TopCandidates[0].EfficiencyScore, 1);
  assert.equal(recommendation.TopCandidates[0].Label, "반지 교체");
});
