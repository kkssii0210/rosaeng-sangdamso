import test from "node:test";
import assert from "node:assert/strict";
import { buildUpgradeEfficiency } from "../lib/spec/upgradeEfficiency.js";

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

const marketSnapshot = {
  updatedAt: "2026-05-12T12:00:00.000Z",
  groups: [
    {
      id: "honing-materials",
      items: [
        {
          name: "운명의 파괴석 결정",
          grade: "일반",
          currentMinPrice: 1688,
          bundleCount: 100,
          recentPrice: 1670,
          yesterdayAveragePrice: 1700
        },
        {
          name: "운명의 수호석 결정",
          grade: "일반",
          currentMinPrice: 50,
          bundleCount: 100,
          recentPrice: 48,
          yesterdayAveragePrice: 49
        },
        {
          name: "위대한 운명의 돌파석",
          grade: "희귀",
          currentMinPrice: 14,
          bundleCount: 1,
          recentPrice: 15,
          yesterdayAveragePrice: 14
        },
        {
          name: "상급 아비도스 융화 재료",
          grade: "영웅",
          currentMinPrice: 142,
          bundleCount: 1,
          recentPrice: 140,
          yesterdayAveragePrice: 141
        },
        {
          name: "운명의 파편 주머니(소)",
          grade: "희귀",
          currentMinPrice: 60,
          bundleCount: 1,
          recentPrice: 70,
          yesterdayAveragePrice: 68
        },
        {
          name: "운명의 파편 주머니(대)",
          grade: "영웅",
          currentMinPrice: 173,
          bundleCount: 1,
          recentPrice: 174,
          yesterdayAveragePrice: 172
        }
      ]
    },
    {
      id: "honing-supports",
      items: [
        {
          name: "용암의 숨결",
          grade: "영웅",
          currentMinPrice: 365,
          bundleCount: 1,
          recentPrice: 360,
          yesterdayAveragePrice: 362
        },
        {
          name: "빙하의 숨결",
          grade: "영웅",
          currentMinPrice: 290,
          bundleCount: 1,
          recentPrice: 288,
          yesterdayAveragePrice: 291
        }
      ]
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
    equipment: [
      {
        Type: "무기",
        Name: "+11 세르카 고대 무기",
        WeaponStats: {
          WeaponPower: {
            Value: 167706
          }
        }
      },
      {
        Type: "투구",
        Name: "+11 세르카 고대 투구",
        MainStatValue: 96801
      },
      {
        Type: "어깨",
        Name: "+11 세르카 고대 어깨",
        MainStatValue: 103023
      },
      {
        Type: "상의",
        Name: "+11 세르카 고대 상의",
        MainStatValue: 77441
      },
      {
        Type: "하의",
        Name: "+11 세르카 고대 하의",
        MainStatValue: 83664
      },
      {
        Type: "장갑",
        Name: "+11 세르카 고대 장갑",
        MainStatValue: 116161
      }
    ],
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
  const weaponMaterials = efficiency.CostInputs.Honing.WeaponMaterials;
  const findWeaponMaterial = (name) => weaponMaterials.find((item) => item.Name === name);

  assert.deepEqual(weaponMaterials.map((item) => item.Name), [
    "운명의 파괴석 결정",
    "위대한 운명의 돌파석",
    "상급 아비도스 융화제",
    "운명의 파편",
    "용암의 숨결"
  ]);
  assert.equal(findWeaponMaterial("운명의 파괴석 결정").UnitPrice, 16.88);
  assert.equal(findWeaponMaterial("상급 아비도스 융화제").SourceName, "상급 아비도스 융화 재료");
  assert.equal(findWeaponMaterial("운명의 파편").MarketOptions.length, 2);
  assert.equal(findWeaponMaterial("용암의 숨결").IsAdditionalMaterial, true);
  assert.equal(efficiency.CostInputs.Honing.ArmorMaterials.find((item) => item.Name === "운명의 수호석 결정").UnitPrice, 0.5);
  assert.equal(efficiency.CostInputs.Accessories.FloorPrices[0].FloorPrice, 1000);
  assert.equal(efficiency.Candidates.some((candidate) => candidate.Type === "weaponHoning"), true);
  assert.equal(efficiency.Candidates.some((candidate) => candidate.Type === "armorHoning"), true);
  assert.equal(efficiency.Candidates.find((candidate) => candidate.Type === "weaponHoning").GainType, "combatPower");
});

test("builds gem candidates from auction floor price and combat power delta", () => {
  const efficiency = buildUpgradeEfficiency({
    marketSnapshot,
    equipment: [],
    profile: {
      CharacterLevel: 70,
      Stats: [attackStat({ basic: 100000 })]
    },
    gems: [
      {
        Slot: 0,
        Name: "7레벨 겁화의 보석",
        Level: 7,
        SkillName: "라이징 스피어",
        EffectType: "damage",
        EffectValue: 24,
        AdditionalEffects: [{ Name: "기본 공격력", Value: 0.6 }]
      }
    ],
    combatContext: {
      gems: [
        {
          Slot: 0,
          Name: "7레벨 겁화의 보석",
          Level: 7,
          SkillName: "라이징 스피어",
          EffectType: "damage",
          EffectValue: 24,
          AdditionalEffects: [{ Name: "기본 공격력", Value: 0.6 }]
        }
      ]
    }
  });
  const gemCandidate = efficiency.Candidates.find((candidate) => candidate.Type === "gem");

  assert.equal(gemCandidate.Label, "라이징 스피어 7->8");
  assert.equal(gemCandidate.NetCostGold, 100000);
  assert.equal(gemCandidate.GainType, "combatPower");
  assert.equal(gemCandidate.ScoreUnit, "전투력 % / 10만 골드");
  assert.equal(gemCandidate.CurrentLevel, 7);
  assert.equal(gemCandidate.TargetLevel, 8);
  assert.equal(gemCandidate.GainPercent > 0, true);
  assert.notEqual(gemCandidate.GainPercent, 6);
});

test("builds legendary avatar candidates when current avatar is heroic", () => {
  const efficiency = buildUpgradeEfficiency({
    marketSnapshot,
    equipment: [],
    profile: {},
    avatars: [
      {
        Type: "머리 아바타",
        Grade: "영웅",
        IsStatApplied: true,
        StatEffects: [{ Stat: "민첩", Value: 1 }]
      },
      {
        Type: "상의 아바타",
        Grade: "전설",
        IsStatApplied: true,
        StatEffects: [{ Stat: "민첩", Value: 2 }]
      }
    ]
  });
  const headAvatarCandidate = efficiency.Candidates.find((candidate) => (
    candidate.Type === "legendaryAvatar" && candidate.Target === "머리"
  ));

  assert.equal(headAvatarCandidate.Label, "전설 아바타 머리");
  assert.equal(headAvatarCandidate.NetCostGold, 50000);
  assert.equal(headAvatarCandidate.GainPercent, 1);
  assert.equal(headAvatarCandidate.GainType, "mainStatPercent");
  assert.equal(
    efficiency.Candidates.some((candidate) => candidate.Type === "legendaryAvatar" && candidate.Target === "상의"),
    false
  );
});

test("uses class-specific legendary avatar prices when supplied", () => {
  const efficiency = buildUpgradeEfficiency({
    marketSnapshot,
    equipment: [],
    profile: {},
    avatars: [
      {
        Type: "머리 아바타",
        Grade: "영웅",
        IsStatApplied: true,
        StatEffects: [{ Stat: "민첩", Value: 1 }]
      }
    ],
    legendaryAvatarPrices: [
      {
        Slot: "머리",
        ClassName: "스카우터",
        Name: "전설 스카우터 머리",
        CurrentMinPrice: 250000,
        UnitPrice: 250000,
        IsAvailable: true
      }
    ]
  });
  const headAvatarCandidate = efficiency.Candidates.find((candidate) => (
    candidate.Type === "legendaryAvatar" && candidate.Target === "머리"
  ));

  assert.equal(headAvatarCandidate.NetCostGold, 250000);
  assert.equal(headAvatarCandidate.Label, "스카우터 전설 아바타 머리");
  assert.equal(headAvatarCandidate.CostDetail.ClassName, "스카우터");
  assert.equal(headAvatarCandidate.CostDetail.Source, "classSpecific");
  assert.equal(efficiency.CostInputs.LegendaryAvatars.find((item) => item.Slot === "머리").SampleName, "전설 스카우터 머리");
});

test("builds engraving book candidates from current engravings and five-book prices", () => {
  const efficiency = buildUpgradeEfficiency({
    marketSnapshot,
    equipment: [],
    profile: {
      CharacterLevel: 70,
      Stats: [attackStat({ basic: 100000 })]
    },
    engravings: [
      { Name: "원한", Grade: "유물", Level: 3 },
      { Name: "아드레날린", Grade: "유물", Level: 4 }
    ],
    combatContext: {
      engravings: [
        { Name: "원한", Grade: "유물", Level: 3 },
        { Name: "아드레날린", Grade: "유물", Level: 4 }
      ]
    },
    engravingBookPrices: [
      {
        EngravingName: "원한",
        Name: "유물 원한 각인서",
        Grade: "유물",
        CurrentMinPrice: 200000,
        BundleCount: 1,
        UnitPrice: 200000,
        CostForFiveBooks: 1000000,
        IsAvailable: true
      },
      {
        EngravingName: "아드레날린",
        Name: "유물 아드레날린 각인서",
        Grade: "유물",
        CurrentMinPrice: 150000,
        BundleCount: 1,
        UnitPrice: 150000,
        CostForFiveBooks: 750000,
        IsAvailable: true
      }
    ]
  });

  const engravingCandidate = efficiency.Candidates.find((candidate) => candidate.Type === "engravingBook");

  assert.equal(engravingCandidate.Label, "원한 각인 3->4");
  assert.equal(engravingCandidate.NetCostGold, 1000000);
  assert.equal(engravingCandidate.CurrentLevel, 3);
  assert.equal(engravingCandidate.TargetLevel, 4);
  assert.equal(engravingCandidate.BookCount, 5);
  assert.equal(engravingCandidate.GainType, "combatPower");
  assert.equal(efficiency.Candidates.some((candidate) => candidate.Label === "아드레날린 각인 4->5"), false);
  assert.equal(efficiency.CostInputs.EngravingBooks.length, 2);
});
