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

export function formatAvatarStatPercent(value) {
  const number = Number(value);

  return `${(Number.isFinite(number) ? number : 0).toFixed(2)}%`;
}

export function isAvatarStatApplied(avatar) {
  return Boolean(valueOf(avatar, ["IsStatApplied", "isStatApplied", "IsInner", "isInner"], false));
}

export function buildAvatarStatSummary(avatars) {
  const appliedTotals = {};
  let appliedAvatarCount = 0;
  let ignoredStatEffectCount = 0;

  listOf({ avatars }, ["avatars"]).forEach((avatar) => {
    const statEffects = listOf(avatar, ["StatEffects", "statEffects"]);

    if (!statEffects.length) {
      return;
    }

    if (!isAvatarStatApplied(avatar)) {
      ignoredStatEffectCount += statEffects.length;
      return;
    }

    appliedAvatarCount += 1;

    statEffects.forEach((effect) => {
      const stat = valueOf(effect, ["Stat", "stat"], "");
      const value = Number(valueOf(effect, ["Value", "value"], 0));

      if (!stat || !Number.isFinite(value)) {
        return;
      }

      appliedTotals[stat] = (appliedTotals[stat] || 0) + value;
    });
  });

  return {
    AppliedAvatarCount: appliedAvatarCount,
    IgnoredStatEffectCount: ignoredStatEffectCount,
    StatBonuses: Object.entries(appliedTotals).map(([stat, value]) => ({
      Stat: stat,
      Value: value,
      Text: `${stat} +${formatAvatarStatPercent(value)}`
    }))
  };
}
