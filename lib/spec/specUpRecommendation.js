function toNumber(value, fallback = null) {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

function round(value, digits = 4) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  const multiplier = 10 ** digits;
  return Math.round((number + Number.EPSILON) * multiplier) / multiplier;
}

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

function efficiencyPer100kGold(gainPercent, costGold) {
  if (!Number.isFinite(gainPercent) || !Number.isFinite(costGold) || costGold <= 0) {
    return 0;
  }

  return round(gainPercent / costGold * 100000);
}

function accessoryLabel(comparison) {
  const replacedType = valueOf(comparison?.ReplacedAccessory, ["Type", "type"], "");
  const candidateType = valueOf(comparison?.Candidate, ["Type", "type"], replacedType);

  return `${replacedType || candidateType || "악세"} 교체`;
}

function normalizeAccessoryComparison(comparison, index) {
  const buyPrice = toNumber(valueOf(comparison, ["BuyPrice", "buyPrice"], null), null);
  const gainPercent = toNumber(valueOf(comparison, ["CombatPowerGainPercent", "combatPowerGainPercent"], null), null);

  if (!Number.isFinite(buyPrice) || buyPrice <= 0 || !Number.isFinite(gainPercent) || gainPercent <= 0) {
    return null;
  }

  return {
    Id: `accessory-${valueOf(comparison, ["ReplacedEquipmentIndex", "replacedEquipmentIndex"], index)}-${index}`,
    Type: "accessory",
    Label: accessoryLabel(comparison),
    CostGold: buyPrice,
    NetCostGold: buyPrice,
    GainPercent: round(gainPercent),
    GainType: "combatPower",
    EfficiencyScore: efficiencyPer100kGold(gainPercent, buyPrice),
    ScoreUnit: "전투력 % / 10만 골드",
    Source: "auction",
    AccessoryComparison: comparison,
    Caveat: "악세 즉시구매가 기준"
  };
}

function normalizeUpgradeCandidate(candidate) {
  const gainPercent = toNumber(valueOf(candidate, ["GainPercent", "gainPercent"], null), null);
  const costGold = toNumber(valueOf(candidate, ["NetCostGold", "netCostGold"], valueOf(candidate, ["CostGold", "costGold"], null)), null);
  const efficiencyScore = toNumber(valueOf(candidate, ["EfficiencyScore", "efficiencyScore"], null), null);

  if (!Number.isFinite(costGold) || costGold <= 0 || !Number.isFinite(gainPercent) || gainPercent <= 0) {
    return null;
  }

  return {
    ...candidate,
    CostGold: toNumber(valueOf(candidate, ["CostGold", "costGold"], costGold), costGold),
    NetCostGold: costGold,
    GainPercent: round(gainPercent),
    GainType: valueOf(candidate, ["GainType", "gainType"], "combatPower"),
    EfficiencyScore: Number.isFinite(efficiencyScore)
      ? efficiencyScore
      : efficiencyPer100kGold(gainPercent, costGold),
    ScoreUnit: valueOf(candidate, ["ScoreUnit", "scoreUnit"], "전투력 % / 10만 골드")
  };
}

export function buildSpecUpRecommendation({
  accessoryRecommendation = null,
  upgradeEfficiency = null,
  limit = 5
} = {}) {
  const accessoryCandidates = Array.isArray(accessoryRecommendation?.Comparisons)
    ? accessoryRecommendation.Comparisons.map(normalizeAccessoryComparison).filter(Boolean)
    : [];
  const upgradeCandidates = Array.isArray(upgradeEfficiency?.Candidates)
    ? upgradeEfficiency.Candidates.map(normalizeUpgradeCandidate).filter(Boolean)
    : [];
  const candidates = [...accessoryCandidates, ...upgradeCandidates]
    .filter((candidate) => Number.isFinite(candidate.EfficiencyScore) && candidate.EfficiencyScore > 0)
    .sort((left, right) => right.EfficiencyScore - left.EfficiencyScore);

  return {
    Status: candidates.length ? "ready" : "noRecommendation",
    TopCandidates: candidates.slice(0, limit),
    AccessoryRecommendation: accessoryRecommendation,
    UpgradeEfficiency: upgradeEfficiency,
    MissingInputs: [
      ...(Array.isArray(accessoryRecommendation?.MissingInputs) ? accessoryRecommendation.MissingInputs : []),
      ...(Array.isArray(upgradeEfficiency?.MissingInputs) ? upgradeEfficiency.MissingInputs : [])
    ]
  };
}
