#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildMainStatSummary } from "../lib/spec/mainStats.js";
import {
  convertedEvolutionDamagePercent,
  criticalAverageMultiplier,
  criticalRateLimitFromStats,
  effectiveCriticalRatePercent,
  evolutionDamageMultiplier,
  roundPercent,
  toPercent,
  toRatio,
  totalEvolutionDamagePercent
} from "../lib/spec/damageModel.js";
import { buildSpecUpRecommendation } from "../lib/spec/specUpRecommendation.js";
import { buildRecoveryEstimate } from "../lib/spec/accessoryRecoveryEstimate.js";
import { buildAccessoryEfficiencyRecommendation } from "../lib/spec/accessoryEfficiencySimulation.js";
import { buildAccessoryContributionIndex } from "../lib/spec/accessoryContributions.js";
import { buildEngravingContributionIndex } from "../lib/spec/engravingContributions.js";
import { buildCombatPowerAnalysis } from "../lib/spec/combatPowerModel.js";
import { buildUpgradeEfficiency } from "../lib/spec/upgradeEfficiency.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const defaultOutputDir = path.join(projectRoot, "backend", "src", "test", "resources", "golden");

function parseArgs(argv) {
  const args = { outputDir: defaultOutputDir };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--output-dir") {
      args.outputDir = argv[index + 1];
      index += 1;
    }
  }

  return args;
}

function mainStatsFixture() {
  const input = {
    equipment: [
      { Type: "무기", Name: "종말의 대검", MainStatValue: 12345 },
      { Type: "상의", Name: "엄숙한 정장", MainStatValue: "6000" },
      { Type: "나침반", Name: "전투 제외 장비", MainStatValue: 0 },
      { Type: "부적", Name: "깨진 값", MainStatValue: "not-a-number" }
    ]
  };

  return {
    name: "main-stats",
    source: "lib/spec/mainStats.js::buildMainStatSummary",
    input,
    expected: buildMainStatSummary(input.equipment)
  };
}

function damageModelFixture() {
  const input = {
    percent: 12.5,
    ratio: 0.375,
    roundSource: 12.345,
    criticalStats: {
      CriticalRateLimit: {
        IsActive: true,
        SourceName: "뭉툭한 가시",
        CapPercent: 80,
        OverflowConversionRatePercent: 25,
        MaxConvertedEvolutionDamagePercent: 5
      }
    },
    currentCritRatePercent: 120,
    baseCritRatePercent: 50,
    fixedEvolutionDamagePercent: 18,
    critDamageBonusPercent: 65,
    criticalOutgoingDamagePercent: 12
  };
  const criticalRateLimit = criticalRateLimitFromStats(input.criticalStats);

  return {
    name: "damage-model",
    source: "lib/spec/damageModel.js",
    input,
    expected: {
      toRatio: toRatio(input.percent),
      toPercent: toPercent(input.ratio),
      roundPercent: roundPercent(input.roundSource),
      criticalRateLimit,
      effectiveCriticalRatePercent: effectiveCriticalRatePercent(input.currentCritRatePercent, criticalRateLimit),
      convertedEvolutionDamagePercent: convertedEvolutionDamagePercent(input.currentCritRatePercent, criticalRateLimit),
      totalEvolutionDamagePercent: totalEvolutionDamagePercent({
        fixedEvolutionDamagePercent: input.fixedEvolutionDamagePercent,
        critRatePercent: input.currentCritRatePercent,
        criticalRateLimit
      }),
      evolutionDamageMultiplier: evolutionDamageMultiplier({
        fixedEvolutionDamagePercent: input.fixedEvolutionDamagePercent,
        currentCritRatePercent: input.currentCritRatePercent,
        baseCritRatePercent: input.baseCritRatePercent,
        criticalRateLimit
      }),
      criticalAverageMultiplier: criticalAverageMultiplier({
        critRatePercent: input.currentCritRatePercent,
        critDamageBonusPercent: input.critDamageBonusPercent,
        criticalOutgoingDamagePercent: input.criticalOutgoingDamagePercent,
        criticalRateLimit
      })
    }
  };
}

function specUpRecommendationFixture() {
  const input = {
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
  };

  return {
    name: "spec-up-recommendation",
    source: "lib/spec/specUpRecommendation.js::buildSpecUpRecommendation",
    input,
    expected: buildSpecUpRecommendation(input)
  };
}

function accessoryEfficiencyFixture() {
  const currentRing = {
    Type: "반지",
    Name: "현재 반지",
    Grade: "고대",
    Quality: 90,
    MainStatValue: 10000,
    EnlightenmentPoint: 8,
    DetailSections: [{ title: "기본 효과", lines: ["힘 +10000", "치명 +200"] }]
  };
  const input = {
    profile: {
      CharacterClassName: "창술사",
      CombatPower: "1000000",
      Stats: [{ Type: "치명", Value: "1000" }]
    },
    equipment: [
      { Type: "무기", Name: "+11 무기", MainStatValue: 0, WeaponStats: { WeaponPower: { Value: 100000 } } },
      currentRing
    ],
    candidates: [{
      Type: "반지",
      Name: "더 좋은 반지",
      Grade: "고대",
      Quality: 92,
      BuyPrice: 10000,
      TargetEquipmentIndex: 1,
      MainStatValue: 14000,
      EnlightenmentPoint: 9,
      DetailSections: [{ title: "기본 효과", lines: ["힘 +14000", "치명 +260"] }]
    }],
    combatContext: {
      arkPassive: { Points: [{ Name: "깨달음", Value: 80 }] },
      engravings: [],
      gems: []
    },
    criticalStats: null
  };

  return {
    name: "accessory-efficiency",
    source: "lib/spec/accessoryEfficiencySimulation.js::buildAccessoryEfficiencyRecommendation",
    scope: "single-ring-replacement-seed",
    input,
    expected: buildAccessoryEfficiencyRecommendation(input)
  };
}

function accessoryContributionFixture() {
  const input = {
    profile: {
      Stats: [{
        Type: "치명",
        Value: "1200",
        Tooltip: ["치명타 적중률이 42.00% 증가합니다."]
      }]
    },
    equipment: [
      {
        Type: "무기",
        Name: "+11 무기",
        WeaponStats: { AdditionalDamage: { Value: 30, Text: "추가 피해 +30.00%" } }
      },
      {
        Type: "목걸이",
        Name: "피해 목걸이",
        DetailSections: [{ title: "연마 효과", lines: ["추가 피해 +1.20%", "적에게 주는 피해 +0.75%"] }]
      },
      {
        Type: "반지",
        Name: "치명 반지",
        DetailSections: [{ title: "연마 효과", lines: ["치명타 적중률 +0.40%", "치명타 피해 +1.10%"] }]
      }
    ],
    criticalStats: {
      GlobalCriticalRatePercent: 42,
      GlobalCriticalDamageBonusPercent: 50,
      GlobalAdditionalDamagePercent: 10,
      CriticalRateLimitPercent: 100
    }
  };

  return {
    name: "accessory-contribution",
    source: "lib/spec/accessoryContributions.js::buildAccessoryContributionIndex",
    scope: "mixed-accessory-effects-seed",
    input,
    expected: buildAccessoryContributionIndex(input.equipment, input.profile, input.criticalStats)
  };
}

function engravingContributionFixture() {
  const input = {
    engravings: [
      { Name: "아드레날린", Grade: "유물", Level: 3 },
      { Name: "예리한 둔기", Grade: "유물", Level: 3 },
      { Name: "원한", Grade: "유물", Level: 3 }
    ],
    criticalStats: {
      GlobalCriticalRatePercent: 65,
      GlobalCriticalDamageBonusPercent: 50,
      GlobalAttackPowerPercent: 6,
      FixedEvolutionDamagePercent: 12,
      CriticalOutgoingDamagePercent: 4,
      ExpectedDamagePenaltyMultiplier: 0.985,
      GlobalSources: [
        { SourceType: "engraving", SourceName: "아드레날린", Kind: "critRate", Value: 14 },
        { SourceType: "engraving", SourceName: "예리한 둔기", Kind: "critDamage", Value: 50 }
      ],
      SpecialEngravingSources: [
        { SourceType: "engraving", SourceName: "아드레날린", Kind: "attackPower", Value: 6 },
        { SourceType: "engraving", SourceName: "예리한 둔기", Kind: "expectedDamagePenalty", Multiplier: 0.985 }
      ],
      CriticalRateLimit: {
        IsActive: true,
        SourceName: "예리한 둔기 - 가시",
        CapPercent: 80,
        OverflowConversionRatePercent: 60,
        MaxConvertedEvolutionDamagePercent: 24
      }
    }
  };

  return {
    name: "engraving-contribution",
    source: "lib/spec/engravingContributions.js::buildEngravingContributionIndex",
    scope: "adrenaline-and-keen-blunt-seed",
    input,
    expected: buildEngravingContributionIndex(input.engravings, input.criticalStats)
  };
}

function accessoryRecoveryEstimateFixture() {
  const currentAccessory = {
    Type: "반지",
    Grade: "고대",
    Quality: 90,
    DetailSections: [
      { title: "기본 효과", lines: ["힘 +12,000", "치명 +300"] },
      { title: "아크 패시브 포인트 효과", lines: ["깨달음 +10"] },
      { title: "연마 효과", lines: ["추가 피해 +1.20%"] }
    ]
  };
  const auctionCandidates = [82000, 90000, 100000, 108000].map((BuyPrice) => ({
    ...currentAccessory,
    BuyPrice
  }));
  const input = {
    currentAccessory,
    auctionCandidates,
    recommendation: {
      BuyPrice: 200000,
      CombatPowerGainPercent: 1.5
    }
  };

  return {
    name: "accessory-recovery-estimate",
    source: "lib/spec/accessoryRecoveryEstimate.js::buildRecoveryEstimate",
    input,
    expected: buildRecoveryEstimate(input)
  };
}

function combatPowerAnalysisFixture() {
  const input = {
    profile: {
      CombatPower: "123,456.78",
      CharacterLevel: 70
    },
    paradiseOrb: {
      Name: "눈부신 비전의 보주",
      EffectName: "맥스웰 맥시마",
      EffectRole: "attack",
      MaxParadisePower: {
        Value: 48275714,
        Text: "시즌2 달성 최대 낙원력 : 48,275,714"
      }
    },
    criticalStats: {
      GlobalCriticalRatePercent: 39.92,
      EvolutionDamagePercent: 86.34
    }
  };

  return {
    name: "combat-power-analysis",
    source: "lib/spec/combatPowerModel.js::buildCombatPowerAnalysis",
    scope: "partial-contract-seed",
    input,
    expected: buildCombatPowerAnalysis(input)
  };
}

function marketGroup(id, items) {
  return { id, items };
}

function marketItem(name, currentMinPrice, bundleCount, categoryName) {
  return {
    name,
    currentMinPrice,
    bundleCount,
    ...(categoryName ? { categoryName } : {})
  };
}

function gemMarketItem(name, currentMinPrice, gemLevel, gemEffectType, gemEffectValue) {
  return {
    name,
    currentMinPrice,
    bundleCount: 1,
    gemLevel,
    gemEffectType,
    gemEffectValue
  };
}

function upgradeEfficiencyFixture() {
  const input = {
    profile: { CharacterName: "도화가" },
    equipment: [
      { Type: "무기", Name: "+11 세르카 고대 무기", WeaponStats: { WeaponPower: { Value: 167706 } } },
      { Type: "투구", Name: "+11 세르카 고대 투구", MainStatValue: 96801 },
      { Type: "어깨", Name: "+11 세르카 고대 어깨", MainStatValue: 103023 },
      { Type: "상의", Name: "+11 세르카 고대 상의", MainStatValue: 77441 },
      { Type: "하의", Name: "+11 세르카 고대 하의", MainStatValue: 83664 },
      { Type: "장갑", Name: "+11 세르카 고대 장갑", MainStatValue: 116161 }
    ],
    marketSnapshot: {
      updatedAt: "2026-05-29T00:00:00Z",
      groups: [
        marketGroup("honing-materials", [
          marketItem("운명의 파괴석 결정", 1688, 100),
          marketItem("운명의 수호석 결정", 50, 100),
          marketItem("위대한 운명의 돌파석", 14, 1),
          marketItem("상급 아비도스 융화 재료", 142, 1),
          marketItem("운명의 파편 주머니(소)", 60, 1),
          marketItem("운명의 파편 주머니(대)", 173, 1)
        ]),
        marketGroup("honing-supports", [
          marketItem("용암의 숨결", 365, 1),
          marketItem("빙하의 숨결", 290, 1)
        ]),
        marketGroup("legendary-avatars", [
          marketItem("전설 머리", 50000, 1, "머리"),
          marketItem("전설 상의", 60000, 1, "상의")
        ]),
        marketGroup("gems", [
          gemMarketItem("7레벨 겁화의 보석", 100000, 7, "damage", 24),
          gemMarketItem("8레벨 겁화의 보석", 200000, 8, "damage", 30)
        ])
      ]
    }
  };

  return {
    name: "upgrade-efficiency",
    source: "lib/spec/upgradeEfficiency.js::buildUpgradeEfficiency",
    scope: "market-honing-and-avatar-seed",
    input,
    expected: buildUpgradeEfficiency(input)
  };
}

export async function exportGoldenFixtures({ outputDir = defaultOutputDir } = {}) {
  await mkdir(outputDir, { recursive: true });

  const fixtures = [
    ["main-stats.json", mainStatsFixture()],
    ["damage-model.json", damageModelFixture()],
    ["combat-power-analysis.json", combatPowerAnalysisFixture()],
    ["upgrade-efficiency.json", upgradeEfficiencyFixture()],
    ["spec-up-recommendation.json", specUpRecommendationFixture()],
    ["accessory-efficiency.json", accessoryEfficiencyFixture()],
    ["accessory-contribution.json", accessoryContributionFixture()],
    ["engraving-contribution.json", engravingContributionFixture()],
    ["accessory-recovery-estimate.json", accessoryRecoveryEstimateFixture()]
  ];
  const written = [];

  for (const [filename, fixture] of fixtures) {
    const target = path.join(outputDir, filename);
    await writeFile(target, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
    written.push(target);
  }

  return written;
}

if (process.argv[1] === __filename) {
  const args = parseArgs(process.argv.slice(2));
  const written = await exportGoldenFixtures(args);
  for (const file of written) {
    console.log(file);
  }
}
