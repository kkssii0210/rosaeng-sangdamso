import test from "node:test";
import assert from "node:assert/strict";
import { buildCombatPowerAnalysis } from "../lib/spec/combatPowerModel.js";

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

test("builds a combat power estimate from base attack and stable factors", () => {
  const analysis = buildCombatPowerAnalysis({
    profile: {
      CharacterLevel: 70,
      Stats: [
        attackStat({ basic: 100000 }),
        { Type: "치명", Value: "100" },
        { Type: "특화", Value: "200" },
        { Type: "신속", Value: "300" }
      ]
    },
    equipment: [
      {
        Type: "무기",
        WeaponStats: {
          AdditionalDamage: {
            Value: 30
          }
        }
      }
    ],
    paradiseOrb: {
      Name: "눈부신 비전의 보주",
      EffectName: "맥스웰 맥시마",
      EffectRole: "attack",
      MaxParadisePower: {
        Value: 48275714,
        Text: "시즌2 달성 최대 낙원력 : 48,275,714"
      }
    }
  });

  assert.equal(analysis.Status, "partial");
  assert.equal(analysis.Formula.BaseScore, 28.8);
  assert.equal(analysis.Formula.Estimate, 59.51);
  assert.equal(analysis.Formula.EstimateFloor, 59);
  assert.equal(analysis.AttackBreakdown.BaseAttackSource, "profileBasicAttackReverse");
  assert.equal(analysis.AttackBreakdown.ProfileBaseAttackBeforeBasicPercent, 100000);
  assert.equal(analysis.ParadisePower.Value, 48275714);
  assert.equal(analysis.Factors.find((item) => item.Id === "paradise-orb").Percent, 4.06206);
  assert.equal(analysis.CategorySummary.find((item) => item.Category === "combatStats").Percent, 18);
});

test("uses equipment formula as pure base fallback without double-dividing basic attack percent", () => {
  const analysis = buildCombatPowerAnalysis({
    profile: {
      CharacterLevel: 70,
      Stats: [{ Type: "치명", Value: "0" }]
    },
    equipment: [
      {
        Type: "무기",
        Name: "테스트 무기",
        WeaponStats: {
          WeaponPower: {
            Value: 600
          }
        }
      },
      {
        Type: "투구",
        MainStatValue: 60000
      },
      {
        Type: "어빌리티 스톤",
        Name: "테스트 스톤",
        AbilityStone: {
          Effects: [
            {
              Title: "레벨 보너스",
              Lines: ["기본 공격력 +10.00%"]
            }
          ]
        }
      }
    ]
  });

  assert.equal(analysis.Status, "partial");
  assert.equal(analysis.AttackBreakdown.BaseAttackSource, "equipmentFormula");
  assert.equal(analysis.AttackBreakdown.EquipmentMainStatTotal, 60000);
  assert.equal(analysis.AttackBreakdown.EquipmentWeaponPower, 600);
  assert.equal(analysis.AttackBreakdown.EquipmentFormulaBaseAttackPower, 2449.49);
  assert.equal(analysis.AttackBreakdown.BaseAttackBeforeBasicPercent, 2449.49);
  assert.equal(analysis.AttackBreakdown.SelectedBasicAttackPower, 2694.44);
  assert.equal(analysis.AttackBreakdown.BasicAttackPercent, 10);
  assert.equal(analysis.Formula.BaseScore, 0.71);
  assert.equal(analysis.CategorySummary.find((item) => item.Category === "baseAttack").Percent, 10);
  assert.ok(analysis.MissingInputs.some((item) => item.includes("장비식 순수공 fallback 사용")));
});

test("adds weapon-power percent sources additively before the equipment base attack formula", () => {
  const analysis = buildCombatPowerAnalysis({
    profile: {
      CharacterLevel: 70,
      Stats: [{ Type: "치명", Value: "0" }]
    },
    equipment: [
      {
        Type: "무기",
        Name: "운명의 전율 런처",
        WeaponStats: {
          WeaponPower: {
            Value: 229737
          }
        }
      },
      {
        Type: "목걸이",
        MainStatValue: 68344
      },
      {
        Type: "귀걸이",
        DetailSections: [
          {
            title: "연마 효과",
            lines: ["무기 공격력 +1.80%"]
          }
        ]
      },
      {
        Type: "귀걸이",
        DetailSections: [
          {
            title: "연마 효과",
            lines: ["무기 공격력 +0.80%"]
          }
        ]
      }
    ],
    arkPassive: {
      Points: [
        { Name: "깨달음", Value: 40, Description: "6랭크 25레벨" }
      ],
      Effects: []
    }
  });

  assert.equal(analysis.AttackBreakdown.EquipmentWeaponPower, 229737);
  assert.equal(analysis.AttackBreakdown.EquipmentWeaponPowerPercent, 5.1);
  assert.deepEqual(
    analysis.AttackBreakdown.EquipmentWeaponPowerPercentSources.map((item) => [item.SourceName, item.Percent]),
    [
      ["깨달음 카르마 레벨", 2.5],
      ["귀걸이", 1.8],
      ["귀걸이", 0.8]
    ]
  );
  assert.equal(analysis.AttackBreakdown.EquipmentEffectiveWeaponPower, 241453.59);
  assert.equal(analysis.AttackBreakdown.EquipmentEffectiveWeaponPowerDisplay, 241453);
  assert.equal(analysis.AttackBreakdown.EquipmentFormulaBaseAttackPower, 52443.47);
});

test("uses support paradise orb combat power formula", () => {
  const analysis = buildCombatPowerAnalysis({
    profile: {
      CharacterLevel: 70,
      Stats: [attackStat({ basic: 100000 })]
    },
    paradiseOrb: {
      Name: "투영의 보주",
      EffectName: "투영",
      EffectRole: "support",
      MaxParadisePower: {
        Value: 1000000,
        Text: "시즌2 달성 최대 낙원력 : 1,000,000"
      }
    }
  });
  const factor = analysis.Factors.find((item) => item.Id === "paradise-orb");

  assert.equal(factor.Label, "보조형 보주");
  assert.equal(factor.Percent, 0.1944);
  assert.equal(factor.BasisPoints, 19.44);
});

test("keeps decimal combat power while exposing Lostark floor display value", () => {
  const analysis = buildCombatPowerAnalysis({
    profile: {
      CharacterLevel: 70,
      CombatPower: "854.93",
      Stats: [attackStat({ basic: 100000 })]
    }
  });

  assert.equal(analysis.OfficialCombatPower, 854.93);
  assert.equal(analysis.OfficialCombatPowerFloor, 854);
  assert.equal(analysis.Formula.Estimate, 37.28);
  assert.equal(analysis.Formula.EstimateFloor, 37);
  assert.equal(analysis.Formula.DeltaFromOfficialFloor, -817);
});

test("adds tier 4 pure combat power factors for normal gems", () => {
  const analysis = buildCombatPowerAnalysis({
    profile: {
      CharacterLevel: 70,
      Stats: [attackStat({ basic: 100000 })]
    },
    gems: [
      { Name: "1레벨 겁화의 보석", Level: 1, AdditionalEffects: [{ Name: "기본 공격력", Value: 0.1 }] },
      { Name: "10레벨 겁화의 보석", Level: 10, AdditionalEffects: [{ Name: "기본 공격력", Value: 1.2 }] },
      { Name: "9레벨 작열의 보석", Level: 9, AdditionalEffects: [{ Name: "기본 공격력", Value: 1 }] }
    ]
  });
  const gemFactors = analysis.Factors.filter((item) => item.Category === "gems");
  const gemSummary = analysis.CategorySummary.find((item) => item.Category === "gems");

  assert.deepEqual(gemFactors.map((item) => item.Percent), [1.28, 7.04, 6.4]);
  assert.equal(gemSummary.Percent, 15.35);
  assert.equal(analysis.CategorySummary.find((item) => item.Category === "baseAttack").Percent, 2.3);
});

test("matches observed bomber one-gem combat power ratios", () => {
  const noGemCombatPower = 2467.81;
  const levelTenCombatPower = 2672.78;
  const levelNineCombatPower = 2651.62;
  const stoneBasicPercent = 1.5;
  const levelTenBasicPercent = 1.2;
  const levelNineBasicPercent = 1;
  const levelTenGemPurePercent = 7.04;
  const levelNineGemPurePercent = 6.4;
  const levelTenRatio = ((1 + (stoneBasicPercent + levelTenBasicPercent) / 100) / (1 + stoneBasicPercent / 100))
    * (1 + levelTenGemPurePercent / 100);
  const levelNineRatio = ((1 + (stoneBasicPercent + levelNineBasicPercent) / 100) / (1 + stoneBasicPercent / 100))
    * (1 + levelNineGemPurePercent / 100);

  assert.equal(Math.abs((noGemCombatPower * levelTenRatio) - levelTenCombatPower) < 0.02, true);
  assert.equal(Math.abs((noGemCombatPower * levelNineRatio) - levelNineCombatPower) < 0.02, true);
});

test("adds dealer engraving combat power factors from the measured table", () => {
  const analysis = buildCombatPowerAnalysis({
    profile: {
      CharacterLevel: 70,
      Stats: [attackStat({ basic: 100000 })]
    },
    engravings: [
      { Name: "원한", Grade: "유물", Level: 4 },
      { Name: "예리한 둔기", Grade: "유물", Level: 4, AbilityStoneLevel: 3 },
      { Name: "속전속결", Grade: "유물", Level: 4 },
      { Name: "타격의 대가", Grade: "유물", Level: 4, AbilityStoneLevel: 2 },
      { Name: "아드레날린", Grade: "유물", Level: 4 },
      { Name: "정기 흡수", Grade: "유물", Level: 4 }
    ]
  });
  const engravingFactors = analysis.Factors.filter((item) => item.Category === "engraving");
  const engravingSummary = analysis.CategorySummary.find((item) => item.Category === "engraving");

  assert.deepEqual(
    engravingFactors.map((item) => [item.Label, item.Percent]),
    [
      ["원한 각인", 21],
      ["예리한 둔기 각인", 17],
      ["속전속결 각인", 16.8],
      ["타격의 대가 각인", 17],
      ["아드레날린 각인", 19.4]
    ]
  );
  assert.equal(engravingSummary.Percent, 131);
  assert.equal(analysis.Formula.Estimate, 86.12);
  assert.ok(analysis.MissingInputs.some((item) => item.includes("딜러 유물 각인 반영값 표")));
});

test("uses known legendary engraving overrides where the source lists them", () => {
  const analysis = buildCombatPowerAnalysis({
    profile: {
      CharacterLevel: 70,
      Stats: [attackStat({ basic: 100000 })]
    },
    engravings: [
      { Name: "예리한 둔기", Grade: "전설", Level: 3 },
      { Name: "속전속결", Grade: "전설", Level: 3 },
      { Name: "저주받은 인형", Grade: "전설", Level: 3 },
      { Name: "마나 효율 증가", Grade: "전설", Level: 3 },
      { Name: "에테르 포식자", Grade: "전설", Level: 3 }
    ]
  });

  assert.deepEqual(
    analysis.Factors.filter((item) => item.Category === "engraving").map((item) => item.Percent),
    [14.37, 14.4, 14, 13, 12.6]
  );
});

test("keeps karma but skips ark passive point factors when no nodes are selected", () => {
  const analysis = buildCombatPowerAnalysis({
    profile: {
      CharacterLevel: 70,
      Stats: [attackStat({ basic: 100000 })]
    },
    arkPassive: {
      IsArkPassive: true,
      Points: [
        { Name: "진화", Value: 20, Description: "6랭크 21레벨" },
        { Name: "깨달음", Value: 101, Description: "6랭크 25레벨" },
        { Name: "도약", Value: 52, Description: "6랭크 21레벨" }
      ],
      Effects: []
    }
  });

  assert.equal(analysis.CategorySummary.some((item) => item.Category === "arkPassive"), false);
  assert.equal(analysis.CategorySummary.find((item) => item.Category === "karma").Percent, 4.04);
});

test("normalizes 천우희 combat power inputs and exposes calibration gap", () => {
  const gems = Array.from({ length: 11 }, (_, index) => ({
    Name: `10레벨 광휘의 보석 ${index + 1}`,
    Level: 10,
    AdditionalEffects: [{ Name: "기본 공격력", Value: 1.2 }]
  }));
  const analysis = buildCombatPowerAnalysis({
    profile: {
      CharacterLevel: 70,
      CombatPower: "8,993.54",
      Stats: [
        attackStat({ basic: 228190, increase: 23405, total: 251595 }),
        { Type: "치명", Value: "678" },
        { Type: "특화", Value: "1853" },
        { Type: "신속", Value: "77" }
      ]
    },
    arkPassive: {
      Points: [
        { Name: "진화", Value: 140, Description: "6랭크 28레벨" },
        { Name: "깨달음", Value: 101, Description: "6랭크 30레벨" },
        { Name: "도약", Value: 70, Description: "6랭크 30레벨" }
      ],
      Effects: [
        { Name: "진화", Description: "진화 1티어 치명 Lv.10" },
        { Name: "진화", Description: "진화 1티어 특화 Lv.30" },
        { Name: "진화", Description: "진화 2티어 금단의 주문 Lv.2" }
      ]
    },
    equipment: [
      {
        Type: "무기",
        WeaponStats: {
          AdditionalDamage: {
            Value: 30
          }
        }
      },
      {
        Type: "귀걸이",
        DetailSections: [
          {
            title: "연마 효과",
            lines: ["공격력 +1.55%", "공격력 +390"]
          }
        ]
      },
      {
        Type: "반지",
        DetailSections: [
          {
            title: "연마 효과",
            lines: ["치명타 적중률 +1.55%", "치명타 피해 +4.00%"]
          }
        ]
      },
      {
        Type: "어빌리티 스톤",
        Name: "위대한 비상의 돌",
        AbilityStone: {
          Effects: [
            {
              Title: "레벨 보너스",
              Lines: ["기본 공격력 +1.50%"]
            }
          ]
        }
      }
    ],
    gems
  });

  assert.equal(analysis.OfficialCombatPower, 8993.54);
  assert.equal(analysis.AttackBreakdown.BasicAttackPercent, 14.7);
  assert.equal(analysis.AttackBreakdown.BaseAttackBeforeBasicPercent, 198945.07);
  assert.equal(analysis.AttackBreakdown.BaseAttackSource, "profileBasicAttackReverse");
  assert.equal(analysis.AttackBreakdown.SelectedBasicAttackPower, 228190);
  assert.equal(analysis.AttackBreakdown.AttackIncreasePercent, 10.26);
  assert.equal(analysis.Factors.find((item) => item.Id === "ark-passive-points").Percent, 134);
  assert.equal(analysis.Factors.find((item) => item.Id === "ark-passive-points").Entries[1].Points, 100);
  assert.equal(analysis.Factors.find((item) => item.Id === "ark-passive-points").Entries[1].RawPoints, 101);
  assert.equal(analysis.CategorySummary.find((item) => item.Category === "arkPassive").Percent, 134);
  assert.equal(analysis.Factors.filter((item) => item.Category === "gems").length, 11);
  assert.equal(analysis.CategorySummary.find((item) => item.Category === "gems").Percent, 111.35);
  assert.ok(analysis.MissingInputs.some((item) => item.includes("진화 첫줄 스탯 포인트는 제외")));
  assert.ok(analysis.MissingInputs.some((item) => item.includes("깨달음 전투력 포인트는 최대 100P")));
  assert.ok(analysis.MissingInputs.some((item) => item.includes("일반 스킬 보석은 기본공%와 별도 4티어 레벨별 순수 전투력 계수")));
  assert.equal(analysis.Formula.CalibratedEstimate, 8993.54);
  assert.ok(analysis.Formula.CalibrationRatio > 0);
  assert.ok(analysis.MissingInputs.some((item) => item.includes("각인 정보 없음")));
});

test("adds ark grid core combat power factors", () => {
  const analysis = buildCombatPowerAnalysis({
    profile: {
      CharacterLevel: 70,
      Stats: [
        attackStat({ basic: 100000 }),
        { Type: "치명", Value: "0" },
        { Type: "특화", Value: "0" },
        { Type: "신속", Value: "0" }
      ]
    },
    arkGrid: {
      Slots: [
        { Name: "질서의 달 코어 : 소울 코어", Grade: "고대", Point: 20 },
        { Name: "질서의 해 코어 : 망자의 발걸음", Grade: "유물", Point: 20 },
        { Name: "질서의 별 코어 : 빙의", Grade: "고대", Point: 20 },
        { Name: "혼돈의 해 코어 : 현란한 공격", Grade: "고대", Point: 20 },
        { Name: "혼돈의 달 코어 : 흡수의 일격", Grade: "고대", Point: 20 },
        { Name: "혼돈의 별 코어 : 공격", Grade: "고대", Point: 20 }
      ]
    }
  });
  const arkGridSummary = analysis.CategorySummary.find((item) => item.Category === "arkGrid");

  assert.equal(analysis.Factors.filter((item) => item.Category === "arkGrid").length, 6);
  assert.equal(arkGridSummary.Percent, 39.01);
  assert.ok(analysis.MissingInputs.some((item) => item.includes("질서/혼돈 10/14/17/18/19/20P")));
});

test("models ark grid order point thresholds", () => {
  const points = [10, 14, 17, 18, 19, 20];
  const analysis = buildCombatPowerAnalysis({
    profile: {
      CharacterLevel: 70,
      Stats: [attackStat({ basic: 100000 })]
    },
    arkGrid: {
      Slots: [
        ...points.map((point) => ({ Name: `질서의 해 코어 : 해 ${point}`, Grade: "유물", Point: point })),
        ...points.map((point) => ({ Name: `질서의 달 코어 : 달 ${point}`, Grade: "고대", Point: point })),
        ...points.map((point) => ({ Name: `질서의 별 코어 : 별 ${point}`, Grade: "유물", Point: point })),
        ...points.map((point) => ({ Name: `질서의 별 코어 : 고대별 ${point}`, Grade: "고대", Point: point }))
      ]
    }
  });

  assert.deepEqual(
    analysis.Factors.filter((item) => item.Category === "arkGrid").map((item) => item.Percent),
    [
      1.5, 4, 7.5, 7.67, 7.83, 8,
      1.5, 4, 8.5, 8.67, 8.83, 9,
      1, 2.5, 4.5, 4.67, 4.83, 5,
      1, 2.5, 5.5, 5.67, 5.83, 6
    ]
  );
});

test("models ark grid chaos point thresholds and ancient direct bonuses", () => {
  const points = [10, 14, 17, 18, 19, 20];
  const analysis = buildCombatPowerAnalysis({
    profile: {
      CharacterLevel: 70,
      Stats: [attackStat({ basic: 100000 })]
    },
    arkGrid: {
      Slots: [
        ...points.map((point) => ({ Name: `혼돈의 해 코어 : 현란한 공격`, Grade: "유물", Point: point })),
        { Name: "혼돈의 해 코어 : 현란한 공격", Grade: "고대", Point: 20 },
        { Name: "혼돈의 달 코어 : 흡수의 일격", Grade: "고대", Point: 20 },
        { Name: "혼돈의 별 코어 : 공격", Grade: "고대", Point: 20 },
        { Name: "혼돈의 별 코어 : 무기", Grade: "고대", Point: 20 }
      ]
    }
  });

  assert.deepEqual(
    analysis.Factors.filter((item) => item.Category === "arkGrid").map((item) => item.Percent),
    [0.5, 1, 2.5, 2.67, 2.83, 3, 4, 3, 4, 2.53]
  );
});

test("models ark grid chaos 20P factors", () => {
  const analysis = buildCombatPowerAnalysis({
    profile: {
      CharacterLevel: 70,
      Stats: [attackStat({ basic: 100000 })]
    },
    arkGrid: {
      Slots: [
        { Name: "혼돈의 해 코어 : 현란한 공격", Grade: "유물", Point: 20 },
        { Name: "혼돈의 해 코어 : 안정적인 공격", Grade: "유물", Point: 20 },
        { Name: "혼돈의 해 코어 : 재빠른 공격", Grade: "유물", Point: 20 },
        { Name: "혼돈의 달 코어 : 불타는 일격", Grade: "유물", Point: 20 },
        { Name: "혼돈의 달 코어 : 흡수의 일격", Grade: "유물", Point: 20 },
        { Name: "혼돈의 달 코어 : 부수는 일격", Grade: "유물", Point: 20 },
        { Name: "혼돈의 별 코어 : 공격", Grade: "유물", Point: 20 },
        { Name: "혼돈의 해 코어 : 현란한 공격", Grade: "유물", Point: 19 }
      ]
    }
  });

  assert.deepEqual(
    analysis.Factors.filter((item) => item.Category === "arkGrid").map((item) => item.Percent),
    [3, 2, 2, 3, 2, 2, 3, 2.83]
  );
});

test("converts ark grid gem effects into dealer combat power factors", () => {
  const analysis = buildCombatPowerAnalysis({
    profile: {
      CharacterLevel: 70,
      Stats: [attackStat({ basic: 100000 })]
    },
    arkGrid: {
      Effects: [
        { Name: "공격력", Level: 22, Tooltip: "공격력 <font color='#ffd200'>+0.80%</font>" },
        { Name: "추가 피해", Level: 22, Tooltip: "추가 피해 <font color='#ffd200'>+1.77%</font>" },
        { Name: "보스 피해", Level: 8, Tooltip: "보스 등급 이상 몬스터에게 주는 피해 <font color='#ffd200'>+0.66%</font>" },
        { Name: "무기 공격력", Level: 1, Tooltip: "무기 공격력 <font color='#ffd200'>+2.00%</font>" },
        { Name: "낙인력", Level: 22, Tooltip: "낙인력 <font color='#ffd200'>+3.66%</font>" },
        { Name: "아군 공격 강화", Level: 10, Tooltip: "아군 공격력 강화 효과 <font color='#ffd200'>+1.30%</font>" }
      ]
    }
  });
  const gemFactors = analysis.Factors.filter((item) => item.Category === "arkGridGem");
  const gemSummary = analysis.CategorySummary.find((item) => item.Category === "arkGridGem");

  assert.deepEqual(gemFactors.map((item) => item.Percent), [0.8, 1.36154, 0.66, 0.99505]);
  assert.deepEqual(gemFactors.map((item) => item.SourceName), ["공격력", "추가 피해", "보스 피해", "무기 공격력"]);
  assert.deepEqual(gemFactors.map((item) => item.AppliesToEstimate), [false, false, false, false]);
  assert.equal(gemSummary.Percent, 3.87);
  assert.equal(gemSummary.EstimatePercent, 0);
  assert.equal(analysis.Formula.Estimate, 37.28);
});
