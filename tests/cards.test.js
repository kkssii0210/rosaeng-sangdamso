import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCards } from "../lib/lostark/cards.js";

test("normalizes equipped cards and active card effects from official API shape", () => {
  const normalized = normalizeCards({
    Cards: [
      {
        Slot: 0,
        Name: "유적을 찾은 카단",
        Icon: "https://cdn-lostark.game.onstove.com/card.png",
        AwakeCount: 3,
        AwakeTotal: 5,
        Grade: "전설",
        Tooltip: "raw tooltip should not be returned"
      },
      {
        Slot: 1,
        Name: "각성한 진저웨일",
        Icon: "https://cdn-lostark.game.onstove.com/card2.png",
        AwakeCount: 5,
        AwakeTotal: 5,
        Grade: "전설"
      }
    ],
    Effects: [
      {
        Index: 0,
        CardSlots: [0, 1],
        Items: [
          {
            Name: "굳센 대지의 숨결 2세트",
            Description: "뇌속성 피해 감소 +10.00%"
          },
          {
            Name: "굳센 대지의 숨결 6세트 (12각성합계)",
            Description: "공격 속성을 토속성으로 변환"
          },
          {
            Name: "굳센 대지의 숨결 6세트 (18각성합계)",
            Description: "토속성 피해 +7.00%"
          }
        ]
      }
    ]
  });

  assert.equal(normalized.AwakeTotal, 8);
  assert.deepEqual(normalized.Cards[0], {
    Slot: 0,
    Name: "유적을 찾은 카단",
    Icon: "https://cdn-lostark.game.onstove.com/card.png",
    Grade: "전설",
    AwakeCount: 3,
    AwakeTotal: 5
  });
  assert.equal("Tooltip" in normalized.Cards[0], false);
  assert.equal(normalized.Effects[0].SetName, "굳센 대지의 숨결");
  assert.deepEqual(
    normalized.ActiveEffects.map((item) => [item.Name, item.SetCount, item.AwakeTotal, item.Kind, item.Value ?? null, item.Element ?? item.DamageType ?? ""]),
    [
      ["굳센 대지의 숨결 2세트", 2, null, "damageReduction", 10, "뇌속성"],
      ["굳센 대지의 숨결 6세트 (12각성합계)", 6, 12, "elementConversion", null, "토"],
      ["굳센 대지의 숨결 6세트 (18각성합계)", 6, 18, "elementDamage", 7, "토"]
    ]
  );
});
