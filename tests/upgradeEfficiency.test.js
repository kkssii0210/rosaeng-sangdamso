import test from "node:test";
import assert from "node:assert/strict";
import { buildUpgradeEfficiency } from "../lib/spec/upgradeEfficiency.js";

const marketSnapshot = {
  updatedAt: "2026-05-12T12:00:00.000Z",
  groups: [
    {
      id: "honing-materials",
      items: [
        {
          name: "운명의 파괴석",
          grade: "일반",
          currentMinPrice: 300,
          bundleCount: 100,
          recentPrice: 298,
          yesterdayAveragePrice: 301
        }
      ]
    },
    {
      id: "honing-supports",
      items: []
    },
    {
      id: "legendary-avatars",
      items: [
        {
          categoryName: "머리",
          name: "전설 머리",
          currentMinPrice: 50000
        },
        {
          categoryName: "상의",
          name: "전설 상의",
          currentMinPrice: 60000
        }
      ]
    },
    {
      id: "accessories",
      items: [
        {
          categoryName: "목걸이",
          name: "고대 목걸이",
          currentMinPrice: 1000
        }
      ]
    },
    {
      id: "gems",
      items: [
        {
          name: "7레벨 겁화의 보석",
          currentMinPrice: 100000,
          gemLevel: 7,
          gemEffectType: "damage",
          gemEffectValue: 24
        },
        {
          name: "8레벨 겁화의 보석",
          currentMinPrice: 200000,
          gemLevel: 8,
          gemEffectType: "damage",
          gemEffectValue: 30
        }
      ]
    }
  ]
};

test("builds spec-up efficiency candidates from market cost inputs", () => {
  const efficiency = buildUpgradeEfficiency({
    marketSnapshot,
    equipment: [],
    profile: {},
    criticalStats: null,
    avatars: [
      {
        Type: "무기 아바타",
        IsStatApplied: true,
        StatEffects: [{ Stat: "힘", Value: 2 }]
      }
    ],
    gems: [
      {
        Slot: 0,
        Name: "7레벨 겁화의 보석",
        Level: 7,
        SkillName: "라이징 스피어",
        EffectType: "damage",
        EffectValue: 24
      }
    ]
  });

  assert.equal(efficiency.MarketDataStatus, "ready");
  assert.equal(efficiency.CostInputs.Honing.Materials[0].UnitPrice, 3);
  assert.equal(efficiency.CostInputs.Accessories.FloorPrices[0].FloorPrice, 1000);
  assert.equal(efficiency.Candidates[0].Type, "gem");
  assert.equal(efficiency.Candidates[0].NetCostGold, 100000);
  assert.equal(efficiency.Candidates[0].GainPercent, 6);
  assert.equal(efficiency.Candidates[0].EfficiencyScore, 6);
  assert.equal(efficiency.Candidates[1].Type, "legendaryAvatar");
  assert.equal(efficiency.Candidates[1].GainPercent, 2);
  assert.equal(efficiency.Candidates[1].EfficiencyScore, 4);
});
