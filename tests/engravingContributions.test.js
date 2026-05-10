import test from "node:test";
import assert from "node:assert/strict";
import { buildEngravingContributionIndex } from "../lib/spec/engravingContributions.js";

test("calculates adrenaline and keen blunt engraving contribution from current combat context", () => {
  const result = buildEngravingContributionIndex([
    { Name: "아드레날린" },
    { Name: "예리한 둔기" },
    { Name: "원한", EfficiencyText: "21.00%" }
  ], {
    GlobalCriticalRatePercent: 60,
    ConditionalCriticalRatePercent: 18.5,
    GlobalCriticalDamageBonusPercent: 50,
    ConditionalCriticalDamageBonusPercent: 0,
    GlobalAttackPowerPercent: 0,
    ConditionalAttackPowerPercent: 9,
    ExpectedDamagePenaltyMultiplier: 0.98,
    GlobalSources: [
      {
        Kind: "critDamage",
        Scope: "global",
        SourceType: "engraving",
        SourceName: "예리한 둔기",
        Value: 50
      }
    ],
    ConditionalSources: [
      {
        Kind: "critRate",
        Scope: "conditional",
        SourceType: "engraving",
        SourceName: "아드레날린",
        Value: 18.5
      }
    ],
    SpecialEngravingSources: [
      {
        Kind: "attackPower",
        Scope: "conditional",
        SourceType: "engraving",
        SourceName: "아드레날린",
        Value: 9
      },
      {
        Kind: "expectedDamagePenalty",
        Scope: "global",
        SourceType: "engraving",
        SourceName: "예리한 둔기",
        Value: 2,
        Multiplier: 0.98
      }
    ]
  });

  assert.equal(result["아드레날린"].ContributionText, "24.92%");
  assert.equal(result["예리한 둔기"].ContributionText, "19.55%");
  assert.equal(result["원한"], undefined);
});

test("converts overcapped adrenaline critical rate through blunt thorn", () => {
  const result = buildEngravingContributionIndex([
    { Name: "아드레날린" }
  ], {
    GlobalCriticalRatePercent: 97.56,
    ConditionalCriticalRatePercent: 20,
    GlobalCriticalDamageBonusPercent: 86.4,
    ConditionalCriticalDamageBonusPercent: 0,
    GlobalAttackPowerPercent: 0,
    ConditionalAttackPowerPercent: 5.4,
    FixedEvolutionDamagePercent: 50,
    CriticalRateLimit: {
      IsActive: true,
      CapPercent: 80,
      OverflowConversionRatePercent: 150,
      MaxConvertedEvolutionDamagePercent: 75
    },
    ExpectedDamagePenaltyMultiplier: 0.98,
    GlobalSources: [],
    ConditionalSources: [
      {
        Kind: "critRate",
        Scope: "conditional",
        SourceType: "engraving",
        SourceName: "아드레날린",
        Value: 20
      }
    ],
    SpecialEngravingSources: [
      {
        Kind: "attackPower",
        Scope: "conditional",
        SourceType: "engraving",
        SourceName: "아드레날린",
        Value: 5.4
      }
    ]
  });

  assert.equal(result["아드레날린"].ContributionText, "23.33%");
  assert.equal(result["아드레날린"].ConvertedEvolutionDamagePercent, 56.34);
  assert.equal(result["아드레날린"].WithoutConvertedEvolutionDamagePercent, 26.34);
});
