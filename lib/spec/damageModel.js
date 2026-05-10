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

function toNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

export function toRatio(percent) {
  return percent / 100;
}

export function toPercent(ratio) {
  return ratio * 100;
}

export function roundPercent(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function criticalRateLimitFromStats(criticalStats) {
  const limit = valueOf(criticalStats, ["CriticalRateLimit", "criticalRateLimit"], null);

  if (!limit || !valueOf(limit, ["IsActive", "isActive"], false)) {
    return {
      isActive: false,
      capPercent: 100,
      overflowConversionRatePercent: 0,
      maxConvertedEvolutionDamagePercent: 0
    };
  }

  return {
    isActive: true,
    sourceName: valueOf(limit, ["SourceName", "sourceName"], ""),
    capPercent: toNumber(valueOf(limit, ["CapPercent", "capPercent"], 100), 100),
    overflowConversionRatePercent: toNumber(valueOf(limit, ["OverflowConversionRatePercent", "overflowConversionRatePercent"], 0), 0),
    maxConvertedEvolutionDamagePercent: toNumber(valueOf(limit, ["MaxConvertedEvolutionDamagePercent", "maxConvertedEvolutionDamagePercent"], 0), 0)
  };
}

export function effectiveCriticalRatePercent(critRatePercent, criticalRateLimit) {
  return Math.max(0, Math.min(critRatePercent, criticalRateLimit.capPercent));
}

export function convertedEvolutionDamagePercent(critRatePercent, criticalRateLimit) {
  if (!criticalRateLimit.isActive) {
    return 0;
  }

  const overflowPercent = Math.max(0, critRatePercent - criticalRateLimit.capPercent);
  const convertedPercent = overflowPercent * criticalRateLimit.overflowConversionRatePercent / 100;

  return Math.min(convertedPercent, criticalRateLimit.maxConvertedEvolutionDamagePercent);
}

export function totalEvolutionDamagePercent({ fixedEvolutionDamagePercent = 0, critRatePercent = 0, criticalRateLimit }) {
  return fixedEvolutionDamagePercent + convertedEvolutionDamagePercent(critRatePercent, criticalRateLimit);
}

export function evolutionDamageMultiplier({
  fixedEvolutionDamagePercent = 0,
  currentCritRatePercent = 0,
  baseCritRatePercent = 0,
  criticalRateLimit
}) {
  const currentEvolutionDamage = totalEvolutionDamagePercent({
    fixedEvolutionDamagePercent,
    critRatePercent: currentCritRatePercent,
    criticalRateLimit
  });
  const baseEvolutionDamage = totalEvolutionDamagePercent({
    fixedEvolutionDamagePercent,
    critRatePercent: baseCritRatePercent,
    criticalRateLimit
  });

  return (1 + toRatio(currentEvolutionDamage)) / (1 + toRatio(baseEvolutionDamage));
}

export function criticalAverageMultiplier({
  critRatePercent = 0,
  critDamageBonusPercent = 0,
  criticalOutgoingDamagePercent = 0,
  criticalRateLimit
}) {
  const effectiveCritRate = toRatio(effectiveCriticalRatePercent(critRatePercent, criticalRateLimit));
  const criticalHitMultiplier = (2 + toRatio(Math.max(0, critDamageBonusPercent)))
    * (1 + toRatio(Math.max(0, criticalOutgoingDamagePercent)));

  return 1 + effectiveCritRate * (criticalHitMultiplier - 1);
}
