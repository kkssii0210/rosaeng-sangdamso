import test from "node:test";
import assert from "node:assert/strict";
import { normalizeEngravings } from "../lib/lostark/engravings.js";

test("normalizes ark passive engravings with positive efficiency metrics", () => {
  const normalized = normalizeEngravings({
    ArkPassiveEffects: [
      {
        AbilityStoneLevel: 1,
        Grade: "유물",
        Level: 4,
        Name: "저주받은 인형",
        Description: "적에게 주는 피해가 <FONT COLOR='#99ff99'>20.00%</FONT> 증가하지만, 받는 모든 회복 효과가 <FONT COLOR='#ff9999'>25.00%</FONT> 감소한다."
      },
      {
        AbilityStoneLevel: null,
        Grade: "전설",
        Level: 2,
        Name: "약자 무시",
        Description: "생명력이 <FONT COLOR='#ffff99'>30%</FONT> 이하인 적 타격 시 주는 피해가 <FONT COLOR='#99ff99'>22.00%</FONT> 증가한다."
      }
    ]
  });

  assert.deepEqual(normalized, [
    {
      Name: "저주받은 인형",
      Grade: "유물",
      Level: 4,
      AbilityStoneLevel: 1,
      Icon: "https://lostarkcodex.com/icons/buff_237.webp",
      Description: "적에게 주는 피해가 20.00% 증가하지만, 받는 모든 회복 효과가 25.00% 감소한다.",
      EfficiencyText: "20.00%",
      Metrics: ["20.00%"]
    },
    {
      Name: "약자 무시",
      Grade: "전설",
      Level: 2,
      AbilityStoneLevel: null,
      Icon: "https://lostarkcodex.com/icons/achieve_04_30.webp",
      Description: "생명력이 30% 이하인 적 타격 시 주는 피해가 22.00% 증가한다.",
      EfficiencyText: "22.00%",
      Metrics: ["22.00%"]
    }
  ]);
});
