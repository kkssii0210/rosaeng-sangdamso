import {
  convertedEvolutionDamagePercent,
  criticalAverageMultiplier,
  criticalRateLimitFromStats,
  evolutionDamageMultiplier,
  roundPercent,
  toPercent,
  toRatio
} from "./damageModel.js";

const ACCESSORY_TYPES = new Set(["목걸이", "귀걸이", "반지"]);
const REFINEMENT_SECTION_PATTERN = /연마/;
const DEFAULT_CRIT_RATE = 0;

const EFFECT_RULES = [
  {
    bucket: "outgoingDamage",
    mode: "multiplicative",
    pattern: /^(?:적에게\s*)?주는 피해\s*\+?\s*(?<value>[+-]?\d+(?:\.\d+)?)\s*%/
  },
  {
    bucket: "additionalDamage",
    mode: "additive",
    pattern: /^추가 피해\s*\+?\s*(?<value>[+-]?\d+(?:\.\d+)?)\s*%/
  },
  {
    bucket: "weaponPower",
    mode: "weaponPower",
    pattern: /^무기 공격력\s*\+?\s*(?<value>[+-]?\d+(?:\.\d+)?)\s*%/
  },
  {
    bucket: "attackPower",
    mode: "additive",
    pattern: /^공격력\s*\+?\s*(?<value>[+-]?\d+(?:\.\d+)?)\s*%/
  },
  {
    bucket: "critRate",
    mode: "critRate",
    pattern: /^치명타 적중(?:률)?\s*\+?\s*(?<value>[+-]?\d+(?:\.\d+)?)\s*%/
  },
  {
    bucket: "critDamage",
    mode: "critDamage",
    pattern: /^치명타 피해\s*\+?\s*(?<value>[+-]?\d+(?:\.\d+)?)\s*%/
  },
  {
    bucket: "utility",
    mode: "utility",
    pattern: /(?:최대 마나|상태이상 공격 지속시간|공격 및 이동 속도|파티원 보호막 효과|파티원 회복 효과|생명력|깨달음|진화|도약)\s*\+?\s*(?<value>[+-]?\d+(?:\.\d+)?)(?:\s*%)?/
  }
];

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

function clampRatio(value) {
  return Math.max(0, Math.min(1, value));
}

function roundContribution(value) {
  return roundPercent(value);
}

export function formatContributionPercent(value) {
  return `${roundContribution(value).toFixed(2)}%`;
}

export function isAccessoryType(type) {
  return ACCESSORY_TYPES.has(String(type || ""));
}

export function parseAccessoryEffectLine(line) {
  const normalizedLine = String(line || "").replace(/\s+/g, " ").trim().replace(/^(상|중|하)\s+/, "");

  if (!normalizedLine) {
    return null;
  }

  for (const rule of EFFECT_RULES) {
    const match = normalizedLine.match(rule.pattern);
    const value = Number(match?.groups?.value);

    if (match && Number.isFinite(value)) {
      return {
        line: normalizedLine,
        bucket: rule.bucket,
        mode: rule.mode,
        value
      };
    }
  }

  return null;
}

function getCritRateFromProfile(profile) {
  const stats = listOf(profile, ["Stats", "stats"]);
  const critStat = stats.find((stat) => valueOf(stat, ["Type", "type"], "") === "치명");
  const tooltipValue = valueOf(critStat, ["Tooltip", "tooltip"], []);
  const tooltip = Array.isArray(tooltipValue) ? tooltipValue.join(" ") : String(tooltipValue || "");
  const match = tooltip.match(/치명타 적중률(?:이)?\s*(?<value>\d+(?:\.\d+)?)\s*%/);
  const critRate = Number(match?.groups?.value);

  if (!Number.isFinite(critRate)) {
    return DEFAULT_CRIT_RATE;
  }

  return clampRatio(toRatio(critRate));
}

function collectAccessoryEntries(equipment) {
  const entries = [];

  listOf({ equipment }, ["equipment"]).forEach((item, itemIndex) => {
    const type = valueOf(item, ["Type", "type"], "");

    if (!isAccessoryType(type)) {
      return;
    }

    listOf(item, ["DetailSections", "detailSections"]).forEach((section, sectionIndex) => {
      const title = valueOf(section, ["Title", "title"], "");

      if (!REFINEMENT_SECTION_PATTERN.test(title)) {
        return;
      }

      listOf(section, ["Lines", "lines"]).forEach((line, lineIndex) => {
        const effect = parseAccessoryEffectLine(line);

        if (effect) {
          entries.push({
            key: `${itemIndex}:${sectionIndex}:${lineIndex}`,
            itemIndex,
            sectionIndex,
            lineIndex,
            effect
          });
        }
      });
    });
  });

  return entries;
}

function sumBuckets(entries) {
  return entries.reduce((totals, entry) => {
    const { bucket, value } = entry.effect;
    totals[bucket] = (totals[bucket] || 0) + value;
    return totals;
  }, {});
}

function weaponAdditionalDamageFromEquipment(equipment) {
  return listOf({ equipment }, ["equipment"]).reduce((total, item) => {
    const weaponStats = valueOf(item, ["WeaponStats", "weaponStats"], null);
    const additionalDamage = valueOf(weaponStats, ["AdditionalDamage", "additionalDamage"], null);
    const value = toNumber(valueOf(additionalDamage, ["Value", "value"], 0));

    return total + value;
  }, 0);
}

function buildCriticalContext(entries, equipment, profile, criticalStats) {
  const entryTotals = sumBuckets(entries);
  const weaponAdditionalDamage = weaponAdditionalDamageFromEquipment(equipment);

  if (!criticalStats) {
    return {
      additionalDamage: toRatio(weaponAdditionalDamage),
      critRate: getCritRateFromProfile(profile),
      critDamage: 0,
      attackPower: 0,
      weaponPower: 0,
      fixedEvolutionDamagePercent: 0,
      criticalOutgoingDamagePercent: 0,
      criticalRateLimit: criticalRateLimitFromStats(null)
    };
  }

  const criticalRatePercent = toNumber(valueOf(criticalStats, ["GlobalCriticalRatePercent", "globalCriticalRatePercent"], 0))
    + toNumber(valueOf(criticalStats, ["ConditionalCriticalRatePercent", "conditionalCriticalRatePercent"], 0));
  const criticalDamagePercent = toNumber(valueOf(criticalStats, ["GlobalCriticalDamageBonusPercent", "globalCriticalDamageBonusPercent"], 0))
    + toNumber(valueOf(criticalStats, ["ConditionalCriticalDamageBonusPercent", "conditionalCriticalDamageBonusPercent"], 0));
  const attackPowerPercent = toNumber(valueOf(criticalStats, ["GlobalAttackPowerPercent", "globalAttackPowerPercent"], 0))
    + toNumber(valueOf(criticalStats, ["ConditionalAttackPowerPercent", "conditionalAttackPowerPercent"], 0));
  const weaponPowerPercent = toNumber(valueOf(criticalStats, ["GlobalWeaponPowerPercent", "globalWeaponPowerPercent"], 0))
    + toNumber(valueOf(criticalStats, ["ConditionalWeaponPowerPercent", "conditionalWeaponPowerPercent"], 0));
  const additionalDamagePercent = toNumber(valueOf(criticalStats, ["GlobalAdditionalDamagePercent", "globalAdditionalDamagePercent"], 0))
    + toNumber(valueOf(criticalStats, ["ConditionalAdditionalDamagePercent", "conditionalAdditionalDamagePercent"], 0));
  const fixedEvolutionDamagePercent = toNumber(valueOf(criticalStats, ["FixedEvolutionDamagePercent", "fixedEvolutionDamagePercent"], 0));
  const criticalOutgoingDamagePercent = toNumber(valueOf(criticalStats, ["CriticalOutgoingDamagePercent", "criticalOutgoingDamagePercent"], 0))
    + toNumber(valueOf(criticalStats, ["ConditionalCriticalOutgoingDamagePercent", "conditionalCriticalOutgoingDamagePercent"], 0));

  return {
    additionalDamage: toRatio(weaponAdditionalDamage + additionalDamagePercent),
    critRate: Math.max(0, toRatio(criticalRatePercent - (entryTotals.critRate || 0))),
    critDamage: Math.max(0, criticalDamagePercent - (entryTotals.critDamage || 0)),
    attackPower: Math.max(0, toRatio(attackPowerPercent)),
    weaponPower: Math.max(0, toRatio(weaponPowerPercent)),
    fixedEvolutionDamagePercent: Math.max(0, fixedEvolutionDamagePercent),
    criticalOutgoingDamagePercent: Math.max(0, criticalOutgoingDamagePercent),
    criticalRateLimit: criticalRateLimitFromStats(criticalStats)
  };
}

function outgoingDamageMultiplier(entries) {
  const totalOutgoingDamage = entries
    .filter((entry) => entry.effect.bucket === "outgoingDamage")
    .reduce((total, entry) => total + entry.effect.value, 0);

  return 1 + toRatio(totalOutgoingDamage);
}

function multiplierFromEntries(entries, context) {
  const totals = sumBuckets(entries);
  const additionalDamage = (1 + context.additionalDamage + toRatio(totals.additionalDamage || 0)) / (1 + context.additionalDamage);
  const attackPower = (1 + context.attackPower + toRatio(totals.attackPower || 0)) / (1 + context.attackPower);
  const weaponPower = Math.sqrt((1 + context.weaponPower + toRatio(totals.weaponPower || 0)) / (1 + context.weaponPower));
  const currentCritRate = context.critRate + toRatio(totals.critRate || 0);
  const currentCrit = criticalAverageMultiplier({
    critRatePercent: toPercent(currentCritRate),
    critDamageBonusPercent: context.critDamage + (totals.critDamage || 0),
    criticalOutgoingDamagePercent: context.criticalOutgoingDamagePercent,
    criticalRateLimit: context.criticalRateLimit
  });
  const baseCrit = criticalAverageMultiplier({
    critRatePercent: toPercent(context.critRate),
    critDamageBonusPercent: context.critDamage,
    criticalOutgoingDamagePercent: context.criticalOutgoingDamagePercent,
    criticalRateLimit: context.criticalRateLimit
  });
  const evolutionDamage = evolutionDamageMultiplier({
    fixedEvolutionDamagePercent: context.fixedEvolutionDamagePercent,
    currentCritRatePercent: toPercent(currentCritRate),
    baseCritRatePercent: toPercent(context.critRate),
    criticalRateLimit: context.criticalRateLimit
  });

  return outgoingDamageMultiplier(entries) * additionalDamage * attackPower * weaponPower * (currentCrit / baseCrit) * evolutionDamage;
}

function contributionFromMultiplier(current, without) {
  if (!Number.isFinite(current) || !Number.isFinite(without) || without <= 0) {
    return 0;
  }

  return toPercent(current / without - 1);
}

export function buildAccessoryContributionIndex(equipment, profile = {}, criticalStats = null) {
  const entries = collectAccessoryEntries(equipment);
  const context = buildCriticalContext(entries, equipment, profile, criticalStats);
  const currentMultiplier = multiplierFromEntries(entries, context);
  const lines = {};

  entries.forEach((entry) => {
    const entriesWithoutLine = entries.filter((candidate) => candidate !== entry);
    const withoutLineMultiplier = multiplierFromEntries(entriesWithoutLine, context);
    const contributionPercent = entry.effect.mode === "utility" ? 0 : contributionFromMultiplier(currentMultiplier, withoutLineMultiplier);
    const contribution = {
      ...entry.effect,
      ContributionPercent: contributionPercent,
      ContributionText: formatContributionPercent(contributionPercent)
    };

    lines[entry.key] = contribution;
  });

  const itemIndexes = [...new Set(entries.map((entry) => entry.itemIndex))];
  const itemTotals = Object.fromEntries(itemIndexes.map((itemIndex) => {
    const entriesWithoutItem = entries.filter((entry) => entry.itemIndex !== itemIndex);
    const withoutItemMultiplier = multiplierFromEntries(entriesWithoutItem, context);

    return [itemIndex, contributionFromMultiplier(currentMultiplier, withoutItemMultiplier)];
  }));
  const totalContributionPercent = toPercent(currentMultiplier - 1);

  return {
    lines,
    itemTotals,
    CriticalContext: {
      AdditionalDamagePercent: roundContribution(toPercent(context.additionalDamage)),
      CritRatePercent: roundContribution(toPercent(context.critRate)),
      CritDamageBonusPercent: roundContribution(context.critDamage),
      CriticalOutgoingDamagePercent: roundContribution(context.criticalOutgoingDamagePercent),
      AttackPowerPercent: roundContribution(toPercent(context.attackPower)),
      WeaponPowerPercent: roundContribution(toPercent(context.weaponPower)),
      FixedEvolutionDamagePercent: roundContribution(context.fixedEvolutionDamagePercent),
      CriticalRateCapPercent: roundContribution(context.criticalRateLimit.capPercent),
      ConvertedEvolutionDamagePercent: roundContribution(convertedEvolutionDamagePercent(toPercent(context.critRate), context.criticalRateLimit))
    },
    TotalContributionPercent: totalContributionPercent,
    TotalContributionText: formatContributionPercent(totalContributionPercent)
  };
}
