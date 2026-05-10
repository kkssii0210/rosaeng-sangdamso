import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAccessoryContributionIndex,
  formatContributionPercent,
  parseAccessoryEffectLine
} from "../lib/spec/accessoryContributions.js";
import { bomberAccessoryRegression } from "./fixtures/bomberAccessoryRegression.js";

test("parses known accessory refinement damage buckets", () => {
  assert.deepEqual(parseAccessoryEffectLine("적에게 주는 피해 +2%"), {
    line: "적에게 주는 피해 +2%",
    bucket: "outgoingDamage",
    mode: "multiplicative",
    value: 2
  });
  assert.equal(parseAccessoryEffectLine("무기 공격력 +1.80%").bucket, "weaponPower");
  assert.equal(parseAccessoryEffectLine("최대 마나 +15").bucket, "utility");
  assert.equal(parseAccessoryEffectLine("치명 +420"), null);
});

test("calculates accessory refinement contribution by damage bucket", () => {
  const equipment = [
    {
      Type: "목걸이",
      DetailSections: [
        {
          title: "연마 효과",
          lines: ["적에게 주는 피해 +2%", "추가 피해 +1.60%", "최대 마나 +15"]
        }
      ]
    },
    {
      Type: "귀걸이",
      DetailSections: [
        {
          title: "연마 효과",
          lines: ["추가 피해 +2.40%", "무기 공격력 +1.80%"]
        }
      ]
    },
    {
      Type: "투구",
      DetailSections: [
        {
          title: "연마 효과",
          lines: ["공격력 +9.99%"]
        }
      ]
    }
  ];

  const result = buildAccessoryContributionIndex(equipment);

  assert.equal(result.lines["0:0:0"].ContributionText, "2.00%");
  assert.equal(result.lines["0:0:1"].ContributionText, "1.56%");
  assert.equal(result.lines["0:0:2"].ContributionText, "0.00%");
  assert.equal(result.lines["1:0:0"].ContributionText, "2.36%");
  assert.equal(result.lines["1:0:1"].ContributionText, "0.90%");
  assert.equal(result.lines["2:0:0"], undefined);
  assert.equal(formatContributionPercent(result.itemTotals[0]), "3.59%");
});

test("uses profile crit rate for critical accessory effects", () => {
  const equipment = [
    {
      Type: "반지",
      DetailSections: [
        {
          title: "연마 효과",
          lines: ["치명타 피해 +4.00%", "치명타 적중률 +1.50%"]
        }
      ]
    }
  ];
  const profile = {
    Stats: [
      {
        Type: "치명",
        Tooltip: ["치명타 적중률이 25.00% 증가합니다."]
      }
    ]
  };

  const result = buildAccessoryContributionIndex(equipment, profile);

  assert.equal(result.lines["0:0:0"].ContributionText, "0.84%");
  assert.equal(result.lines["0:0:1"].ContributionText, "1.24%");
});

test("uses full critical stats context for critical damage accessory effects", () => {
  const equipment = [
    {
      Type: "반지",
      DetailSections: [
        {
          title: "연마 효과",
          lines: ["치명타 피해 +4.00%", "치명타 적중률 +1.50%"]
        }
      ]
    }
  ];
  const criticalStats = {
    GlobalCriticalRatePercent: 50,
    ConditionalCriticalRatePercent: 20,
    GlobalCriticalDamageBonusPercent: 56,
    ConditionalCriticalDamageBonusPercent: 0
  };

  const result = buildAccessoryContributionIndex(equipment, {}, criticalStats);

  assert.equal(result.CriticalContext.CritRatePercent, 68.5);
  assert.equal(result.CriticalContext.CritDamageBonusPercent, 52);
  assert.equal(result.lines["0:0:0"].ContributionText, "1.36%");
  assert.equal(result.lines["0:0:1"].ContributionText, "1.13%");
});

test("uses critical outgoing damage context for critical accessory effects", () => {
  const equipment = [
    {
      Type: "반지",
      DetailSections: [
        {
          title: "연마 효과",
          lines: ["치명타 적중률 +1.00%"]
        }
      ]
    }
  ];
  const criticalStats = {
    GlobalCriticalRatePercent: 51,
    CriticalOutgoingDamagePercent: 20
  };

  const result = buildAccessoryContributionIndex(equipment, {}, criticalStats);

  assert.equal(result.CriticalContext.CritRatePercent, 50);
  assert.equal(result.CriticalContext.CriticalOutgoingDamagePercent, 20);
  assert.equal(result.lines["0:0:0"].ContributionText, "0.82%");
});

test("uses weapon additional damage context for accessory additional damage effects", () => {
  const equipment = [
    {
      Type: "무기",
      WeaponStats: {
        AdditionalDamage: {
          Value: 29.61
        }
      }
    },
    {
      Type: "목걸이",
      DetailSections: [
        {
          title: "연마 효과",
          lines: ["추가 피해 +1.60%"]
        }
      ]
    }
  ];

  const result = buildAccessoryContributionIndex(equipment);

  assert.equal(result.CriticalContext.AdditionalDamagePercent, 29.61);
  assert.equal(result.lines["1:0:0"].ContributionText, "1.23%");
  assert.equal(result.TotalContributionText, "1.23%");
});

test("converts overcapped accessory critical rate through blunt thorn", () => {
  const equipment = [
    {
      Type: "반지",
      DetailSections: [
        {
          title: "연마 효과",
          lines: ["치명타 적중률 +1.50%"]
        }
      ]
    }
  ];
  const criticalStats = {
    GlobalCriticalRatePercent: 97.5,
    ConditionalCriticalRatePercent: 20,
    FixedEvolutionDamagePercent: 50,
    CriticalRateLimit: {
      IsActive: true,
      CapPercent: 80,
      OverflowConversionRatePercent: 150,
      MaxConvertedEvolutionDamagePercent: 75
    }
  };

  const result = buildAccessoryContributionIndex(equipment, {}, criticalStats);

  assert.equal(result.CriticalContext.CritRatePercent, 116);
  assert.equal(result.CriticalContext.CriticalRateCapPercent, 80);
  assert.equal(result.CriticalContext.ConvertedEvolutionDamagePercent, 54);
  assert.equal(result.lines["0:0:0"].ContributionText, "1.10%");
});

test("uses engraving attack power context for attack power accessory effects", () => {
  const equipment = [
    {
      Type: "귀걸이",
      DetailSections: [
        {
          title: "연마 효과",
          lines: ["공격력 +1.00%"]
        }
      ]
    }
  ];
  const criticalStats = {
    ConditionalAttackPowerPercent: 9
  };

  const result = buildAccessoryContributionIndex(equipment, {}, criticalStats);

  assert.equal(result.CriticalContext.AttackPowerPercent, 9);
  assert.equal(result.lines["0:0:0"].ContributionText, "0.92%");
  assert.equal(result.TotalContributionText, "0.92%");
});

test("uses ark passive weapon power context for weapon power accessory effects", () => {
  const equipment = [
    {
      Type: "귀걸이",
      DetailSections: [
        {
          title: "연마 효과",
          lines: ["무기 공격력 +1.80%"]
        }
      ]
    }
  ];
  const criticalStats = {
    GlobalWeaponPowerPercent: 2.5
  };

  const result = buildAccessoryContributionIndex(equipment, {}, criticalStats);

  assert.equal(result.CriticalContext.WeaponPowerPercent, 2.5);
  assert.equal(result.lines["0:0:0"].ContributionText, "0.87%");
  assert.equal(result.TotalContributionText, "0.87%");
});

test("uses ark passive master additional damage context for accessory additional damage effects", () => {
  const equipment = [
    {
      Type: "무기",
      WeaponStats: {
        AdditionalDamage: {
          Value: 29.61
        }
      }
    },
    {
      Type: "목걸이",
      DetailSections: [
        {
          title: "연마 효과",
          lines: ["추가 피해 +1.60%"]
        }
      ]
    }
  ];
  const criticalStats = {
    GlobalAdditionalDamagePercent: 8.5
  };

  const result = buildAccessoryContributionIndex(equipment, {}, criticalStats);

  assert.equal(result.CriticalContext.AdditionalDamagePercent, 38.11);
  assert.equal(result.lines["1:0:0"].ContributionText, "1.16%");
  assert.equal(result.TotalContributionText, "1.16%");
});

test("keeps bomber accessory contribution regression stable", () => {
  const result = buildAccessoryContributionIndex(
    bomberAccessoryRegression.equipment,
    {},
    bomberAccessoryRegression.criticalStats
  );

  assert.equal(result.CriticalContext.AdditionalDamagePercent, 38.11);
  assert.equal(result.CriticalContext.CriticalOutgoingDamagePercent, 14.6);
  assert.equal(result.lines["1:0:2"].ContributionText, "1.16%");
  assert.equal(result.lines["2:0:1"].ContributionText, "1.27%");
  assert.equal(result.lines["3:0:1"].ContributionText, "0.33%");
  assert.equal(result.TotalContributionText, "7.08%");
});

test("treats outgoing damage accessory lines as one additive bucket", () => {
  const equipment = [
    {
      Type: "목걸이",
      DetailSections: [
        {
          title: "연마 효과",
          lines: ["적에게 주는 피해 +2.00%", "적에게 주는 피해 +1.00%"]
        }
      ]
    }
  ];

  const result = buildAccessoryContributionIndex(equipment);

  assert.equal(result.lines["0:0:0"].ContributionText, "1.98%");
  assert.equal(result.lines["0:0:1"].ContributionText, "0.98%");
  assert.equal(result.TotalContributionText, "3.00%");
});
