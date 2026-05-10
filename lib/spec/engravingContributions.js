import {
  convertedEvolutionDamagePercent,
  criticalAverageMultiplier,
  criticalRateLimitFromStats,
  toRatio
} from "./damageModel.js";

const CRIT_RATE_KIND = "critRate";
const CRIT_DAMAGE_KIND = "critDamage";
const ATTACK_POWER_KIND = "attackPower";
const EXPECTED_DAMAGE_PENALTY_KIND = "expectedDamagePenalty";
const SUPPORTED_ENGRAVING_NAMES = new Set(["아드레날린", "예리한 둔기"]);

function valueOf(source, keys, fallback = "") {
  if (!source) {
    return fallback;
  }

  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null && source[key] !== "") {
      return source[key];
    }
  }

  return fallback;
}

function listOf(source, keys) {
  const value = valueOf(source, keys, []);
  return Array.isArray(value) ? value : [];
}

function toNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

function roundContribution(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatEngravingContributionPercent(value) {
  return `${roundContribution(value).toFixed(2)}%`;
}

function allSources(criticalStats) {
  return [
    ...listOf(criticalStats, ["GlobalSources", "globalSources"]),
    ...listOf(criticalStats, ["ConditionalSources", "conditionalSources"])
  ];
}

function engravingSources(criticalStats, engravingName) {
  return allSources(criticalStats).filter((source) => (
    valueOf(source, ["SourceType", "sourceType"], "") === "engraving"
    && valueOf(source, ["SourceName", "sourceName"], "") === engravingName
  ));
}

function specialEngravingSources(criticalStats, engravingName) {
  return listOf(criticalStats, ["SpecialEngravingSources", "specialEngravingSources"]).filter((source) => (
    valueOf(source, ["SourceType", "sourceType"], "") === "engraving"
    && valueOf(source, ["SourceName", "sourceName"], "") === engravingName
  ));
}

function sumKind(sources, kind) {
  return sources
    .filter((source) => valueOf(source, ["Kind", "kind"], "") === kind)
    .reduce((total, source) => total + toNumber(valueOf(source, ["Value", "value"], 0)), 0);
}

function totalCriticalRate(criticalStats) {
  return toNumber(valueOf(criticalStats, ["GlobalCriticalRatePercent", "globalCriticalRatePercent"], 0))
    + toNumber(valueOf(criticalStats, ["ConditionalCriticalRatePercent", "conditionalCriticalRatePercent"], 0));
}

function totalCriticalDamageBonus(criticalStats) {
  return toNumber(valueOf(criticalStats, ["GlobalCriticalDamageBonusPercent", "globalCriticalDamageBonusPercent"], 0))
    + toNumber(valueOf(criticalStats, ["ConditionalCriticalDamageBonusPercent", "conditionalCriticalDamageBonusPercent"], 0));
}

function totalAttackPower(criticalStats) {
  return toNumber(valueOf(criticalStats, ["GlobalAttackPowerPercent", "globalAttackPowerPercent"], 0))
    + toNumber(valueOf(criticalStats, ["ConditionalAttackPowerPercent", "conditionalAttackPowerPercent"], 0));
}

function fixedEvolutionDamagePercent(criticalStats) {
  return toNumber(valueOf(criticalStats, ["FixedEvolutionDamagePercent", "fixedEvolutionDamagePercent"], 0));
}

function criticalOutgoingDamagePercent(criticalStats) {
  return toNumber(valueOf(criticalStats, ["CriticalOutgoingDamagePercent", "criticalOutgoingDamagePercent"], 0))
    + toNumber(valueOf(criticalStats, ["ConditionalCriticalOutgoingDamagePercent", "conditionalCriticalOutgoingDamagePercent"], 0));
}

function attackPowerMultiplier(attackPowerPercent) {
  return 1 + toRatio(Math.max(0, attackPowerPercent));
}

function expectedPenaltyMultiplier(criticalStats) {
  const multiplier = toNumber(valueOf(criticalStats, ["ExpectedDamagePenaltyMultiplier", "expectedDamagePenaltyMultiplier"], 1), 1);

  return multiplier > 0 ? multiplier : 1;
}

function ownExpectedPenaltyMultiplier(specialSources) {
  return specialSources
    .filter((source) => valueOf(source, ["Kind", "kind"], "") === EXPECTED_DAMAGE_PENALTY_KIND)
    .reduce((multiplier, source) => {
      const sourceMultiplier = toNumber(valueOf(source, ["Multiplier", "multiplier"], 1), 1);
      return multiplier * (sourceMultiplier > 0 ? sourceMultiplier : 1);
    }, 1);
}

function contributionFromMultiplier(current, without) {
  if (!Number.isFinite(current) || !Number.isFinite(without) || without <= 0) {
    return null;
  }

  return (current / without - 1) * 100;
}

function buildContributionForName(criticalStats, engravingName) {
  if (!SUPPORTED_ENGRAVING_NAMES.has(engravingName)) {
    return null;
  }

  const sources = engravingSources(criticalStats, engravingName);
  const specialSources = specialEngravingSources(criticalStats, engravingName);
  const ownCritRate = sumKind(sources, CRIT_RATE_KIND);
  const ownCritDamage = sumKind(sources, CRIT_DAMAGE_KIND);
  const ownAttackPower = sumKind(specialSources, ATTACK_POWER_KIND);
  const ownPenaltyMultiplier = ownExpectedPenaltyMultiplier(specialSources);

  if (!ownCritRate && !ownCritDamage && !ownAttackPower && ownPenaltyMultiplier === 1) {
    return null;
  }

  const currentCritRate = totalCriticalRate(criticalStats);
  const currentCritDamage = totalCriticalDamageBonus(criticalStats);
  const currentAttackPower = totalAttackPower(criticalStats);
  const currentFixedEvolutionDamage = fixedEvolutionDamagePercent(criticalStats);
  const currentCriticalRateLimit = criticalRateLimitFromStats(criticalStats);
  const currentCriticalOutgoingDamage = criticalOutgoingDamagePercent(criticalStats);
  const currentPenaltyMultiplier = expectedPenaltyMultiplier(criticalStats);
  const currentMultiplier = attackPowerMultiplier(currentAttackPower)
    * criticalAverageMultiplier({
      critRatePercent: currentCritRate,
      critDamageBonusPercent: currentCritDamage,
      criticalOutgoingDamagePercent: currentCriticalOutgoingDamage,
      criticalRateLimit: currentCriticalRateLimit
    })
    * (1 + toRatio(currentFixedEvolutionDamage + convertedEvolutionDamagePercent(currentCritRate, currentCriticalRateLimit)))
    * currentPenaltyMultiplier;
  const withoutCritRate = currentCritRate - ownCritRate;
  const withoutMultiplier = attackPowerMultiplier(currentAttackPower - ownAttackPower)
    * criticalAverageMultiplier({
      critRatePercent: withoutCritRate,
      critDamageBonusPercent: currentCritDamage - ownCritDamage,
      criticalOutgoingDamagePercent: currentCriticalOutgoingDamage,
      criticalRateLimit: currentCriticalRateLimit
    })
    * (1 + toRatio(currentFixedEvolutionDamage + convertedEvolutionDamagePercent(withoutCritRate, currentCriticalRateLimit)))
    * (currentPenaltyMultiplier / ownPenaltyMultiplier);
  const contribution = contributionFromMultiplier(currentMultiplier, withoutMultiplier);

  if (contribution === null) {
    return null;
  }

  return {
    ContributionPercent: contribution,
    ContributionText: formatEngravingContributionPercent(contribution),
    CriticalRatePercent: ownCritRate,
    CriticalDamageBonusPercent: ownCritDamage,
    AttackPowerPercent: ownAttackPower,
    ExpectedDamagePenaltyMultiplier: ownPenaltyMultiplier,
    ConvertedEvolutionDamagePercent: roundContribution(convertedEvolutionDamagePercent(currentCritRate, currentCriticalRateLimit)),
    WithoutConvertedEvolutionDamagePercent: roundContribution(convertedEvolutionDamagePercent(withoutCritRate, currentCriticalRateLimit))
  };
}

export function buildEngravingContributionIndex(engravings, criticalStats) {
  return Object.fromEntries(
    listOf({ engravings }, ["engravings"]).map((engraving) => {
      const name = valueOf(engraving, ["Name", "name"], "");
      return [name, buildContributionForName(criticalStats || {}, name)];
    }).filter(([, contribution]) => contribution)
  );
}
