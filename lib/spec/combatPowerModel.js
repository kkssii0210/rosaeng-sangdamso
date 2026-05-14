import { parseTooltip, splitTooltipLines, stripMarkup } from "../lostark/equipment.js";

const SOURCE_BASE_COEFFICIENT = 0.0288;
const IN_GAME_DISPLAY_SCALE = 0.01;
const FLAT_ATTACK_REFERENCE = 142857;
const PARADISE_POWER_REFERENCE = 100000000;
const EVOLUTION_POINT_COMBAT_POWER_PERCENT = 0.5;
const ENLIGHTENMENT_POINT_COMBAT_POWER_CAP = 100;

const GEM_PURE_COMBAT_POWER_FACTORS = new Map([
  [1, 1.28],
  [2, 1.92],
  [3, 2.56],
  [4, 3.2],
  [5, 3.84],
  [6, 4.48],
  [7, 5.12],
  [8, 5.76],
  [9, 6.4],
  [10, 7.04]
]);

const PARADISE_ORB_COMBAT_POWER_RULES = {
  attack: {
    baseBasisPoints: 20,
    paradiseBasisPoints: 800,
    label: "공격형 보주"
  },
  support: {
    baseBasisPoints: 14,
    paradiseBasisPoints: 544,
    label: "보조형 보주"
  }
};

const COMBAT_LEVEL_FACTORS = [
  { min: 70, percent: 29.45, label: "전투 Lv.70" },
  { min: 65, percent: 23.97, label: "전투 Lv.65-69" },
  { min: 60, percent: 18.56, label: "전투 Lv.60-64" },
  { min: 55, percent: 8.95, label: "전투 Lv.55-59" }
];

const RING_CRIT_RATE_FACTORS = new Map([
  [0.4, 0.30968],
  [0.95, 0.73549],
  [1.55, 1.20001]
]);

const RING_CRIT_DAMAGE_FACTORS = new Map([
  [1.1, 0.33],
  [2.4, 0.72],
  [4, 1.2]
]);

const NECK_ADDITIONAL_DAMAGE_FACTORS = new Map([
  [0.6, 0.46152],
  [1.6, 1.23072],
  [2.6, 1.99992]
]);

const ARK_GRID_ORDER_FACTORS = {
  relic: {
    sunMoon: { 10: 1.5, 14: 4, 17: 7.5, 18: 7.67, 19: 7.83, 20: 8 },
    star: { 10: 1, 14: 2.5, 17: 4.5, 18: 4.67, 19: 4.83, 20: 5 }
  },
  ancient: {
    sunMoon: { 10: 1.5, 14: 4, 17: 8.5, 18: 8.67, 19: 8.83, 20: 9 },
    star: { 10: 1, 14: 2.5, 17: 5.5, 18: 5.67, 19: 5.83, 20: 6 }
  }
};

const ARK_GRID_CHAOS_FACTORS = {
  해: {
    "현란한 공격": { 10: 0.5, 14: 1, 17: 2.5, 18: 2.67, 19: 2.83, 20: 3 },
    "안정적인 공격": { 10: 0, 14: 0.5, 17: 1.5, 18: 1.67, 19: 1.83, 20: 2 },
    "재빠른 공격": { 10: 0, 14: 0.5, 17: 1.5, 18: 1.67, 19: 1.83, 20: 2 }
  },
  달: {
    "불타는 일격": { 10: 0.5, 14: 1, 17: 2.5, 18: 2.67, 19: 2.83, 20: 3 },
    "흡수의 일격": { 10: 0, 14: 0.5, 17: 1.5, 18: 1.67, 19: 1.83, 20: 2 },
    "부수는 일격": { 10: 0, 14: 0.5, 17: 1.5, 18: 1.67, 19: 1.83, 20: 2 }
  },
  별: {
    공격: { 10: 0.5, 14: 1, 17: 2.5, 18: 2.67, 19: 2.83, 20: 3 },
    무기: { 10: 0.35, 14: 0.7, 17: 2.2, 18: 2.3, 19: 2.41, 20: 2.53 }
  }
};

const ARK_GRID_POINT_THRESHOLDS = [10, 14, 17, 18, 19, 20];

const ENGRAVING_COMBAT_POWER_FACTORS = new Map([
  ["분쇄의주먹", 1.6],
  ["승부사", 2.1],
  ["구슬동자", 4.64],
  ["실드관통", 5.4],
  ["부러진뼈", 8.4],
  ["시선집중", 9],
  ["마나의흐름", 11.1111],
  ["추진력", 11.9],
  ["정밀단도", 12.7],
  ["약자무시", 13.2],
  ["마나효율증가", 16],
  ["에테르포식자", 16.2],
  ["속전속결", 16.8],
  ["슈퍼차지", 16.8],
  ["저주받은인형", 17],
  ["달인의저력", 17],
  ["바리케이드", 17],
  ["안정된상태", 17],
  ["예리한둔기", 17],
  ["타격의대가", 17],
  ["기습의대가", 18.1],
  ["결투의대가", 18.1],
  ["질량증가", 19],
  ["돌격대장", 19.2],
  ["아드레날린", 19.4],
  ["원한", 21]
]);

const LEGENDARY_ENGRAVING_COMBAT_POWER_FACTORS = new Map([
  ["마나효율증가", 13],
  ["에테르포식자", 12.6],
  ["저주받은인형", 14],
  ["예리한둔기", 14.37],
  ["속전속결", 14.4],
  ["슈퍼차지", 14.4]
]);

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
  const number = Number(String(value ?? "").replace(/,/g, ""));

  return Number.isFinite(number) ? number : fallback;
}

function round(value, digits = 2) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const unit = 10 ** digits;
  return Math.round((value + Number.EPSILON) * unit) / unit;
}

function floorDisplay(value) {
  return Number.isFinite(value) ? Math.floor(value) : null;
}

function cleanText(value) {
  if (Array.isArray(value)) {
    return value.map(cleanText).filter(Boolean).join(" ");
  }

  return stripMarkup(value)
    .replace(/\|\|/g, " ")
    .replace(/\\r|\\n/g, " ")
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

function statEntry(profile, type) {
  return listOf(profile, ["Stats", "stats"]).find((stat) => valueOf(stat, ["Type", "type"], "") === type) || null;
}

function profileStatNumber(profile, type) {
  return toNumber(valueOf(statEntry(profile, type), ["Value", "value"], 0));
}

function parseOfficialCombatPower(profile) {
  const value = toNumber(valueOf(profile, ["CombatPower", "combatPower"], 0));

  return value > 0 ? value : null;
}

function parseParadisePower(paradiseOrb) {
  const source = valueOf(paradiseOrb, ["MaxParadisePower", "maxParadisePower"], null);
  const value = toNumber(valueOf(source, ["Value", "value"], 0));

  if (value <= 0) {
    return null;
  }

  return {
    Value: value,
    Text: valueOf(source, ["Text", "text"], ""),
    EffectName: valueOf(paradiseOrb, ["EffectName", "effectName"], ""),
    EffectRole: valueOf(paradiseOrb, ["EffectRole", "effectRole"], "unknown"),
    SourceName: valueOf(paradiseOrb, ["Name", "name"], "보주")
  };
}

function paradiseOrbFactor(paradisePower) {
  if (!paradisePower) {
    return null;
  }

  const role = valueOf(paradisePower, ["EffectRole", "effectRole"], "unknown");
  const rule = PARADISE_ORB_COMBAT_POWER_RULES[role];

  if (!rule) {
    return null;
  }

  const value = toNumber(valueOf(paradisePower, ["Value", "value"], 0));
  const basisPoints = rule.baseBasisPoints + rule.paradiseBasisPoints * value / PARADISE_POWER_REFERENCE;

  return {
    Id: "paradise-orb",
    Category: "paradiseOrb",
    Label: rule.label,
    Percent: basisPoints / 100,
    ParadisePower: value,
    EffectName: valueOf(paradisePower, ["EffectName", "effectName"], ""),
    BasisPoints: round(basisPoints, 5),
    Confidence: "low"
  };
}

function parseAttackBreakdown(profile) {
  const attack = statEntry(profile, "공격력");
  const tooltip = cleanText(valueOf(attack, ["Tooltip", "tooltip"], ""));
  const basicAttackMatch = tooltip.match(/기본 공격력(?:은)?\s*(?<value>[\d,]+)/);
  const attackIncreaseMatch = tooltip.match(/공격력 증감 효과로 공격력이\s*(?<value>[\d,]+)\s*증가/);
  const profileAttackPower = toNumber(valueOf(attack, ["Value", "value"], 0));
  const basicAttackPower = toNumber(basicAttackMatch?.groups?.value, 0);
  const attackIncreasePower = toNumber(attackIncreaseMatch?.groups?.value, 0);

  return {
    ProfileAttackPower: profileAttackPower || null,
    BasicAttackPower: basicAttackPower || null,
    AttackIncreasePower: attackIncreasePower || null,
    TooltipText: tooltip
  };
}

function collectBasicAttackPercentSources({ equipment, gems }) {
  const sources = [];

  listOf({ gems }, ["gems"]).forEach((gem) => {
    listOf(gem, ["AdditionalEffects", "additionalEffects"]).forEach((effect) => {
      const name = valueOf(effect, ["Name", "name"], "");
      const value = toNumber(valueOf(effect, ["Value", "value"], 0));

      if (name === "기본 공격력" && value > 0) {
        sources.push({
          SourceType: "gem",
          SourceName: valueOf(gem, ["Name", "name"], "보석"),
          Percent: value
        });
      }
    });
  });

  listOf({ equipment }, ["equipment"]).forEach((item) => {
    const abilityStone = valueOf(item, ["AbilityStone", "abilityStone"], null);

    listOf(abilityStone, ["Effects", "effects"]).forEach((section) => {
      listOf(section, ["Lines", "lines"]).forEach((line) => {
        const match = cleanText(line).match(/^기본 공격력\s*\+?\s*(?<value>\d+(?:\.\d+)?)\s*%/);
        const value = toNumber(match?.groups?.value, 0);

        if (value > 0) {
          sources.push({
            SourceType: "abilityStone",
            SourceName: valueOf(item, ["Name", "name"], "어빌리티 스톤"),
            Percent: value
          });
        }
      });
    });
  });

  return sources;
}

function collectWeaponPowerPercentSources({ equipment, arkPassive }) {
  const sources = [];
  const enlightenmentProgress = parseRankLevel(valueOf(pointByName(arkPassive, "깨달음"), ["Description", "description"], ""));

  if (enlightenmentProgress.level > 0) {
    sources.push({
      SourceType: "arkPassiveKarma",
      SourceName: "깨달음 카르마 레벨",
      Percent: enlightenmentProgress.level * 0.1,
      Level: enlightenmentProgress.level
    });
  }

  listOf({ equipment }, ["equipment"]).forEach((item) => {
    const itemType = valueOf(item, ["Type", "type"], "");
    const itemName = valueOf(item, ["Name", "name"], itemType || "장비");

    listOf(item, ["DetailSections", "detailSections"]).forEach((section) => {
      const title = valueOf(section, ["Title", "title"], "");

      if (!/연마|팔찌 효과/.test(title)) {
        return;
      }

      listOf(section, ["Lines", "lines"]).forEach((line) => {
        const text = cleanText(line).replace(/^(상|중|하)\s+/, "");
        const match = text.match(/^무기 공격력\s*\+?\s*(?<value>\d+(?:\.\d+)?)\s*%/);
        const percent = toNumber(match?.groups?.value, 0);

        if (percent > 0) {
          sources.push({
            SourceType: "equipment",
            SourceName: itemName,
            ItemType: itemType,
            Percent: percent,
            Text: text
          });
        }
      });
    });
  });

  return sources;
}

function equipmentAttackFormula(equipment, weaponPowerPercent = 0) {
  const mainStat = listOf({ equipment }, ["equipment"]).reduce((total, item) => {
    return total + toNumber(valueOf(item, ["MainStatValue", "mainStatValue"], 0));
  }, 0);
  const weapon = listOf({ equipment }, ["equipment"]).find((item) => valueOf(item, ["Type", "type"], "") === "무기");
  const weaponStats = valueOf(weapon, ["WeaponStats", "weaponStats"], null);
  const weaponPowerSource = valueOf(weaponStats, ["WeaponPower", "weaponPower"], null);
  const weaponPower = toNumber(valueOf(weaponPowerSource, ["Value", "value"], 0));
  const effectiveWeaponPower = weaponPower > 0
    ? weaponPower * (1 + weaponPowerPercent / 100)
    : 0;
  const formulaBaseAttackPower = mainStat > 0 && weaponPower > 0
    ? Math.sqrt((mainStat * effectiveWeaponPower) / 6)
    : null;

  return {
    MainStatTotal: mainStat || null,
    WeaponPower: weaponPower || null,
    EffectiveWeaponPower: effectiveWeaponPower || null,
    WeaponName: valueOf(weapon, ["Name", "name"], ""),
    FormulaBaseAttackPower: formulaBaseAttackPower
  };
}

function buildAttackPowerModel({
  attackBreakdown,
  equipment,
  basicAttackPercent,
  basicAttackSources,
  weaponPowerPercent,
  weaponPowerPercentSources
}) {
  const basicAttackMultiplier = 1 + basicAttackPercent / 100;
  const equipmentFormula = equipmentAttackFormula(equipment, weaponPowerPercent);
  const profileBasicAttackPower = attackBreakdown.BasicAttackPower || null;
  const profileBaseAttackBeforeBasicPercent = profileBasicAttackPower
    ? profileBasicAttackPower / basicAttackMultiplier
    : null;
  const equipmentFormulaBaseAttackPower = equipmentFormula.FormulaBaseAttackPower;
  const selectedBaseAttackPower = profileBaseAttackBeforeBasicPercent || equipmentFormulaBaseAttackPower || null;
  const selectedBaseAttackSource = profileBaseAttackBeforeBasicPercent
    ? "profileBasicAttackReverse"
    : equipmentFormulaBaseAttackPower
      ? "equipmentFormula"
      : "missing";
  const selectedBasicAttackPower = profileBasicAttackPower || (
    selectedBaseAttackPower
      ? selectedBaseAttackPower * basicAttackMultiplier
      : null
  );
  const equipmentFormulaGap = profileBaseAttackBeforeBasicPercent && equipmentFormulaBaseAttackPower
    ? profileBaseAttackBeforeBasicPercent - equipmentFormulaBaseAttackPower
    : null;
  const equipmentFormulaGapPercent = equipmentFormulaGap && equipmentFormulaBaseAttackPower
    ? (equipmentFormulaGap / equipmentFormulaBaseAttackPower) * 100
    : null;
  const attackIncreasePercent = attackBreakdown.AttackIncreasePower && selectedBasicAttackPower
    ? (attackBreakdown.AttackIncreasePower / selectedBasicAttackPower) * 100
    : null;

  return {
    SelectedBaseAttackPower: selectedBaseAttackPower,
    SelectedBaseAttackSource: selectedBaseAttackSource,
    AttackBreakdown: {
      BasicAttackPercent: round(basicAttackPercent, 2),
      BasicAttackMultiplier: round(basicAttackMultiplier, 8),
      BasicAttackPercentSources: basicAttackSources,
      BaseAttackBeforeBasicPercent: selectedBaseAttackPower ? round(selectedBaseAttackPower, 2) : null,
      BaseAttackSource: selectedBaseAttackSource,
      ProfileBaseAttackBeforeBasicPercent: profileBaseAttackBeforeBasicPercent
        ? round(profileBaseAttackBeforeBasicPercent, 2)
        : null,
      SelectedBasicAttackPower: selectedBasicAttackPower ? round(selectedBasicAttackPower, 2) : null,
      EquipmentMainStatTotal: equipmentFormula.MainStatTotal,
      EquipmentWeaponPower: equipmentFormula.WeaponPower,
      EquipmentWeaponPowerPercent: round(weaponPowerPercent, 2),
      EquipmentWeaponPowerPercentSources: weaponPowerPercentSources,
      EquipmentEffectiveWeaponPower: equipmentFormula.EffectiveWeaponPower
        ? round(equipmentFormula.EffectiveWeaponPower, 2)
        : null,
      EquipmentEffectiveWeaponPowerDisplay: equipmentFormula.EffectiveWeaponPower
        ? floorDisplay(equipmentFormula.EffectiveWeaponPower)
        : null,
      EquipmentWeaponName: equipmentFormula.WeaponName,
      EquipmentFormulaBaseAttackPower: equipmentFormulaBaseAttackPower
        ? round(equipmentFormulaBaseAttackPower, 2)
        : null,
      EquipmentFormulaGap: equipmentFormulaGap ? round(equipmentFormulaGap, 2) : null,
      EquipmentFormulaGapPercent: equipmentFormulaGapPercent ? round(equipmentFormulaGapPercent, 2) : null,
      AttackIncreasePercent: attackIncreasePercent ? round(attackIncreasePercent, 2) : null
    }
  };
}

function gemPureCombatPowerFactors(gems) {
  return listOf({ gems }, ["gems"]).map((gem, index) => {
    const level = toNumber(valueOf(gem, ["Level", "level"], 0));
    const percent = GEM_PURE_COMBAT_POWER_FACTORS.get(level);

    if (!Number.isFinite(percent) || percent <= 0) {
      return null;
    }

    return {
      Id: `gem-pure-combat-power-${index}`,
      Category: "gems",
      Label: `${level}레벨 보석 순수 전투력`,
      Percent: percent,
      Level: level,
      SourceName: valueOf(gem, ["Name", "name"], "보석"),
      Confidence: "medium"
    };
  }).filter(Boolean);
}

function combatLevelFactor(profile) {
  const level = toNumber(valueOf(profile, ["CharacterLevel", "characterLevel"], 0));
  const rule = COMBAT_LEVEL_FACTORS.find((item) => level >= item.min);

  if (!rule) {
    return null;
  }

  return {
    Id: "combat-level",
    Category: "level",
    Label: rule.label,
    Percent: rule.percent,
    Confidence: "high"
  };
}

function weaponQualityFactor(equipment) {
  const weapon = listOf({ equipment }, ["equipment"]).find((item) => valueOf(item, ["Type", "type"], "") === "무기");
  const weaponStats = valueOf(weapon, ["WeaponStats", "weaponStats"], null);
  const additionalDamage = valueOf(weaponStats, ["AdditionalDamage", "additionalDamage"], null);
  const percent = toNumber(valueOf(additionalDamage, ["Value", "value"], 0));

  if (percent <= 0) {
    return null;
  }

  return {
    Id: "weapon-quality",
    Category: "weapon",
    Label: "무기 품질 추가 피해",
    Percent: percent,
    Confidence: "high"
  };
}

function pointByName(arkPassive, name) {
  return listOf(arkPassive, ["Points", "points"]).find((point) => valueOf(point, ["Name", "name"], "") === name) || null;
}

function parseTierLevel(description) {
  const text = cleanText(description);
  const match = text.match(/(?<tier>\d+)\s*티어.*?Lv\.(?<level>\d+)/);
  const tier = toNumber(match?.groups?.tier, 0);
  const level = toNumber(match?.groups?.level, 0);

  return tier > 0 && level > 0 ? { tier, level } : null;
}

function inferredEvolutionScoredPoints(arkPassive) {
  const total = toNumber(valueOf(pointByName(arkPassive, "진화"), ["Value", "value"], 0));
  const tierOneLevels = listOf(arkPassive, ["Effects", "effects"])
    .filter((effect) => valueOf(effect, ["Name", "name"], "") === "진화")
    .map((effect) => parseTierLevel(valueOf(effect, ["Description", "description"], "")))
    .filter((entry) => entry?.tier === 1)
    .reduce((sum, entry) => sum + entry.level, 0);

  return Math.max(0, total - tierOneLevels);
}

function parseRankLevel(description) {
  const text = cleanText(description);
  const match = text.match(/(?<rank>\d+)\s*랭크\s*(?<level>\d+)\s*레벨/);

  return {
    rank: toNumber(match?.groups?.rank, 0),
    level: toNumber(match?.groups?.level, 0)
  };
}

function arkPassiveFactors(arkPassive) {
  const factors = [];
  const selectedEffects = listOf(arkPassive, ["Effects", "effects"]);
  const hasSelectedEffects = selectedEffects.length > 0;
  const evolutionScoredPoints = inferredEvolutionScoredPoints(arkPassive);
  const enlightenmentRawPoints = toNumber(valueOf(pointByName(arkPassive, "깨달음"), ["Value", "value"], 0));
  const enlightenmentPoints = Math.min(enlightenmentRawPoints, ENLIGHTENMENT_POINT_COMBAT_POWER_CAP);
  const leapPoints = toNumber(valueOf(pointByName(arkPassive, "도약"), ["Value", "value"], 0));
  const evolutionRankLevel = parseRankLevel(valueOf(pointByName(arkPassive, "진화"), ["Description", "description"], ""));
  const leapRankLevel = parseRankLevel(valueOf(pointByName(arkPassive, "도약"), ["Description", "description"], ""));
  const pointEntries = [];

  if (hasSelectedEffects && evolutionScoredPoints > 0) {
    pointEntries.push({
      Id: "ark-evolution-points",
      Label: "진화 2T+ 추정 사용 포인트",
      Percent: evolutionScoredPoints * EVOLUTION_POINT_COMBAT_POWER_PERCENT,
      Points: evolutionScoredPoints,
      Confidence: "low"
    });
  }

  if (hasSelectedEffects && enlightenmentPoints > 0) {
    pointEntries.push({
      Id: "ark-enlightenment-points",
      Label: "깨달음 포인트",
      Percent: enlightenmentPoints * 0.7,
      Points: enlightenmentPoints,
      RawPoints: enlightenmentRawPoints,
      Cap: ENLIGHTENMENT_POINT_COMBAT_POWER_CAP,
      Confidence: "medium"
    });
  }

  if (hasSelectedEffects && leapPoints > 0) {
    pointEntries.push({
      Id: "ark-leap-points",
      Label: "도약 포인트",
      Percent: leapPoints * 0.2,
      Points: leapPoints,
      Confidence: "medium"
    });
  }

  if (pointEntries.length) {
    factors.push({
      Id: "ark-passive-points",
      Category: "arkPassive",
      Label: "아크패시브 포인트",
      Percent: pointEntries.reduce((total, entry) => total + entry.Percent, 0),
      Entries: pointEntries,
      Confidence: pointEntries.some((entry) => entry.Confidence === "low") ? "low" : "medium"
    });
  }

  if (evolutionRankLevel.rank > 0) {
    factors.push({
      Id: "karma-evolution-rank",
      Category: "karma",
      Label: "진화 카르마 랭크",
      Percent: evolutionRankLevel.rank * 0.6,
      Rank: evolutionRankLevel.rank,
      Confidence: "medium"
    });
  }

  if (leapRankLevel.level > 0) {
    factors.push({
      Id: "karma-leap-level",
      Category: "karma",
      Label: "도약 카르마 레벨",
      Percent: leapRankLevel.level * 0.02,
      Level: leapRankLevel.level,
      Confidence: "medium"
    });
  }

  return factors;
}

function combatStatsFactor(profile) {
  const crit = profileStatNumber(profile, "치명");
  const specialization = profileStatNumber(profile, "특화");
  const swiftness = profileStatNumber(profile, "신속");
  const total = crit + specialization + swiftness;

  if (total <= 0) {
    return null;
  }

  return {
    Id: "combat-stats",
    Category: "combatStats",
    Label: "치명+특화+신속",
    Percent: total * 0.03,
    StatTotal: total,
    Confidence: "high"
  };
}

function engravingKey(name) {
  return cleanText(name).replace(/\s+/g, "");
}

function engravingCombatPowerPercent(engraving) {
  const key = engravingKey(valueOf(engraving, ["Name", "name"], ""));
  const grade = cleanText(valueOf(engraving, ["Grade", "grade"], ""));

  if (grade.includes("전설")) {
    return LEGENDARY_ENGRAVING_COMBAT_POWER_FACTORS.get(key) ?? null;
  }

  return ENGRAVING_COMBAT_POWER_FACTORS.get(key) ?? null;
}

function engravingFactors(engravings) {
  return listOf({ engravings }, ["engravings"]).map((engraving, index) => {
    const name = cleanText(valueOf(engraving, ["Name", "name"], ""));
    const percent = engravingCombatPowerPercent(engraving);

    if (!name || !Number.isFinite(percent) || percent <= 0) {
      return null;
    }

    const grade = cleanText(valueOf(engraving, ["Grade", "grade"], ""));

    return {
      Id: `engraving-${index}-${engravingKey(name)}`,
      Category: "engraving",
      Label: `${name} 각인`,
      Percent: percent,
      Grade: grade,
      Level: valueOf(engraving, ["Level", "level"], null),
      AbilityStoneLevel: valueOf(engraving, ["AbilityStoneLevel", "abilityStoneLevel"], null),
      Confidence: "medium"
    };
  }).filter(Boolean);
}

function factorFromPercentMap(map, value, fallback = null) {
  const roundedValue = round(value, 2);

  if (map.has(roundedValue)) {
    return map.get(roundedValue);
  }

  return fallback;
}

function accessoryFactorFromLine(itemType, line, key) {
  const text = cleanText(line).replace(/^(상|중|하)\s+/, "");
  const outgoingMatch = text.match(/^적에게 주는 피해\s*\+?\s*(?<value>\d+(?:\.\d+)?)\s*%/);
  const additionalMatch = text.match(/^추가 피해\s*\+?\s*(?<value>\d+(?:\.\d+)?)\s*%/);
  const attackPercentMatch = text.match(/^공격력\s*\+?\s*(?<value>\d+(?:\.\d+)?)\s*%/);
  const attackFlatMatch = text.match(/^공격력\s*\+?\s*(?<value>\d+)$/);
  const critRateMatch = text.match(/^치명타 적중률\s*\+?\s*(?<value>\d+(?:\.\d+)?)\s*%/);
  const critDamageMatch = text.match(/^치명타 피해\s*\+?\s*(?<value>\d+(?:\.\d+)?)\s*%/);

  if (outgoingMatch) {
    const value = toNumber(outgoingMatch.groups.value, 0);

    return {
      Id: `accessory-${key}`,
      Category: "accessories",
      Label: `${itemType} 적에게 주는 피해`,
      Percent: value,
      Confidence: "high",
      Text: text
    };
  }

  if (additionalMatch && itemType === "목걸이") {
    const value = toNumber(additionalMatch.groups.value, 0);

    return {
      Id: `accessory-${key}`,
      Category: "accessories",
      Label: "목걸이 추가 피해",
      Percent: factorFromPercentMap(NECK_ADDITIONAL_DAMAGE_FACTORS, value, (value / 130) * 100),
      Confidence: "high",
      Text: text
    };
  }

  if (attackPercentMatch) {
    const value = toNumber(attackPercentMatch.groups.value, 0);

    return {
      Id: `accessory-${key}`,
      Category: "accessories",
      Label: `${itemType} 공격력 %`,
      Percent: value,
      Confidence: "high",
      Text: text
    };
  }

  if (attackFlatMatch) {
    const value = toNumber(attackFlatMatch.groups.value, 0);

    return {
      Id: `accessory-${key}`,
      Category: "accessories",
      Label: `${itemType} 공격력 +`,
      Percent: (value / FLAT_ATTACK_REFERENCE) * 100,
      Confidence: "high",
      Text: text
    };
  }

  if (critRateMatch && itemType === "반지") {
    const value = toNumber(critRateMatch.groups.value, 0);

    return {
      Id: `accessory-${key}`,
      Category: "accessories",
      Label: "반지 치명타 적중률",
      Percent: factorFromPercentMap(RING_CRIT_RATE_FACTORS, value, value * 0.7742),
      Confidence: "high",
      Text: text
    };
  }

  if (critDamageMatch && itemType === "반지") {
    const value = toNumber(critDamageMatch.groups.value, 0);

    return {
      Id: `accessory-${key}`,
      Category: "accessories",
      Label: "반지 치명타 피해",
      Percent: factorFromPercentMap(RING_CRIT_DAMAGE_FACTORS, value, value * 0.3),
      Confidence: "high",
      Text: text
    };
  }

  return null;
}

function accessoryFactors(equipment) {
  const factors = [];

  listOf({ equipment }, ["equipment"]).forEach((item, itemIndex) => {
    const itemType = valueOf(item, ["Type", "type"], "");

    if (!["목걸이", "귀걸이", "반지"].includes(itemType)) {
      return;
    }

    listOf(item, ["DetailSections", "detailSections"]).forEach((section, sectionIndex) => {
      const title = valueOf(section, ["Title", "title"], "");

      if (!/연마/.test(title)) {
        return;
      }

      listOf(section, ["Lines", "lines"]).forEach((line, lineIndex) => {
        const factor = accessoryFactorFromLine(itemType, line, `${itemIndex}-${sectionIndex}-${lineIndex}`);

        if (factor) {
          factors.push(factor);
        }
      });
    });
  });

  return factors;
}

function braceletFactors(equipment) {
  const factors = [];
  const bracelets = listOf({ equipment }, ["equipment"]).filter((item) => valueOf(item, ["Type", "type"], "") === "팔찌");

  bracelets.forEach((bracelet, braceletIndex) => {
    listOf(bracelet, ["DetailSections", "detailSections"]).forEach((section, sectionIndex) => {
      const title = valueOf(section, ["Title", "title"], "");

      if (!/팔찌 효과/.test(title)) {
        return;
      }

      listOf(section, ["Lines", "lines"]).forEach((line, lineIndex) => {
        const text = cleanText(line);
        const outgoingMatch = text.match(/적에게 주는 피해가\s*(?<value>\d+(?:\.\d+)?)\s*%\s*증가/);
        const value = toNumber(outgoingMatch?.groups?.value, 0);

        if (value > 0) {
          factors.push({
            Id: `bracelet-${braceletIndex}-${sectionIndex}-${lineIndex}`,
            Category: "bracelet",
            Label: "팔찌 적에게 주는 피해",
            Percent: value,
            Confidence: "medium",
            Text: text
          });
        }
      });
    });
  });

  return factors;
}

function arkGridGradeKey(grade) {
  const text = cleanText(grade);

  if (text.includes("고대")) {
    return "ancient";
  }

  if (text.includes("유물")) {
    return "relic";
  }

  return "";
}

function arkGridCoreInfo(slot) {
  const name = cleanText(valueOf(slot, ["Name", "name"], ""));
  const typeMatch = name.match(/(?<alignment>질서|혼돈)의\s*(?<shape>해|달|별)/);
  const nameParts = name.split(":");
  const optionName = nameParts.length > 1 ? nameParts[nameParts.length - 1].trim() : "";

  if (!typeMatch?.groups) {
    return null;
  }

  return {
    name,
    alignment: typeMatch.groups.alignment,
    shape: typeMatch.groups.shape,
    optionName,
    point: toNumber(valueOf(slot, ["Point", "point"], 0)),
    grade: cleanText(valueOf(slot, ["Grade", "grade"], "")),
    gradeKey: arkGridGradeKey(valueOf(slot, ["Grade", "grade"], ""))
  };
}

function arkGridPointPercent(table, point) {
  const threshold = ARK_GRID_POINT_THRESHOLDS
    .filter((value) => point >= value)
    .at(-1);

  return threshold ? table?.[threshold] ?? null : null;
}

function arkGridOrderPercent(info) {
  const gradeFactors = ARK_GRID_ORDER_FACTORS[info.gradeKey];
  const shapeFactors = info.shape === "별" ? gradeFactors?.star : gradeFactors?.sunMoon;

  return arkGridPointPercent(shapeFactors, info.point);
}

function arkGridChaosPercent(info) {
  const basePercent = arkGridPointPercent(ARK_GRID_CHAOS_FACTORS[info.shape]?.[info.optionName], info.point);
  const ancientDirectBonus = info.gradeKey === "ancient"
    && info.point >= 17
    && (info.shape !== "별" || info.optionName === "공격");

  if (!Number.isFinite(basePercent)) {
    return null;
  }

  return ancientDirectBonus ? basePercent + 1 : basePercent;
}

function arkGridGemEffectKind(name, text) {
  if (name === "공격력" || /^공격력\s*\+/.test(text)) {
    return "attackPower";
  }

  if (name === "추가 피해" || /^추가\s*피해\s*\+/.test(text)) {
    return "additionalDamage";
  }

  if (name === "보스 피해" || /^보스\s*등급\s*이상\s*몬스터에게\s*주는\s*피해\s*\+/.test(text)) {
    return "bossDamage";
  }

  if (/^무기(?:\s*공격력)?$/.test(name) || /^무기\s*공격력\s*\+/.test(text)) {
    return "weaponPower";
  }

  return "";
}

function arkGridGemEffectPercent(kind, value) {
  if (kind === "additionalDamage") {
    return factorFromPercentMap(NECK_ADDITIONAL_DAMAGE_FACTORS, value, (value / 130) * 100);
  }

  if (kind === "weaponPower") {
    return (Math.sqrt(1 + value / 100) - 1) * 100;
  }

  return value;
}

function arkGridGemEffectLabel(kind) {
  switch (kind) {
    case "attackPower":
      return "아크그리드 젬 공격력";
    case "additionalDamage":
      return "아크그리드 젬 추가 피해";
    case "bossDamage":
      return "아크그리드 젬 보스 피해";
    case "weaponPower":
      return "아크그리드 젬 무기 공격력";
    default:
      return "아크그리드 젬";
  }
}

function arkGridGemFactorFromText(text, key, sourceName = "아크그리드 젬") {
  const normalizedText = cleanText(text);
  const valueMatch = normalizedText.match(/(?<value>\d+(?:\.\d+)?)\s*%/);
  const value = toNumber(valueMatch?.groups?.value, 0);
  const kind = arkGridGemEffectKind("", normalizedText);
  const percent = arkGridGemEffectPercent(kind, value);

  if (!kind || value <= 0 || !Number.isFinite(percent) || percent <= 0) {
    return null;
  }

  return {
    Id: `ark-grid-gem-${key}`,
    Category: "arkGridGem",
    Label: arkGridGemEffectLabel(kind),
    Percent: round(percent, 5),
    AppliesToEstimate: false,
    SourceName: sourceName,
    RawPercent: value,
    Text: normalizedText,
    Confidence: kind === "weaponPower" ? "low" : "medium"
  };
}

function arkGridGemFactorFromEffect(effect, index) {
  const name = cleanText(valueOf(effect, ["Name", "name"], ""));
  const text = cleanText(valueOf(effect, ["Tooltip", "ToolTip", "tooltip"], ""));
  const valueMatch = text.match(/(?<value>\d+(?:\.\d+)?)\s*%/);
  const value = toNumber(valueMatch?.groups?.value, 0);
  const kind = arkGridGemEffectKind(name, text);
  const percent = arkGridGemEffectPercent(kind, value);

  if (!kind || value <= 0 || !Number.isFinite(percent) || percent <= 0) {
    return null;
  }

  return {
    Id: `ark-grid-gem-effect-${index}`,
    Category: "arkGridGem",
    Label: arkGridGemEffectLabel(kind),
    Percent: round(percent, 5),
    AppliesToEstimate: false,
    SourceName: name,
    RawPercent: value,
    Text: text,
    Confidence: kind === "weaponPower" ? "low" : "medium"
  };
}

function arkGridGemFactors(arkGrid) {
  const effects = listOf(arkGrid, ["Effects", "effects"]);

  if (effects.length) {
    return effects.map(arkGridGemFactorFromEffect).filter(Boolean);
  }

  return listOf(arkGrid, ["Slots", "slots"]).flatMap((slot, slotIndex) => {
    const slotName = valueOf(slot, ["Name", "name"], "아크그리드");

    return listOf(slot, ["Gems", "gems"])
      .filter((gem) => valueOf(gem, ["IsActive", "isActive"], true))
      .flatMap((gem, gemIndex) => collectText(valueOf(gem, ["Tooltip", "ToolTip", "tooltip"], ""))
        .map((line, lineIndex) => arkGridGemFactorFromText(
          line,
          `${slotIndex}-${gemIndex}-${lineIndex}`,
          `${slotName} 젬`
        ))
        .filter(Boolean));
  });
}

function arkGridFactors(arkGrid) {
  const coreFactors = listOf(arkGrid, ["Slots", "slots"])
    .map((slot, index) => {
      const info = arkGridCoreInfo(slot);

      if (!info) {
        return null;
      }

      const percent = info.alignment === "질서" ? arkGridOrderPercent(info) : arkGridChaosPercent(info);

      if (!Number.isFinite(percent) || percent <= 0) {
        return null;
      }

      return {
        Id: `ark-grid-core-${index}`,
        Category: "arkGrid",
        Label: `${info.grade} ${info.alignment} ${info.shape}${info.optionName ? ` ${info.optionName}` : ""}`,
        Percent: percent,
        Point: info.point,
        Confidence: info.alignment === "질서" ? "medium" : "low"
      };
    })
    .filter(Boolean);

  return [
    ...coreFactors,
    ...arkGridGemFactors(arkGrid)
  ];
}

function normalizeFactor(factor) {
  const percent = toNumber(valueOf(factor, ["Percent", "percent"], 0));

  if (!Number.isFinite(percent) || percent === 0) {
    return null;
  }

  const multiplier = round(1 + percent / 100, 8);
  const appliesToEstimate = valueOf(factor, ["AppliesToEstimate", "appliesToEstimate"], true) !== false;

  return {
    ...factor,
    Percent: round(percent, 5),
    AppliesToEstimate: appliesToEstimate,
    Multiplier: multiplier,
    EstimateMultiplier: appliesToEstimate ? multiplier : 1
  };
}

function summarizeFactors(factors) {
  const groups = new Map();

  factors.forEach((factor) => {
    const category = factor.Category;
    const current = groups.get(category) || {
      Category: category,
      Count: 0,
      Multiplier: 1,
      EstimateMultiplier: 1,
      Percent: 0,
      Confidence: factor.Confidence
    };

    current.Count += 1;
    current.Multiplier *= factor.Multiplier;
    current.EstimateMultiplier *= factor.EstimateMultiplier;
    groups.set(category, current);
  });

  return Array.from(groups.values()).map((group) => ({
    ...group,
    Multiplier: round(group.Multiplier, 8),
    EstimateMultiplier: round(group.EstimateMultiplier, 8),
    Percent: round((group.Multiplier - 1) * 100, 2),
    EstimatePercent: round((group.EstimateMultiplier - 1) * 100, 2)
  }));
}

function buildMissingInputs({ baseAttackPower, baseAttackSource, arkPassive, arkGrid, paradisePower, engravings }) {
  const missing = [];

  if (!baseAttackPower) {
    missing.push("프로필 기본 공격력 툴팁/장비식 순수공 모두 없음. 공격력 기반 전투력 계산 불가.");
  } else if (baseAttackSource === "equipmentFormula") {
    missing.push("프로필 기본 공격력 툴팁 없음. 장비식 순수공 fallback 사용. 영구 스탯 전체를 못 담을 수 있음.");
  }

  if (!paradisePower) {
    missing.push("보주 시즌2 달성 최대 낙원력 없음. 원본 장비 보주 툴팁에서 추출 필요.");
  } else if (!PARADISE_ORB_COMBAT_POWER_RULES[valueOf(paradisePower, ["EffectRole", "effectRole"], "unknown")]) {
    missing.push("보주 낙원력 추출 완료. 공격형/보조형 분류 실패로 전투력 계수 미적용.");
  } else {
    missing.push("보주 낙원력 전투력 계수 적용. 공격형/보조형 분류는 보주 특수 효과 툴팁 기반.");
  }

  if (arkPassive) {
    missing.push("아크패시브 포인트는 진화/깨달음/도약을 같은 bucket 안에서 합산. 진화 점수는 1티어 특성 레벨을 뺀 추정치.");
    missing.push("깨달음 전투력 포인트는 최대 100P까지만 반영.");
  }

  if (!listOf(arkGrid, ["Slots", "slots"]).length) {
    missing.push("아크그리드 코어 정보를 찾지 못함.");
  } else {
    missing.push("아크그리드 코어는 질서/혼돈 10/14/17/18/19/20P 표 반영. 젬은 공격력/추가 피해/보스 피해/무기 공격력 수치만 진단 표시하고 estimate에는 중복 방지로 미적용.");
  }

  if (listOf({ engravings }, ["engravings"]).length) {
    missing.push("각인은 인벤 106460 딜러 유물 각인 반영값 표 기반. 표 없는/0% 각인은 미적용.");
    missing.push("전설 각인은 원문에 수치가 공개된 일부 각인만 별도 반영.");
    missing.push("어빌리티 스톤의 각인별 추가 전투력 계수는 수치표 미확보로 별도 가산하지 않음.");
  } else {
    missing.push("각인 정보 없음. 각인 전투력 계수 미적용.");
  }

  missing.push("진화 첫줄 스탯 포인트는 제외하고 2T-4T 사용 포인트만 포인트당 0.5%로 반영.");
  missing.push("일반 스킬 보석은 기본공%와 별도 4티어 레벨별 순수 전투력 계수를 함께 반영.");
  missing.push("팔찌 특수 옵션/조건부 무기공격력은 일부만 반영.");

  return missing;
}

export function buildCombatPowerAnalysis({
  profile = {},
  equipment = [],
  paradiseOrb = null,
  arkPassive = {},
  arkGrid = {},
  engravings = [],
  gems = []
} = {}) {
  const officialCombatPower = parseOfficialCombatPower(profile);
  const paradisePower = parseParadisePower(paradiseOrb);
  const attackBreakdown = parseAttackBreakdown(profile);
  const basicAttackSources = collectBasicAttackPercentSources({ equipment, gems });
  const basicAttackPercent = basicAttackSources.reduce((total, source) => total + source.Percent, 0);
  const weaponPowerPercentSources = collectWeaponPowerPercentSources({ equipment, arkPassive });
  const weaponPowerPercent = weaponPowerPercentSources.reduce((total, source) => total + source.Percent, 0);
  const attackModel = buildAttackPowerModel({
    attackBreakdown,
    equipment,
    basicAttackPercent,
    basicAttackSources,
    weaponPowerPercent,
    weaponPowerPercentSources
  });
  const baseAttackBeforeBasicPercent = attackModel.SelectedBaseAttackPower;
  const factors = [
    basicAttackPercent > 0
      ? {
          Id: "basic-attack-percent",
          Category: "baseAttack",
          Label: "기본 공격력 %",
          Percent: basicAttackPercent,
          Sources: basicAttackSources,
          Confidence: "medium"
        }
      : null,
    combatLevelFactor(profile),
    weaponQualityFactor(equipment),
    ...gemPureCombatPowerFactors(gems),
    ...arkPassiveFactors(arkPassive),
    combatStatsFactor(profile),
    ...engravingFactors(engravings),
    paradiseOrbFactor(paradisePower),
    ...accessoryFactors(equipment),
    ...braceletFactors(equipment),
    ...arkGridFactors(arkGrid)
  ].map(normalizeFactor).filter(Boolean);
  const knownFactorMultiplier = factors.reduce((product, factor) => product * factor.EstimateMultiplier, 1);
  const effectiveCoefficient = SOURCE_BASE_COEFFICIENT * IN_GAME_DISPLAY_SCALE;
  const baseScore = baseAttackBeforeBasicPercent ? baseAttackBeforeBasicPercent * effectiveCoefficient : null;
  const formulaEstimate = baseScore ? baseScore * knownFactorMultiplier : null;
  const officialCombatPowerFloor = floorDisplay(officialCombatPower);
  const formulaEstimateFloor = floorDisplay(formulaEstimate);
  const calibrationRatio = officialCombatPower && formulaEstimate ? officialCombatPower / formulaEstimate : null;
  const calibratedEstimate = formulaEstimate && calibrationRatio ? formulaEstimate * calibrationRatio : null;

  return {
    Status: baseAttackBeforeBasicPercent ? "partial" : "unavailable",
    OfficialCombatPower: officialCombatPower,
    OfficialCombatPowerFloor: officialCombatPowerFloor,
    ParadisePower: paradisePower,
    AttackBreakdown: {
      ...attackBreakdown,
      ...attackModel.AttackBreakdown
    },
    Formula: {
      SourceBaseCoefficient: SOURCE_BASE_COEFFICIENT,
      InGameDisplayScale: IN_GAME_DISPLAY_SCALE,
      EffectiveCoefficient: effectiveCoefficient,
      BaseScore: baseScore ? round(baseScore, 2) : null,
      KnownFactorMultiplier: round(knownFactorMultiplier, 8),
      Estimate: formulaEstimate ? round(formulaEstimate, 2) : null,
      EstimateFloor: formulaEstimateFloor,
      DeltaFromOfficial: officialCombatPower && formulaEstimate ? round(formulaEstimate - officialCombatPower, 2) : null,
      DeltaFromOfficialPercent: officialCombatPower && formulaEstimate
        ? round(((formulaEstimate - officialCombatPower) / officialCombatPower) * 100, 2)
        : null,
      DeltaFromOfficialFloor: officialCombatPowerFloor !== null && formulaEstimateFloor !== null
        ? formulaEstimateFloor - officialCombatPowerFloor
        : null,
      CalibrationRatio: calibrationRatio ? round(calibrationRatio, 6) : null,
      CalibratedEstimate: calibratedEstimate ? round(calibratedEstimate, 2) : null
    },
    Factors: factors,
    CategorySummary: summarizeFactors(factors),
    MissingInputs: buildMissingInputs({
      baseAttackPower: baseAttackBeforeBasicPercent,
      baseAttackSource: attackModel.SelectedBaseAttackSource,
      arkPassive,
      arkGrid,
      paradisePower,
      engravings
    })
  };
}
