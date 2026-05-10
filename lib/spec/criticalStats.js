import { parseTooltip, splitTooltipLines, stripMarkup } from "../lostark/equipment.js";

const CRIT_RATE_KIND = "critRate";
const CRIT_DAMAGE_KIND = "critDamage";
const CRITICAL_OUTGOING_DAMAGE_KIND = "criticalOutgoingDamage";
const ATTACK_POWER_KIND = "attackPower";
const WEAPON_POWER_KIND = "weaponPower";
const ADDITIONAL_DAMAGE_KIND = "additionalDamage";
const EXPECTED_DAMAGE_PENALTY_KIND = "expectedDamagePenalty";
const EVOLUTION_DAMAGE_KIND = "evolutionDamage";
const CRITICAL_RATE_LIMIT_KIND = "criticalRateLimit";
const CRIT_RATE_PATTERN = /치명타\s*적중률(?:이|가)?(?:\s*추가로)?\s*\+?\s*(?<value>\d+(?:\.\d+)?)\s*%\s*(?:증가|상승)?/;
const CRIT_DAMAGE_PATTERN = /치명타\s*피해(?:량)?(?:이|가)?(?:\s*추가로)?\s*\+?\s*(?<value>\d+(?:\.\d+)?)\s*%\s*(?:증가|상승)?/;
const ADDITIONAL_DAMAGE_PATTERN = /추가\s*피해(?:가|는)?\s*\+?\s*(?<value>\d+(?:\.\d+)?)\s*%/;
const EVOLUTION_DAMAGE_PATTERN = /진화형\s*피해(?:가|는)?\s*\+?\s*(?<value>\d+(?:\.\d+)?)\s*%\s*(?:증가|상승)/;
const KEEN_BLUNT_PENALTY_CHANCE_PERCENT = 10;

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

function parsePercent(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const number = Number(String(value || "").replace(/,/g, ""));

  return Number.isFinite(number) ? number : null;
}

function cleanText(value) {
  return stripMarkup(value)
    .replace(/\|\|/g, " ")
    .replace(/\\r|\\n/g, " ")
    .replace(/\\"/g, "\"")
    .replace(/\s+/g, " ")
    .trim();
}

function collectText(value, output = []) {
  if (!value) {
    return output;
  }

  if (typeof value === "string") {
    const tooltip = parseTooltip(value);

    if (tooltip) {
      return collectText(tooltip, output);
    }

    splitTooltipLines(value).map(cleanText).filter(Boolean).forEach((line) => output.push(line));
    return output;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectText(item, output));
    return output;
  }

  if (typeof value === "object") {
    Object.values(value).forEach((item) => collectText(item, output));
  }

  return output;
}

function parseCriticalEffectText(text) {
  const normalizedText = cleanText(text);

  if (!normalizedText) {
    return [];
  }

  const effects = [];
  const criticalOutgoingMatch = normalizedText.match(/(?:공격이\s*)?치명타(?:로\s*적중|시)?(?:\s*적중)?\s*시\s*적에게\s*주는\s*피해(?:량|가|는)?\s*(?:추가로\s*)?(?<value>\d+(?:\.\d+)?)\s*%\s*(?:추가로\s*)?증가/);
  const directCriticalOutgoingMatch = normalizedText.match(/^치명타\s*시\s*적에게\s*주는\s*피해(?:량|가|는)?\s*(?:추가로\s*)?(?<value>\d+(?:\.\d+)?)\s*%\s*(?:추가로\s*)?증가/);
  const criticalOutgoingValue = parsePercent(criticalOutgoingMatch?.groups?.value || directCriticalOutgoingMatch?.groups?.value);

  if (criticalOutgoingValue !== null) {
    effects.push({
      Kind: CRITICAL_OUTGOING_DAMAGE_KIND,
      Value: criticalOutgoingValue,
      Text: normalizedText
    });
  }

  const critRateMatch = normalizedText.match(CRIT_RATE_PATTERN);
  const critRateValue = parsePercent(critRateMatch?.groups?.value);

  if (critRateValue !== null) {
    effects.push({
      Kind: CRIT_RATE_KIND,
      Value: critRateValue,
      Text: normalizedText
    });
  }

  const critDamageMatch = normalizedText.match(CRIT_DAMAGE_PATTERN);
  const critDamageValue = parsePercent(critDamageMatch?.groups?.value);

  if (critDamageValue !== null) {
    effects.push({
      Kind: CRIT_DAMAGE_KIND,
      Value: critDamageValue,
      Text: normalizedText
    });
  }

  return effects;
}

function effectContext(text, pattern) {
  const match = text.match(pattern);

  if (!match) {
    return text;
  }

  return text.slice(Math.max(0, match.index - 40), match.index + match[0].length);
}

function isConditionalCriticalEffect(effect, text) {
  if (effect.Kind === CRITICAL_OUTGOING_DAMAGE_KIND) {
    return true;
  }

  if (effect.Kind === CRIT_RATE_KIND) {
    return /중첩|최대 중첩|발동|동안|사용 시|적중 시|상태|대상/.test(effectContext(text, CRIT_RATE_PATTERN));
  }

  return /사용 시|상태에서|특정|대상|사신 스킬|초각성|아이덴티티|피격이상|시드 이하/.test(effectContext(text, CRIT_DAMAGE_PATTERN));
}

function addSource(collection, source) {
  const key = `${source.SourceId || ""}:${source.Kind}:${source.Scope}:${source.SourceType}:${source.SourceName}:${source.SkillName || ""}:${source.Value}:${source.Text}`;

  if (!collection.keys.has(key)) {
    collection.keys.add(key);
    collection.sources.push(source);
  }
}

function roundPercent(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function addSpecialSource(collection, source) {
  const key = `${source.Kind}:${source.Scope}:${source.SourceType}:${source.SourceName}:${source.Value}:${source.Text}`;

  if (!collection.specialKeys.has(key)) {
    collection.specialKeys.add(key);
    collection.specialSources.push(source);
  }
}

function maxStackCountOf(effect) {
  const stackMatch = effect.Text.match(/최대\s*(?<count>\d+)\s*중첩/);
  const stackCount = Number(stackMatch?.groups?.count);

  return Number.isFinite(stackCount) && stackCount > 0 ? stackCount : 1;
}

function valueForSource(effect, sourceName) {
  const isMasterCriticalRate = effect.Kind === CRIT_RATE_KIND && /달인/.test(`${sourceName} ${effect.Text}`);

  if (!isMasterCriticalRate) {
    return effect.Value;
  }

  return Math.round(effect.Value * maxStackCountOf(effect) * 100) / 100;
}

function skillFamilyName(text) {
  const normalizedText = cleanText(text);
  const match = normalizedText.match(/(?:^|\s)(?<name>[가-힣A-Za-z0-9:·]+(?:\s+[가-힣A-Za-z0-9:·]+)*\s스킬)(?:의|이|을|를|에|로)/);

  return match?.groups?.name?.trim() || "";
}

function buildSource(effect, { sourceType, sourceName, sourceId = "", scope = "global", skillName = "" }) {
  const skillFamily = scope === "global" ? skillFamilyName(effect.Text) : "";
  const inferredScope = scope === "global" && skillFamily
    ? "skillFamily"
    : scope === "global" && isConditionalCriticalEffect(effect, effect.Text)
      ? "conditional"
      : scope;

  return {
    Kind: effect.Kind,
    Scope: inferredScope,
    SourceType: sourceType,
    SourceName: sourceName,
    SourceId: sourceId,
    SkillName: skillName,
    SkillFamily: skillFamily,
    Value: valueForSource(effect, sourceName),
    Text: effect.Text
  };
}

function maxStackAttackPowerSource(engraving, description) {
  const name = valueOf(engraving, ["Name", "name"], "");

  if (name !== "아드레날린") {
    return null;
  }

  const attackPowerMatch = description.match(/공격력이\s*(?<value>\d+(?:\.\d+)?)\s*%\s*증가/);
  const maxStackMatch = description.match(/최대\s*(?<count>\d+)\s*중첩/);
  const attackPowerValue = parsePercent(attackPowerMatch?.groups?.value);
  const maxStackCount = Number(maxStackMatch?.groups?.count);

  if (attackPowerValue === null || !Number.isFinite(maxStackCount) || maxStackCount <= 0) {
    return null;
  }

  return {
    Kind: ATTACK_POWER_KIND,
    Scope: "conditional",
    SourceType: "engraving",
    SourceName: name,
    Value: roundPercent(attackPowerValue * maxStackCount),
    PerStackValue: attackPowerValue,
    MaxStackCount: maxStackCount,
    Text: description
  };
}

function keenBluntPenaltySource(engraving, description) {
  const name = valueOf(engraving, ["Name", "name"], "");

  if (name !== "예리한 둔기") {
    return null;
  }

  const penaltyMatch = description.match(/(?<value>\d+(?:\.\d+)?)\s*%\s*감소된 피해/);
  const reductionPercent = parsePercent(penaltyMatch?.groups?.value);

  if (reductionPercent === null) {
    return null;
  }

  const expectedPenaltyPercent = roundPercent(reductionPercent * KEEN_BLUNT_PENALTY_CHANCE_PERCENT / 100);

  return {
    Kind: EXPECTED_DAMAGE_PENALTY_KIND,
    Scope: "global",
    SourceType: "engraving",
    SourceName: name,
    Value: expectedPenaltyPercent,
    ReductionPercent: reductionPercent,
    ChancePercent: KEEN_BLUNT_PENALTY_CHANCE_PERCENT,
    Multiplier: roundPercent((1 - expectedPenaltyPercent / 100) * 100) / 100,
    Text: description
  };
}

function extractSpecialEngravingSources(collection, engraving) {
  const description = valueOf(engraving, ["Description", "description"], "");
  const sources = [
    maxStackAttackPowerSource(engraving, description),
    keenBluntPenaltySource(engraving, description)
  ].filter(Boolean);

  sources.forEach((source) => addSpecialSource(collection, source));
}

function evolutionDamageSource(text, sourceContext) {
  const normalizedText = cleanText(text);
  const match = normalizedText.match(EVOLUTION_DAMAGE_PATTERN);
  const value = parsePercent(match?.groups?.value);

  if (value === null) {
    return null;
  }

  return {
    Kind: EVOLUTION_DAMAGE_KIND,
    Scope: "global",
    SourceType: sourceContext.sourceType,
    SourceName: sourceContext.sourceName,
    Value: value,
    Text: normalizedText
  };
}

function valueForSpecialTextSource(value, text, sourceName) {
  if (!/달인/.test(`${sourceName} ${text}`)) {
    return value;
  }

  const stackMatch = text.match(/최대\s*(?<count>\d+)\s*중첩/);
  const stackCount = Number(stackMatch?.groups?.count);

  if (!Number.isFinite(stackCount) || stackCount <= 0) {
    return value;
  }

  return roundPercent(value * stackCount);
}

function additionalDamageSource(text, sourceContext) {
  const normalizedText = cleanText(text);
  const match = normalizedText.match(ADDITIONAL_DAMAGE_PATTERN);
  const value = parsePercent(match?.groups?.value);

  if (value === null) {
    return null;
  }

  return {
    Kind: ADDITIONAL_DAMAGE_KIND,
    Scope: "global",
    SourceType: sourceContext.sourceType,
    SourceName: sourceContext.sourceName,
    Value: valueForSpecialTextSource(value, normalizedText, sourceContext.sourceName),
    BaseValue: value,
    Text: normalizedText
  };
}

function criticalRateLimitSource(text, sourceContext) {
  const normalizedText = cleanText(text);
  const fullText = `${sourceContext.sourceName} ${normalizedText}`;

  if (!/뭉툭한 가시/.test(fullText)) {
    return null;
  }

  const capMatch = normalizedText.match(/치명타가\s*발생할\s*확률이\s*최대\s*(?<cap>\d+(?:\.\d+)?)\s*%\s*로\s*제한/);
  const conversionMatch = normalizedText.match(/초과한\s*모든\s*치명타가\s*발생할\s*확률의\s*(?<value>\d+(?:\.\d+)?)\s*%\s*가\s*진화형\s*피해로\s*전환/);
  const maxMatch = normalizedText.match(/이\s*노드에\s*의한\s*진화형\s*피해는\s*최대\s*(?<value>\d+(?:\.\d+)?)\s*%\s*까지/);
  const capPercent = parsePercent(capMatch?.groups?.cap);
  const conversionRatePercent = parsePercent(conversionMatch?.groups?.value);
  const maxConvertedEvolutionDamagePercent = parsePercent(maxMatch?.groups?.value);

  if (capPercent === null || conversionRatePercent === null || maxConvertedEvolutionDamagePercent === null) {
    return null;
  }

  return {
    Kind: CRITICAL_RATE_LIMIT_KIND,
    Scope: "global",
    SourceType: sourceContext.sourceType,
    SourceName: sourceContext.sourceName,
    Value: capPercent,
    CapPercent: capPercent,
    OverflowConversionRatePercent: conversionRatePercent,
    MaxConvertedEvolutionDamagePercent: maxConvertedEvolutionDamagePercent,
    Text: normalizedText
  };
}

function addSpecialTextSources(collection, texts, sourceContext) {
  texts.forEach((text) => {
    [
      additionalDamageSource(text, sourceContext),
      evolutionDamageSource(text, sourceContext),
      criticalRateLimitSource(text, sourceContext)
    ].filter(Boolean).forEach((source) => addSpecialSource(collection, source));
  });
}

function arkPassiveProgress(point) {
  const description = cleanText(valueOf(point, ["Description", "description"], ""));
  const match = description.match(/(?<rank>\d+)\s*랭크\s*(?<level>\d+)\s*레벨/);
  const rank = Number(match?.groups?.rank);
  const level = Number(match?.groups?.level);

  return {
    Rank: Number.isFinite(rank) ? rank : 0,
    Level: Number.isFinite(level) ? level : 0,
    Text: description
  };
}

function extractArkPassivePointSources(collection, arkPassive) {
  listOf(arkPassive, ["Points", "points"]).forEach((point) => {
    const name = valueOf(point, ["Name", "name"], "");
    const progress = arkPassiveProgress(point);

    if (name === "진화" && progress.Rank >= 6) {
      addSpecialSource(collection, {
        Kind: EVOLUTION_DAMAGE_KIND,
        Scope: "global",
        SourceType: "arkPassivePoint",
        SourceName: "진화 6랭크 달성 보너스",
        Value: 6,
        Rank: progress.Rank,
        Level: progress.Level,
        Text: `${name} ${progress.Text} / 진화형 피해 +6%`
      });
    }

    if (name === "깨달음" && progress.Level > 0) {
      addSpecialSource(collection, {
        Kind: WEAPON_POWER_KIND,
        Scope: "global",
        SourceType: "arkPassivePoint",
        SourceName: "깨달음 레벨 보너스",
        Value: roundPercent(progress.Level * 0.1),
        Rank: progress.Rank,
        Level: progress.Level,
        Text: `${name} ${progress.Text} / 무기 공격력 +${roundPercent(progress.Level * 0.1).toFixed(1)}%`
      });
    }
  });
}

function addTextSources(collection, texts, sourceContext) {
  texts.forEach((text) => {
    parseCriticalEffectText(text).forEach((effect) => {
      addSource(collection, buildSource(effect, sourceContext));
    });
  });
}

function extractProfileSources(collection, profile) {
  const critStat = listOf(profile, ["Stats", "stats"]).find((stat) => valueOf(stat, ["Type", "type"], "") === "치명");
  const tooltip = listOf(critStat, ["Tooltip", "tooltip"]);

  addTextSources(collection, tooltip, {
    sourceType: "profile",
    sourceName: "치명 스탯"
  });
}

function extractEquipmentSources(collection, equipment) {
  listOf({ equipment }, ["equipment"]).forEach((item, itemIndex) => {
    const type = valueOf(item, ["Type", "type"], "장비");
    const name = valueOf(item, ["Name", "name"], type);
    const detailLines = listOf(item, ["DetailSections", "detailSections"]).flatMap((section) => listOf(section, ["Lines", "lines"]));
    const stoneLines = listOf(valueOf(item, ["AbilityStone", "abilityStone"], null), ["Effects", "effects"])
      .flatMap((section) => listOf(section, ["Lines", "lines"]));

    addTextSources(collection, [...detailLines, ...stoneLines], {
      sourceType: "equipment",
      sourceName: `${type} ${name}`.trim(),
      sourceId: `equipment:${itemIndex}`
    });
  });
}

function extractEngravingSources(collection, engravings) {
  listOf({ engravings }, ["engravings"]).forEach((engraving) => {
    addTextSources(collection, [valueOf(engraving, ["Description", "description"], "")], {
      sourceType: "engraving",
      sourceName: valueOf(engraving, ["Name", "name"], "각인")
    });
    extractSpecialEngravingSources(collection, engraving);
  });
}

function extractSkillSources(collection, skills) {
  listOf({ skills }, ["skills"]).forEach((skill) => {
    const skillName = valueOf(skill, ["Name", "name"], "스킬");
    const selectedTripods = listOf(skill, ["Tripods", "tripods"]).filter((tripod) => Boolean(valueOf(tripod, ["IsSelected", "isSelected"], false)));

    selectedTripods.forEach((tripod) => {
      addTextSources(collection, [valueOf(tripod, ["Tooltip", "tooltip"], "")], {
        sourceType: "tripod",
        sourceName: valueOf(tripod, ["Name", "name"], "트라이포드"),
        scope: "skill",
        skillName
      });
    });
  });
}

function extractArkPassiveSources(collection, arkPassive) {
  if (valueOf(arkPassive, ["IsArkPassive", "isArkPassive"], null) === false) {
    return;
  }

  listOf(arkPassive, ["Effects", "effects"]).forEach((effect) => {
    const texts = collectText(valueOf(effect, ["ToolTip", "Tooltip", "tooltip"], ""));
    const sourceContext = {
      sourceType: "arkPassive",
      sourceName: cleanText(valueOf(effect, ["Description", "description"], "")) || valueOf(effect, ["Name", "name"], "아크패시브")
    };

    addTextSources(collection, texts, sourceContext);
    addSpecialTextSources(collection, texts, sourceContext);
  });
  extractArkPassivePointSources(collection, arkPassive);
}

function extractArkGridSources(collection, arkGrid) {
  listOf(arkGrid, ["Slots", "slots"]).forEach((slot) => {
    addTextSources(collection, collectText(valueOf(slot, ["Tooltip", "tooltip"], "")), {
      sourceType: "arkGrid",
      sourceName: valueOf(slot, ["Name", "name"], "아크그리드")
    });

    listOf(slot, ["Gems", "gems"]).filter((gem) => valueOf(gem, ["IsActive", "isActive"], true)).forEach((gem) => {
      addTextSources(collection, collectText(valueOf(gem, ["Tooltip", "tooltip"], "")), {
        sourceType: "arkGridGem",
        sourceName: `${valueOf(slot, ["Name", "name"], "아크그리드")} 젬`
      });
    });
  });
}

function extractCardSources(collection, cards) {
  listOf(cards, ["Effects", "effects"]).forEach((effect) => {
    listOf(effect, ["Items", "items"]).forEach((item) => {
      addTextSources(collection, [valueOf(item, ["Description", "description"], "")], {
        sourceType: "card",
        sourceName: valueOf(item, ["Name", "name"], "카드")
      });
    });
  });
}

function criticalKindOf(effect) {
  const kind = valueOf(effect, ["Kind", "kind"], "");

  return [CRIT_RATE_KIND, CRIT_DAMAGE_KIND, CRITICAL_OUTGOING_DAMAGE_KIND].includes(kind) ? kind : "";
}

function scopeOfIdentityEffect(effect) {
  const scope = valueOf(effect, ["Scope", "scope"], "identity");

  if (scope === "global" || scope === "skill") {
    return scope;
  }

  return "conditional";
}

function extractClassIdentitySources(collection, classIdentityEffects) {
  const className = valueOf(classIdentityEffects, ["ClassName", "className"], "아이덴티티");

  listOf(classIdentityEffects, ["Effects", "effects"]).forEach((effect) => {
    const value = parsePercent(valueOf(effect, ["Value", "value"], null));
    const kind = criticalKindOf(effect);
    const confidence = valueOf(effect, ["Confidence", "confidence"], "");
    const isActive = valueOf(effect, ["IsActive", "isActive"], true);

    if (isActive === false || value === null || !kind || confidence === "unverified") {
      return;
    }

    addSource(collection, buildSource({
      Kind: kind,
      Value: value,
      Text: [
        valueOf(effect, ["Name", "name"], "아이덴티티 효과"),
        valueOf(effect, ["AppliesWhen", "appliesWhen"], ""),
        valueOf(effect, ["Target", "target"], "")
      ].filter(Boolean).join(" / ")
    }, {
      sourceType: "classIdentity",
      sourceName: `${className} ${valueOf(effect, ["Name", "name"], "아이덴티티 효과")}`.trim(),
      scope: scopeOfIdentityEffect(effect),
      skillName: valueOf(effect, ["Target", "target"], "") === "self" ? "" : valueOf(effect, ["Target", "target"], "")
    }));
  });
}

function sumSources(sources, kind, scope) {
  return sources
    .filter((source) => source.Kind === kind && source.Scope === scope)
    .reduce((total, source) => total + source.Value, 0);
}

function expectedPenaltyMultiplier(sources) {
  return sources
    .filter((source) => source.Kind === EXPECTED_DAMAGE_PENALTY_KIND)
    .reduce((multiplier, source) => multiplier * Number(source.Multiplier || 1), 1);
}

function criticalRateLimitOf(sources) {
  const source = sources.find((candidate) => candidate.Kind === CRITICAL_RATE_LIMIT_KIND);

  if (!source) {
    return {
      IsActive: false,
      CapPercent: 100,
      OverflowConversionRatePercent: 0,
      MaxConvertedEvolutionDamagePercent: 0
    };
  }

  return {
    IsActive: true,
    SourceName: source.SourceName,
    CapPercent: source.CapPercent,
    OverflowConversionRatePercent: source.OverflowConversionRatePercent,
    MaxConvertedEvolutionDamagePercent: source.MaxConvertedEvolutionDamagePercent
  };
}

function convertedEvolutionDamagePercent(criticalRatePercent, criticalRateLimit) {
  if (!criticalRateLimit.IsActive) {
    return 0;
  }

  const overflowPercent = Math.max(0, criticalRatePercent - criticalRateLimit.CapPercent);
  const convertedPercent = overflowPercent * criticalRateLimit.OverflowConversionRatePercent / 100;

  return roundPercent(Math.min(convertedPercent, criticalRateLimit.MaxConvertedEvolutionDamagePercent));
}

export function buildCriticalStats({
  profile = {},
  equipment = [],
  engravings = [],
  skills = [],
  arkPassive = {},
  arkGrid = {},
  cards = {},
  classIdentityEffects = {}
} = {}) {
  const collection = {
    keys: new Set(),
    sources: [],
    specialKeys: new Set(),
    specialSources: []
  };

  extractProfileSources(collection, profile);
  extractEquipmentSources(collection, equipment);
  extractEngravingSources(collection, engravings);
  extractSkillSources(collection, skills);
  extractArkPassiveSources(collection, arkPassive);
  extractArkGridSources(collection, arkGrid);
  extractCardSources(collection, cards);
  extractClassIdentitySources(collection, classIdentityEffects);

  const sources = collection.sources;
  const specialSources = collection.specialSources;
  const globalCritRate = sumSources(sources, CRIT_RATE_KIND, "global");
  const conditionalCritRate = sumSources(sources, CRIT_RATE_KIND, "conditional");
  const totalCritRate = globalCritRate + conditionalCritRate;
  const globalCritDamageBonus = sumSources(sources, CRIT_DAMAGE_KIND, "global");
  const damagePenaltyMultiplier = expectedPenaltyMultiplier(specialSources);
  const fixedEvolutionDamage = sumSources(specialSources, EVOLUTION_DAMAGE_KIND, "global");
  const globalAdditionalDamage = sumSources(specialSources, ADDITIONAL_DAMAGE_KIND, "global");
  const criticalRateLimit = criticalRateLimitOf(specialSources);
  const convertedEvolutionDamage = convertedEvolutionDamagePercent(totalCritRate, criticalRateLimit);

  return {
    BaseCriticalDamagePercent: 200,
    GlobalCriticalRatePercent: globalCritRate,
    ConditionalCriticalRatePercent: conditionalCritRate,
    EffectiveCriticalRatePercent: Math.min(totalCritRate, criticalRateLimit.CapPercent),
    GlobalAttackPowerPercent: sumSources(specialSources, ATTACK_POWER_KIND, "global"),
    ConditionalAttackPowerPercent: sumSources(specialSources, ATTACK_POWER_KIND, "conditional"),
    GlobalWeaponPowerPercent: sumSources(specialSources, WEAPON_POWER_KIND, "global"),
    ConditionalWeaponPowerPercent: sumSources(specialSources, WEAPON_POWER_KIND, "conditional"),
    GlobalAdditionalDamagePercent: globalAdditionalDamage,
    ConditionalAdditionalDamagePercent: sumSources(specialSources, ADDITIONAL_DAMAGE_KIND, "conditional"),
    FixedEvolutionDamagePercent: fixedEvolutionDamage,
    ConvertedEvolutionDamagePercent: convertedEvolutionDamage,
    EvolutionDamagePercent: fixedEvolutionDamage + convertedEvolutionDamage,
    CriticalRateLimit: criticalRateLimit,
    GlobalCriticalDamageBonusPercent: globalCritDamageBonus,
    GlobalCriticalDamagePercent: 200 + globalCritDamageBonus,
    ConditionalCriticalDamageBonusPercent: sumSources(sources, CRIT_DAMAGE_KIND, "conditional"),
    CriticalOutgoingDamagePercent: sumSources(sources, CRITICAL_OUTGOING_DAMAGE_KIND, "global"),
    ConditionalCriticalOutgoingDamagePercent: sumSources(sources, CRITICAL_OUTGOING_DAMAGE_KIND, "conditional"),
    ExpectedDamagePenaltyMultiplier: damagePenaltyMultiplier,
    ExpectedDamagePenaltyPercent: roundPercent((1 - damagePenaltyMultiplier) * 100),
    SpecialEngravingSources: specialSources,
    GlobalSources: sources.filter((source) => source.Scope === "global"),
    ConditionalSources: sources.filter((source) => source.Scope === "conditional"),
    SkillSources: sources.filter((source) => source.Scope === "skill"),
    SkillFamilySources: sources.filter((source) => source.Scope === "skillFamily"),
    SpecialSources: specialSources
  };
}

export { parseCriticalEffectText };
