import assert from "node:assert/strict";
import test from "node:test";

import { buildAccessoryEfficiencyRecommendation } from "../lib/spec/accessoryEfficiencySimulation.js";

function attackStat({ basic, increase = 0, total = basic + increase }) {
  return {
    Type: "공격력",
    Value: String(total),
    Tooltip: [
      `힘, 민첩, 지능과 무기 공격력을 기반으로 증가한 기본 공격력은 <font color='#99ff99'>${basic}</font> 입니다.`,
      `공격력 증감 효과로 공격력이 <font color='#99ff99'>${increase}</font> 증가되었습니다.`
    ]
  };
}

function ring(lines, index) {
  return {
    Type: "반지",
    Name: `테스트 반지 ${index}`,
    DetailSections: [
      {
        title: "연마 효과",
        lines
      }
    ]
  };
}

function candidateRing(targetEquipmentIndex) {
  return {
    Type: "반지",
    Name: "후보 반지",
    BuyPrice: 1000,
    TargetEquipmentIndex: targetEquipmentIndex,
    DetailSections: [
      {
        title: "연마 효과",
        lines: ["치명타 피해 +2.40%"]
      }
    ]
  };
}

const baseProfile = {
  CombatPower: "1000000",
  CharacterClassName: "블래스터",
  CharacterLevel: 70,
  Stats: [
    attackStat({ basic: 100000 }),
    { Type: "치명", Value: "1000" }
  ]
};

const baseEquipment = [
  {
    Type: "무기",
    WeaponStats: {
      WeaponPower: {
        Value: 100000
      }
    }
  },
  ring(["치명타 피해 +4.00%"], 1),
  ring(["치명타 피해 +1.10%"], 2)
];

test("slot-scoped accessory candidates only replace their source equipment slot", () => {
  const weakerThanTarget = buildAccessoryEfficiencyRecommendation({
    profile: baseProfile,
    equipment: baseEquipment,
    candidates: [candidateRing(1)],
    criticalStats: {
      GlobalCriticalRatePercent: 70
    }
  });
  const strongerThanTarget = buildAccessoryEfficiencyRecommendation({
    profile: baseProfile,
    equipment: baseEquipment,
    candidates: [candidateRing(2)],
    criticalStats: {
      GlobalCriticalRatePercent: 70
    }
  });

  assert.equal(weakerThanTarget.Status, "noRecommendation");
  assert.equal(strongerThanTarget.Status, "ready");
  assert.equal(strongerThanTarget.TopRecommendation.ReplacedEquipmentIndex, 2);
  assert.equal(strongerThanTarget.TopRecommendation.MainStatName, "민첩");
});
