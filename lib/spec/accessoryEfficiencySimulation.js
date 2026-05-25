import {
  buildAccessoryContributionIndex,
  formatContributionPercent
} from "./accessoryContributions.js";
import { getMainStatNameForClass } from "./accessoryDisplay.js";
import { buildCombatPowerAnalysis } from "./combatPowerModel.js";

const ACCESSORY_TYPES = new Set(["목걸이", "귀걸이", "반지"]);
const COMBAT_STAT_TYPES = ["치명", "특화", "신속"];

function parseNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const number = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(number) ? number : null;
  }

  return null;
}

function currentOfficialCombatPower(profile, analysis) {
  return parseNumber(analysis?.OfficialCombatPower) ?? parseNumber(profile?.CombatPower) ?? null;
}

function currentEstimate(analysis) {
  return parseNumber(analysis?.Formula?.Estimate);
}

function buyPriceOf(candidate) {
  return parseNumber(candidate?.BuyPrice);
}

function isPositiveFinite(value) {
  return Number.isFinite(value) && value > 0;
}

function basicEffectLinesOf(accessory) {
  return (Array.isArray(accessory?.DetailSections) ? accessory.DetailSections : [])
    .filter((section) => section?.title === "기본 효과" || section?.Title === "기본 효과")
    .flatMap((section) => Array.isArray(section?.lines) ? section.lines : section?.Lines ?? []);
}

function combatStatValueOf(accessory, type) {
  for (const line of basicEffectLinesOf(accessory)) {
    const match = String(line || "").match(new RegExp(`^${type}\\s*\\+?\\s*(?<value>[\\d,]+)`));
    const value = parseNumber(match?.groups?.value);

    if (Number.isFinite(value)) {
      return value;
    }
  }

  return 0;
}

function profileWithAccessoryStatDelta(profile, replacedAccessory, candidate) {
  const deltas = Object.fromEntries(COMBAT_STAT_TYPES.map((type) => [
    type,
    combatStatValueOf(candidate, type) - combatStatValueOf(replacedAccessory, type)
  ]));

  if (Object.values(deltas).every((delta) => delta === 0)) {
    return profile;
  }

  const stats = Array.isArray(profile?.Stats) ? profile.Stats.map((stat) => ({ ...stat })) : [];

  for (const type of COMBAT_STAT_TYPES) {
    const delta = deltas[type];

    if (delta === 0) {
      continue;
    }

    const statIndex = stats.findIndex((stat) => stat?.Type === type);

    if (statIndex >= 0) {
      const currentValue = parseNumber(stats[statIndex].Value) ?? 0;
      stats[statIndex].Value = String(Math.max(0, currentValue + delta));
    } else if (delta > 0) {
      stats.push({ Type: type, Value: String(delta) });
    }
  }

  return {
    ...profile,
    Stats: stats
  };
}

function enlightenmentPointOf(accessory) {
  const directPoint = parseNumber(accessory?.EnlightenmentPoint);

  if (Number.isFinite(directPoint)) {
    return directPoint;
  }

  for (const section of Array.isArray(accessory?.DetailSections) ? accessory.DetailSections : []) {
    const title = String(section?.title ?? section?.Title ?? "");

    if (!/아크\s*패시브\s*포인트/.test(title)) {
      continue;
    }

    for (const line of Array.isArray(section?.lines) ? section.lines : section?.Lines ?? []) {
      const match = String(line || "").match(/깨달음\s*\+?\s*(?<value>\d+(?:\.\d+)?)/);
      const point = parseNumber(match?.groups?.value);

      if (Number.isFinite(point)) {
        return point;
      }
    }
  }

  return null;
}

function updateEnlightenmentPointValue(point, delta) {
  const currentValue = parseNumber(point?.Value ?? point?.value);

  if (!Number.isFinite(currentValue)) {
    return point;
  }

  const key = Object.hasOwn(point, "Value") ? "Value" : "value";

  return {
    ...point,
    [key]: Math.max(0, currentValue + delta)
  };
}

function combatContextWithAccessoryDelta(combatContext, replacedAccessory, candidate) {
  const currentPoint = enlightenmentPointOf(replacedAccessory);
  const candidatePoint = enlightenmentPointOf(candidate);
  const delta = Number.isFinite(currentPoint) && Number.isFinite(candidatePoint)
    ? candidatePoint - currentPoint
    : 0;

  if (delta === 0) {
    return combatContext;
  }

  const arkPassive = combatContext?.arkPassive;
  const pointKey = Array.isArray(arkPassive?.Points)
    ? "Points"
    : Array.isArray(arkPassive?.points)
      ? "points"
      : null;

  if (!pointKey) {
    return combatContext;
  }

  let updated = false;
  const points = arkPassive[pointKey].map((point) => {
    const name = point?.Name ?? point?.name;

    if (name !== "깨달음") {
      return point;
    }

    updated = true;
    return updateEnlightenmentPointValue(point, delta);
  });

  if (!updated) {
    return combatContext;
  }

  return {
    ...combatContext,
    arkPassive: {
      ...arkPassive,
      [pointKey]: points
    }
  };
}

function matchingAccessoryIndexes(equipment, type, targetEquipmentIndex = null) {
  if (!ACCESSORY_TYPES.has(type)) {
    return [];
  }

  return equipment
    .map((item, index) => ({ item, index }))
    .filter(({ item, index }) => (
      item?.Type === type &&
      (!Number.isInteger(targetEquipmentIndex) || index === targetEquipmentIndex)
    ));
}

function damageReferenceFor(equipment, profile, criticalStats, replacedEquipmentIndex) {
  const contributionIndex = buildAccessoryContributionIndex(equipment, profile, criticalStats);
  const contributionPercent = contributionIndex.itemTotals[replacedEquipmentIndex] ?? 0;

  return {
    CandidateContributionPercent: contributionPercent,
    CandidateContributionText: formatContributionPercent(contributionPercent),
    TotalContributionPercent: contributionIndex.TotalContributionPercent,
    TotalContributionText: contributionIndex.TotalContributionText,
    CriticalContext: contributionIndex.CriticalContext
  };
}

function evaluateReplacement({
  profile,
  equipment,
  candidate,
  slot,
  combatContext,
  criticalStats,
  currentOfficial,
  currentFormulaEstimate,
  buyPrice
}) {
  const simulatedEquipment = replaceAccessoryAtIndex(equipment, slot.index, candidate);
  const simulatedCombatContext = combatContextWithAccessoryDelta(combatContext, slot.item, candidate);
  const simulatedProfile = profileWithAccessoryStatDelta(profile, slot.item, candidate);
  const simulatedAnalysis = buildCombatPowerAnalysis({
    profile: simulatedProfile,
    equipment: simulatedEquipment,
    ...simulatedCombatContext,
    attackPowerBasis: "equipment"
  });
  const simulatedEstimate = parseNumber(simulatedAnalysis?.Formula?.Estimate);

  if (!Number.isFinite(simulatedEstimate)) {
    return null;
  }

  const combatPowerGain = simulatedEstimate - currentFormulaEstimate;
  const combatPowerGainPercent = (combatPowerGain / currentOfficial) * 100;

  if (combatPowerGain <= 0 || combatPowerGainPercent <= 0) {
    return null;
  }

  return {
    Type: "accessory",
    Candidate: candidate,
    ReplacedAccessory: slot.item,
    ReplacedEquipmentIndex: slot.index,
    MainStatName: getMainStatNameForClass(profile?.CharacterClassName),
    CurrentOfficialCombatPower: currentOfficial,
    ExpectedCombatPower: currentOfficial + combatPowerGain,
    CombatPowerGain: combatPowerGain,
    CombatPowerGainPercent: combatPowerGainPercent,
    BuyPrice: buyPrice,
    GoldPerOnePercentCombatPower: buyPrice / combatPowerGainPercent,
    DamageReference: damageReferenceFor(simulatedEquipment, simulatedProfile, criticalStats, slot.index)
  };
}

function bestReplacementForCandidate({
  profile,
  equipment,
  candidate,
  combatContext,
  criticalStats,
  currentOfficial,
  currentFormulaEstimate
}) {
  const buyPrice = buyPriceOf(candidate);

  if (!Number.isFinite(buyPrice) || buyPrice <= 0) {
    return null;
  }

  const slots = matchingAccessoryIndexes(equipment, candidate?.Type, candidate?.TargetEquipmentIndex);
  const evaluations = slots
    .map((slot) => evaluateReplacement({
      profile,
      equipment,
      candidate,
      slot,
      combatContext,
      criticalStats,
      currentOfficial,
      currentFormulaEstimate,
      buyPrice
    }))
    .filter(Boolean)
    .sort((left, right) => left.GoldPerOnePercentCombatPower - right.GoldPerOnePercentCombatPower);

  return evaluations[0] ?? null;
}

export function replaceAccessoryAtIndex(equipment, index, candidate) {
  return equipment.map((item, itemIndex) => (
    itemIndex === index ? { ...candidate } : item
  ));
}

export function buildAccessoryEfficiencyRecommendation({
  profile = {},
  equipment = [],
  candidates = [],
  combatContext = {},
  criticalStats = null
} = {}) {
  const currentAnalysis = buildCombatPowerAnalysis({
    profile,
    equipment,
    ...combatContext,
    attackPowerBasis: "equipment"
  });
  const currentOfficial = currentOfficialCombatPower(profile, currentAnalysis);
  const currentFormulaEstimate = currentEstimate(currentAnalysis);

  if (!isPositiveFinite(currentOfficial) || !isPositiveFinite(currentFormulaEstimate)) {
    return {
      Status: "unavailable",
      TopRecommendation: null,
      Comparisons: [],
      MissingInputs: ["현재 전투력 계산값"]
    };
  }

  const evaluated = candidates
    .filter((candidate) => ACCESSORY_TYPES.has(candidate?.Type))
    .map((candidate) => bestReplacementForCandidate({
      profile,
      equipment,
      candidate,
      combatContext,
      criticalStats,
      currentOfficial,
      currentFormulaEstimate
    }))
    .filter(Boolean)
    .sort((left, right) => left.GoldPerOnePercentCombatPower - right.GoldPerOnePercentCombatPower);

  if (evaluated.length === 0) {
    return {
      Status: "noRecommendation",
      TopRecommendation: null,
      Comparisons: [],
      MissingInputs: []
    };
  }

  return {
    Status: "ready",
    TopRecommendation: evaluated[0],
    Comparisons: evaluated.slice(0, 3),
    MissingInputs: []
  };
}
