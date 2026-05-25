import { buildAccessoryContributionIndex } from "./accessoryContributions.js";
import { buildCombatPowerAnalysis } from "./combatPowerModel.js";

const AVATAR_SLOT_TARGETS = [
  { slot: "무기", typePattern: /무기/ },
  { slot: "머리", typePattern: /머리/ },
  { slot: "상의", typePattern: /상의/ },
  { slot: "하의", typePattern: /하의/ }
];

const WEAPON_HONING_MATERIALS = [
  {
    key: "destiny-destruction-stone-crystal",
    name: "운명의 파괴석 결정",
    groupId: "honing-materials",
    matchNames: ["운명의 파괴석 결정"]
  },
  {
    key: "great-destiny-leapstone",
    name: "위대한 운명의 돌파석",
    groupId: "honing-materials",
    matchNames: ["위대한 운명의 돌파석"]
  },
  {
    key: "superior-abidos-fusion-material",
    name: "상급 아비도스 융화제",
    groupId: "honing-materials",
    matchNames: ["상급 아비도스 융화 재료", "상급 아비도스 융화제"]
  },
  {
    key: "destiny-shard",
    name: "운명의 파편",
    groupId: "honing-materials",
    matchPattern: /^운명의 파편 주머니/
  },
  {
    key: "lava-breath",
    name: "용암의 숨결",
    groupId: "honing-supports",
    matchNames: ["용암의 숨결"],
    isAdditionalMaterial: true
  }
];

const ARMOR_HONING_MATERIALS = [
  {
    key: "destiny-guardian-stone-crystal",
    name: "운명의 수호석 결정",
    groupId: "honing-materials",
    matchNames: ["운명의 수호석 결정"]
  },
  {
    key: "great-destiny-leapstone",
    name: "위대한 운명의 돌파석",
    groupId: "honing-materials",
    matchNames: ["위대한 운명의 돌파석"]
  },
  {
    key: "superior-abidos-fusion-material",
    name: "상급 아비도스 융화제",
    groupId: "honing-materials",
    matchNames: ["상급 아비도스 융화 재료", "상급 아비도스 융화제"]
  },
  {
    key: "destiny-shard",
    name: "운명의 파편",
    groupId: "honing-materials",
    matchPattern: /^운명의 파편 주머니/
  },
  {
    key: "glacier-breath",
    name: "빙하의 숨결",
    groupId: "honing-supports",
    matchNames: ["빙하의 숨결"],
    isAdditionalMaterial: true
  }
];

const WEAPON_POWER_BY_LEVEL = {
  11: 167706,
  12: 172473,
  13: 177406,
  14: 182514,
  15: 187799,
  16: 193270,
  17: 198101,
  18: 203054,
  19: 208130,
  20: 213333,
  21: 218667,
  22: 224133,
  23: 229737,
  24: 235480,
  25: 241367
};

const ARMOR_MAIN_STAT_BY_SLOT = {
  투구: [96801, 99554, 102404, 105353, 108406, 111565, 114358, 117218, 120150, 123155, 126236, 129393, 132629, 135946, 139346],
  어깨: [103023, 105954, 108987, 112126, 115375, 118738, 121709, 124754, 127874, 131072, 134351, 137711, 141155, 144686, 148304],
  상의: [77441, 79643, 81923, 84282, 86724, 89251, 91485, 93773, 96119, 98523, 100988, 103514, 106103, 108757, 111477],
  하의: [83664, 86043, 88506, 91055, 93694, 96424, 98838, 101310, 103844, 106441, 109104, 111833, 114630, 117497, 120436],
  장갑: [116161, 119465, 122885, 126424, 130088, 133879, 137231, 140663, 144181, 147787, 151484, 155272, 159155, 163135, 167215]
};

const HONING_PROBABILITY_BY_TARGET_LEVEL = {
  12: 0.05,
  13: 0.05,
  14: 0.04,
  15: 0.04,
  16: 0.04,
  17: 0.03,
  18: 0.03,
  19: 0.03,
  20: 0.015,
  21: 0.015,
  22: 0.01,
  23: 0.01,
  24: 0.005,
  25: 0.005
};

const HONING_BREATH_BY_TARGET_LEVEL = {
  12: { max: 20, probability: 0.0025 },
  13: { max: 20, probability: 0.0025 },
  14: { max: 20, probability: 0.002 },
  15: { max: 20, probability: 0.002 },
  16: { max: 20, probability: 0.002 },
  17: { max: 25, probability: 0.0012 },
  18: { max: 25, probability: 0.0012 },
  19: { max: 25, probability: 0.0012 },
  20: { max: 25, probability: 0.0006 },
  21: { max: 25, probability: 0.0006 },
  22: { max: 25, probability: 0.0004 },
  23: { max: 25, probability: 0.0004 },
  24: { max: 50, probability: 0.0002 },
  25: { max: 50, probability: 0.0002 }
};

const WEAPON_HONING_AMOUNTS_BY_TARGET_LEVEL = {
  12: { stone: 1700, leapstone: 17, fusion: 18, shard: 15890, gold: 4050 },
  13: { stone: 1890, leapstone: 19, fusion: 21, shard: 17660, gold: 4500 },
  14: { stone: 2080, leapstone: 21, fusion: 23, shard: 19420, gold: 4950 },
  15: { stone: 2270, leapstone: 23, fusion: 25, shard: 21190, gold: 5400 },
  16: { stone: 2460, leapstone: 25, fusion: 27, shard: 22960, gold: 5850 },
  17: { stone: 2690, leapstone: 28, fusion: 29, shard: 25120, gold: 6400 },
  18: { stone: 2900, leapstone: 30, fusion: 32, shard: 27080, gold: 6900 },
  19: { stone: 3110, leapstone: 32, fusion: 34, shard: 29040, gold: 7400 },
  20: { stone: 3340, leapstone: 34, fusion: 37, shard: 31200, gold: 7950 },
  21: { stone: 3570, leapstone: 37, fusion: 39, shard: 33360, gold: 8500 },
  22: { stone: 3800, leapstone: 39, fusion: 42, shard: 35520, gold: 9050 },
  23: { stone: 4030, leapstone: 42, fusion: 44, shard: 37680, gold: 9600 },
  24: { stone: 4260, leapstone: 44, fusion: 47, shard: 39840, gold: 10150 },
  25: { stone: 4500, leapstone: 47, fusion: 50, shard: 42000, gold: 10700 }
};

const ARMOR_HONING_AMOUNTS_BY_TARGET_LEVEL = {
  12: { stone: 930, leapstone: 11, fusion: 11, shard: 9570, gold: 2450 },
  13: { stone: 1030, leapstone: 12, fusion: 12, shard: 10540, gold: 2700 },
  14: { stone: 1120, leapstone: 13, fusion: 13, shard: 11520, gold: 2950 },
  15: { stone: 1240, leapstone: 14, fusion: 15, shard: 12690, gold: 3250 },
  16: { stone: 1330, leapstone: 15, fusion: 16, shard: 13670, gold: 3500 },
  17: { stone: 1450, leapstone: 17, fusion: 17, shard: 14840, gold: 3800 },
  18: { stone: 1560, leapstone: 18, fusion: 19, shard: 16010, gold: 4100 },
  19: { stone: 1700, leapstone: 20, fusion: 20, shard: 17380, gold: 4450 },
  20: { stone: 1810, leapstone: 21, fusion: 22, shard: 18550, gold: 4750 },
  21: { stone: 1950, leapstone: 23, fusion: 23, shard: 19920, gold: 5100 },
  22: { stone: 2080, leapstone: 24, fusion: 25, shard: 21280, gold: 5450 },
  23: { stone: 2200, leapstone: 26, fusion: 26, shard: 22460, gold: 5750 },
  24: { stone: 2330, leapstone: 27, fusion: 28, shard: 23820, gold: 6100 },
  25: { stone: 2450, leapstone: 29, fusion: 30, shard: 25000, gold: 6400 }
};

const SHARD_POUCH_SIZES = {
  "운명의 파편 주머니(소)": 500,
  "운명의 파편 주머니(중)": 1000,
  "운명의 파편 주머니(대)": 1500
};

const GEM_BASIC_ATTACK_PERCENT_BY_LEVEL = {
  7: 0.6,
  8: 0.8,
  9: 1,
  10: 1.2
};

const JANGIN_ACCUMULATE_DIVIDER = 2.15;

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

function toNumber(value, fallback = null) {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

function round(value, digits = 2) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  const multiplier = 10 ** digits;
  return Math.round((number + Number.EPSILON) * multiplier) / multiplier;
}

function findGroup(snapshot, id) {
  return listOf(snapshot, ["groups", "Groups"]).find((group) => valueOf(group, ["id", "Id"], "") === id) || null;
}

function minByPrice(items) {
  return listOf({ items }, ["items"])
    .filter((item) => Number.isFinite(Number(valueOf(item, ["currentMinPrice", "CurrentMinPrice"], null))))
    .sort((left, right) => Number(valueOf(left, ["currentMinPrice", "CurrentMinPrice"], 0)) - Number(valueOf(right, ["currentMinPrice", "CurrentMinPrice"], 0)))[0] || null;
}

function normalizeMarketCostItem(item) {
  const currentMinPrice = toNumber(valueOf(item, ["currentMinPrice", "CurrentMinPrice"], null), null);
  const bundleCount = toNumber(valueOf(item, ["bundleCount", "BundleCount"], 1), 1) || 1;

  return {
    Name: valueOf(item, ["name", "Name"], "이름 없음"),
    Grade: valueOf(item, ["grade", "Grade"], ""),
    CurrentMinPrice: currentMinPrice,
    BundleCount: bundleCount,
    UnitPrice: currentMinPrice === null ? null : round(currentMinPrice / bundleCount, 4),
    RecentPrice: toNumber(valueOf(item, ["recentPrice", "RecentPrice"], null), null),
    YesterdayAveragePrice: toNumber(valueOf(item, ["yesterdayAveragePrice", "YDayAvgPrice"], null), null)
  };
}

function marketItemName(item) {
  return valueOf(item, ["name", "Name"], "");
}

function matchesWeaponHoningMaterial(item, material) {
  const name = marketItemName(item);

  if (material.matchNames?.includes(name)) {
    return true;
  }

  return Boolean(material.matchPattern?.test(name));
}

function byUnitPrice(left, right) {
  const leftPrice = left.UnitPrice ?? Number.MAX_SAFE_INTEGER;
  const rightPrice = right.UnitPrice ?? Number.MAX_SAFE_INTEGER;

  return leftPrice - rightPrice || (left.CurrentMinPrice ?? Number.MAX_SAFE_INTEGER) - (right.CurrentMinPrice ?? Number.MAX_SAFE_INTEGER);
}

function buildWeaponHoningMaterialInput(snapshot, material) {
  const groupItems = listOf(findGroup(snapshot, material.groupId), ["items", "Items"]);
  const marketOptions = groupItems
    .filter((item) => matchesWeaponHoningMaterial(item, material))
    .map(normalizeMarketCostItem)
    .sort(byUnitPrice);
  const selected = marketOptions[0] || null;

  return {
    Key: material.key,
    Name: material.name,
    SourceName: selected?.Name || "",
    Grade: selected?.Grade || "",
    CurrentMinPrice: selected?.CurrentMinPrice ?? null,
    BundleCount: selected?.BundleCount ?? null,
    UnitPrice: selected?.UnitPrice ?? null,
    RecentPrice: selected?.RecentPrice ?? null,
    YesterdayAveragePrice: selected?.YesterdayAveragePrice ?? null,
    IsAdditionalMaterial: Boolean(material.isAdditionalMaterial),
    IsAvailable: Boolean(selected),
    MarketOptions: marketOptions
  };
}

function buildHoningCostInputs(snapshot) {
  const materials = listOf(findGroup(snapshot, "honing-materials"), ["items", "Items"]).map(normalizeMarketCostItem);
  const supports = listOf(findGroup(snapshot, "honing-supports"), ["items", "Items"]).map(normalizeMarketCostItem);

  return {
    Materials: materials,
    Supports: supports,
    WeaponMaterials: WEAPON_HONING_MATERIALS.map((material) => buildWeaponHoningMaterialInput(snapshot, material)),
    ArmorMaterials: ARMOR_HONING_MATERIALS.map((material) => buildWeaponHoningMaterialInput(snapshot, material))
  };
}

function buildHoningMissingInputs(honingCostInputs) {
  const missingMaterials = [
    ...listOf(honingCostInputs, ["WeaponMaterials"]),
    ...listOf(honingCostInputs, ["ArmorMaterials"])
  ]
    .filter((item) => !item.IsAvailable)
    .map((item) => item.Name);
  const uniqueMissingMaterials = [...new Set(missingMaterials)];

  if (uniqueMissingMaterials.length === 0) {
    return [];
  }

  return [`강화 재료 시세 누락: ${uniqueMissingMaterials.join(", ")}`];
}

function findHoningMaterial(costInputs, name) {
  return [
    ...listOf(costInputs, ["WeaponMaterials"]),
    ...listOf(costInputs, ["ArmorMaterials"])
  ].find((item) => item.Name === name) || null;
}

function shardUnitPrice(material) {
  return listOf(material, ["MarketOptions"])
    .map((option) => {
      const shardCount = SHARD_POUCH_SIZES[option.Name];

      if (!shardCount || !Number.isFinite(option.CurrentMinPrice)) {
        return null;
      }

      return option.CurrentMinPrice / shardCount;
    })
    .filter((price) => Number.isFinite(price) && price > 0)
    .sort((left, right) => left - right)[0] ?? null;
}

function honingUnitPrices(costInputs, type) {
  const stoneName = type === "weapon" ? "운명의 파괴석 결정" : "운명의 수호석 결정";
  const breathName = type === "weapon" ? "용암의 숨결" : "빙하의 숨결";
  const stone = findHoningMaterial(costInputs, stoneName);
  const leapstone = findHoningMaterial(costInputs, "위대한 운명의 돌파석");
  const fusion = findHoningMaterial(costInputs, "상급 아비도스 융화제");
  const shard = findHoningMaterial(costInputs, "운명의 파편");
  const breath = findHoningMaterial(costInputs, breathName);

  return {
    stone: stone?.UnitPrice ?? null,
    leapstone: leapstone?.UnitPrice ?? null,
    fusion: fusion?.UnitPrice ?? null,
    shard: shardUnitPrice(shard),
    breath: breath?.UnitPrice ?? null
  };
}

function hasAllPrices(prices) {
  return Object.values(prices).every((price) => Number.isFinite(price) && price > 0);
}

function round4Probability(value) {
  return Math.round(value * 10000) / 10000;
}

function baseHoningTryCost(amounts, prices) {
  return amounts.gold
    + amounts.stone * prices.stone
    + amounts.leapstone * prices.leapstone
    + amounts.fusion * prices.fusion
    + amounts.shard * prices.shard;
}

function expectedHoningCost({ type, targetLevel, costInputs }) {
  const amounts = type === "weapon"
    ? WEAPON_HONING_AMOUNTS_BY_TARGET_LEVEL[targetLevel]
    : ARMOR_HONING_AMOUNTS_BY_TARGET_LEVEL[targetLevel];
  const baseProb = HONING_PROBABILITY_BY_TARGET_LEVEL[targetLevel];
  const breath = HONING_BREATH_BY_TARGET_LEVEL[targetLevel];
  const prices = honingUnitPrices(costInputs, type);

  if (!amounts || !baseProb || !breath || !hasAllPrices(prices)) {
    return null;
  }

  const baseCost = baseHoningTryCost(amounts, prices);

  function costForBreathCount(breathCount) {
    const memo = new Map();

    function recur(currentProb, jangin) {
      if (jangin >= 1) {
        return baseCost;
      }

      const key = `${round4Probability(currentProb)}|${round4Probability(jangin)}`;

      if (memo.has(key)) {
        return memo.get(key);
      }

      const totalProb = round4Probability(Math.min(currentProb + breathCount * breath.probability, 1));
      const nextProb = Math.min(currentProb + baseProb * 0.1, baseProb * 2);
      const nextJangin = jangin + totalProb / JANGIN_ACCUMULATE_DIVIDER;
      const result = baseCost + breathCount * prices.breath + (1 - totalProb) * recur(nextProb, nextJangin);

      memo.set(key, result);
      return result;
    }

    return recur(baseProb, 0);
  }

  const noBreathCost = costForBreathCount(0);
  const fullBreathCost = costForBreathCount(breath.max);
  const useFullBreath = fullBreathCost < noBreathCost;
  const expectedCost = useFullBreath ? fullBreathCost : noBreathCost;

  return {
    ExpectedCostGold: round(expectedCost, 0),
    NoBreathExpectedCostGold: round(noBreathCost, 0),
    FullBreathExpectedCostGold: round(fullBreathCost, 0),
    BreathCount: useFullBreath ? breath.max : 0,
    BreathName: type === "weapon" ? "용암의 숨결" : "빙하의 숨결",
    BaseSuccessRate: baseProb * 100
  };
}

function parseHoningLevel(item) {
  const name = valueOf(item, ["Name", "name"], "");
  const match = String(name).match(/\+(?<level>\d+)/);
  const level = toNumber(match?.groups?.level, null);

  return Number.isInteger(level) ? level : null;
}

function inferWeaponHoningLevel(item) {
  const parsed = parseHoningLevel(item);

  if (parsed !== null) {
    return parsed;
  }

  const weaponStats = valueOf(item, ["WeaponStats", "weaponStats"], null);
  const weaponPowerSource = valueOf(weaponStats, ["WeaponPower", "weaponPower"], null);
  const weaponPower = toNumber(valueOf(weaponPowerSource, ["Value", "value"], null), null);
  const matchedLevel = Object.entries(WEAPON_POWER_BY_LEVEL)
    .find(([, value]) => value === weaponPower)?.[0];

  return matchedLevel ? Number(matchedLevel) : null;
}

function inferArmorHoningLevel(item) {
  const parsed = parseHoningLevel(item);

  if (parsed !== null) {
    return parsed;
  }

  const type = valueOf(item, ["Type", "type"], "");
  const stats = ARMOR_MAIN_STAT_BY_SLOT[type];
  const mainStatValue = toNumber(valueOf(item, ["MainStatValue", "mainStatValue"], null), null);

  if (!stats || mainStatValue === null) {
    return null;
  }

  const index = stats.findIndex((value) => value === mainStatValue);

  return index >= 0 ? 11 + index : null;
}

function equipmentMainStatTotal(equipment) {
  return listOf({ equipment }, ["equipment"])
    .map((item) => toNumber(valueOf(item, ["MainStatValue", "mainStatValue"], 0), 0))
    .reduce((sum, value) => sum + value, 0);
}

function buildWeaponHoningCandidates(equipment, costInputs) {
  const weapon = listOf({ equipment }, ["equipment"]).find((item) => valueOf(item, ["Type", "type"], "") === "무기");
  const currentLevel = inferWeaponHoningLevel(weapon);
  const targetLevel = currentLevel === null ? null : currentLevel + 1;
  const currentWeaponPower = currentLevel === null ? null : WEAPON_POWER_BY_LEVEL[currentLevel];
  const nextWeaponPower = targetLevel === null ? null : WEAPON_POWER_BY_LEVEL[targetLevel];
  const cost = targetLevel === null ? null : expectedHoningCost({ type: "weapon", targetLevel, costInputs });

  if (!weapon || currentLevel < 11 || currentLevel >= 25 || !currentWeaponPower || !nextWeaponPower || !cost) {
    return [];
  }

  const gainPercent = (Math.sqrt(nextWeaponPower / currentWeaponPower) - 1) * 100;

  return [{
    Id: `weapon-honing-${currentLevel}-${targetLevel}`,
    Type: "weaponHoning",
    Label: `무기 ${currentLevel}->${targetLevel}`,
    CostGold: cost.ExpectedCostGold,
    NetCostGold: cost.ExpectedCostGold,
    GainPercent: round(gainPercent, 4),
    GainType: "combatPower",
    EfficiencyScore: efficiencyPer100kGold(gainPercent, cost.ExpectedCostGold),
    ScoreUnit: "전투력 % / 10만 골드",
    Target: "무기",
    CurrentLevel: currentLevel,
    TargetLevel: targetLevel,
    CostDetail: cost,
    Caveat: `${cost.BreathCount ? cost.BreathName : "노숨"} 기대비용 기준`
  }];
}

function buildArmorHoningCandidates(equipment, costInputs) {
  const mainStatTotal = equipmentMainStatTotal(equipment);

  if (!Number.isFinite(mainStatTotal) || mainStatTotal <= 0) {
    return [];
  }

  return listOf({ equipment }, ["equipment"])
    .filter((item) => Boolean(ARMOR_MAIN_STAT_BY_SLOT[valueOf(item, ["Type", "type"], "")]))
    .map((item) => {
      const slot = valueOf(item, ["Type", "type"], "");
      const currentLevel = inferArmorHoningLevel(item);
      const targetLevel = currentLevel === null ? null : currentLevel + 1;
      const slotStats = ARMOR_MAIN_STAT_BY_SLOT[slot];
      const currentIndex = currentLevel === null ? -1 : currentLevel - 11;
      const currentStat = slotStats?.[currentIndex];
      const nextStat = slotStats?.[currentIndex + 1];
      const gainStat = Number.isFinite(currentStat) && Number.isFinite(nextStat)
        ? nextStat - currentStat
        : null;
      const cost = targetLevel === null ? null : expectedHoningCost({ type: "armor", targetLevel, costInputs });

      if (currentLevel < 11 || currentLevel >= 25 || !Number.isFinite(gainStat) || gainStat <= 0 || !cost) {
        return null;
      }

      const gainPercent = (Math.sqrt((mainStatTotal + gainStat) / mainStatTotal) - 1) * 100;

      return {
        Id: `armor-honing-${slot}-${currentLevel}-${targetLevel}`,
        Type: "armorHoning",
        Label: `${slot} ${currentLevel}->${targetLevel}`,
        CostGold: cost.ExpectedCostGold,
        NetCostGold: cost.ExpectedCostGold,
        GainPercent: round(gainPercent, 4),
        GainType: "combatPower",
        EfficiencyScore: efficiencyPer100kGold(gainPercent, cost.ExpectedCostGold),
        ScoreUnit: "전투력 % / 10만 골드",
        Target: slot,
        CurrentLevel: currentLevel,
        TargetLevel: targetLevel,
        MainStatGain: gainStat,
        CostDetail: cost,
        Caveat: `${cost.BreathCount ? cost.BreathName : "노숨"} 기대비용 기준`
      };
    })
    .filter(Boolean);
}

function buildHoningCandidates(equipment, costInputs) {
  return [
    ...buildWeaponHoningCandidates(equipment, costInputs),
    ...buildArmorHoningCandidates(equipment, costInputs)
  ];
}

function engravingLevel(engraving) {
  return Math.min(4, Math.max(0, Math.trunc(toNumber(valueOf(engraving, ["Level", "level"], 0), 0))));
}

function engravingName(engraving) {
  return String(valueOf(engraving, ["Name", "name"], "")).replace(/\s+/g, " ").trim();
}

function findEngravingBookPrice(engravingBookPrices, name) {
  return listOf({ engravingBookPrices }, ["engravingBookPrices"])
    .find((item) => valueOf(item, ["EngravingName", "engravingName"], "") === name) || null;
}

function combatPowerEstimateForEngravings({ profile, equipment, combatContext, engravings }) {
  const analysis = buildCombatPowerAnalysis({
    profile,
    equipment,
    arkPassive: valueOf(combatContext, ["arkPassive"], {}),
    arkGrid: valueOf(combatContext, ["arkGrid"], {}),
    cards: valueOf(combatContext, ["cards"], {}),
    engravings,
    gems: valueOf(combatContext, ["gems"], []),
    paradiseOrb: valueOf(combatContext, ["paradiseOrb"], null)
  });

  return toNumber(valueOf(analysis?.Formula, ["Estimate"], null), null);
}

function combatPowerEstimateForGems({ profile, equipment, combatContext, gems }) {
  const analysis = buildCombatPowerAnalysis({
    profile,
    equipment,
    arkPassive: valueOf(combatContext, ["arkPassive"], {}),
    arkGrid: valueOf(combatContext, ["arkGrid"], {}),
    cards: valueOf(combatContext, ["cards"], {}),
    engravings: valueOf(combatContext, ["engravings"], []),
    gems,
    paradiseOrb: valueOf(combatContext, ["paradiseOrb"], null)
  });

  return toNumber(valueOf(analysis?.Formula, ["Estimate"], null), null);
}

function buildEngravingBookCandidates({ profile, equipment, engravings, combatContext, engravingBookPrices }) {
  const currentEngravings = listOf({ engravings }, ["engravings"]);
  const currentEstimate = combatPowerEstimateForEngravings({
    profile,
    equipment,
    combatContext,
    engravings: currentEngravings
  });

  if (!Number.isFinite(currentEstimate) || currentEstimate <= 0) {
    return [];
  }

  return currentEngravings
    .map((engraving, index) => {
      const name = engravingName(engraving);
      const currentLevel = engravingLevel(engraving);
      const targetLevel = currentLevel + 1;
      const price = findEngravingBookPrice(engravingBookPrices, name);
      const costGold = toNumber(valueOf(price, ["CostForFiveBooks", "costForFiveBooks"], null), null);

      if (!name || currentLevel >= 4 || !Number.isFinite(costGold) || costGold <= 0) {
        return null;
      }

      const nextEngravings = currentEngravings.map((item, itemIndex) => (
        itemIndex === index
          ? { ...item, Grade: "유물", Level: targetLevel }
          : item
      ));
      const nextEstimate = combatPowerEstimateForEngravings({
        profile,
        equipment,
        combatContext,
        engravings: nextEngravings
      });

      if (!Number.isFinite(nextEstimate) || nextEstimate <= currentEstimate) {
        return null;
      }

      const gainPercent = ((nextEstimate / currentEstimate) - 1) * 100;

      return {
        Id: `engraving-book-${index}-${name}-${currentLevel}-${targetLevel}`,
        Type: "engravingBook",
        Label: `${name} 각인 ${currentLevel}->${targetLevel}`,
        CostGold: round(costGold, 0),
        NetCostGold: round(costGold, 0),
        GainPercent: round(gainPercent, 4),
        GainType: "combatPower",
        EfficiencyScore: efficiencyPer100kGold(gainPercent, costGold),
        ScoreUnit: "전투력 % / 10만 골드",
        Target: name,
        CurrentLevel: currentLevel,
        TargetLevel: targetLevel,
        BookCount: 5,
        UnitPrice: toNumber(valueOf(price, ["UnitPrice", "unitPrice"], null), null),
        CostDetail: price,
        Caveat: "유물 각인서 5권 기준"
      };
    })
    .filter(Boolean);
}

function buildEngravingBookMissingInputs(engravings, engravingBookPrices) {
  const currentEngravings = listOf({ engravings }, ["engravings"]);
  const missing = currentEngravings
    .map(engravingName)
    .filter(Boolean)
    .filter((name) => {
      const level = engravingLevel(currentEngravings.find((item) => engravingName(item) === name));
      const price = findEngravingBookPrice(engravingBookPrices, name);

      if (level >= 4) {
        return false;
      }

      return !Boolean(valueOf(price, ["IsAvailable", "isAvailable"], false));
    });
  const uniqueMissing = [...new Set(missing)];

  return uniqueMissing.length ? [`각인서 시세 누락: ${uniqueMissing.join(", ")}`] : [];
}

function buildAccessoryCostInputs(snapshot, equipment, profile, criticalStats) {
  const group = findGroup(snapshot, "accessories");
  const items = listOf(group, ["items", "Items"]);
  const floorPrices = ["목걸이", "귀걸이", "반지", "팔찌"].map((slot) => {
    const cheapest = minByPrice(items.filter((item) => valueOf(item, ["categoryName", "CategoryName"], "") === slot));

    return {
      Slot: slot,
      FloorPrice: toNumber(valueOf(cheapest, ["currentMinPrice", "CurrentMinPrice"], null), null),
      SampleName: valueOf(cheapest, ["name", "Name"], "")
    };
  });
  const contributionIndex = buildAccessoryContributionIndex(equipment, profile, criticalStats);

  return {
    FloorPrices: floorPrices,
    CurrentTotalContributionPercent: round(toNumber(valueOf(contributionIndex, ["TotalContributionPercent"], 0), 0)),
    CurrentTotalContributionText: valueOf(contributionIndex, ["TotalContributionText"], "0.00%")
  };
}

function buildGemCostIndex(snapshot) {
  const group = findGroup(snapshot, "gems");
  const levels = {};

  listOf(group, ["items", "Items"]).forEach((item) => {
    const level = toNumber(valueOf(item, ["gemLevel", "GemLevel"], null), null);
    const effectType = valueOf(item, ["gemEffectType", "GemEffectType"], "");
    const price = toNumber(valueOf(item, ["currentMinPrice", "CurrentMinPrice"], null), null);
    const effectValue = toNumber(valueOf(item, ["gemEffectValue", "GemEffectValue"], null), null);

    if (!level || !effectType || price === null) {
      return;
    }

    levels[level] ||= {};
    const previous = levels[level][effectType];

    if (!previous || price < previous.MinBuyPrice) {
      levels[level][effectType] = {
        Level: level,
        EffectType: effectType,
        MinBuyPrice: price,
        EffectValue: effectValue,
        SampleName: valueOf(item, ["name", "Name"], "")
      };
    }
  });

  return levels;
}

function buildGemCostInputs(snapshot) {
  const index = buildGemCostIndex(snapshot);

  return Object.values(index)
    .flatMap((byType) => Object.values(byType))
    .sort((left, right) => left.Level - right.Level || left.EffectType.localeCompare(right.EffectType));
}

function avatarSlotCurrentValue(avatars, target) {
  return listOf({ avatars }, ["avatars"])
    .filter((avatar) => target.typePattern.test(valueOf(avatar, ["Type", "type"], "")))
    .filter((avatar) => Boolean(valueOf(avatar, ["IsStatApplied", "isStatApplied", "IsInner", "isInner"], false)))
    .flatMap((avatar) => listOf(avatar, ["StatEffects", "statEffects"]).map((effect) => toNumber(valueOf(effect, ["Value", "value"], 0), 0)))
    .reduce((max, value) => Math.max(max, value), 0);
}

function buildAvatarCostInputs(snapshot, legendaryAvatarPrices = null) {
  const group = findGroup(snapshot, "legendary-avatars");
  const items = listOf(group, ["items", "Items"]);
  const classSpecificPrices = Array.isArray(legendaryAvatarPrices) ? legendaryAvatarPrices : null;

  return AVATAR_SLOT_TARGETS.map((target) => {
    const classSpecific = classSpecificPrices?.find((item) => (
      valueOf(item, ["Slot", "slot"], "") === target.slot &&
      valueOf(item, ["IsAvailable", "isAvailable"], false)
    ));

    if (classSpecificPrices) {
      return {
        Slot: target.slot,
        TargetMainStatPercent: 2,
        MinPrice: toNumber(valueOf(classSpecific, ["UnitPrice", "unitPrice", "CurrentMinPrice", "currentMinPrice"], null), null),
        SampleName: valueOf(classSpecific, ["Name", "name"], ""),
        ClassName: valueOf(classSpecific, ["ClassName", "className"], ""),
        Source: "classSpecific"
      };
    }

    const cheapest = minByPrice(items.filter((item) => valueOf(item, ["categoryName", "CategoryName"], "") === target.slot));

    return {
      Slot: target.slot,
      TargetMainStatPercent: 2,
      MinPrice: toNumber(valueOf(cheapest, ["currentMinPrice", "CurrentMinPrice"], null), null),
      SampleName: valueOf(cheapest, ["name", "Name"], ""),
      ClassName: "",
      Source: "snapshot"
    };
  });
}

function efficiencyPer100kGold(gainPercent, costGold) {
  if (!Number.isFinite(gainPercent) || !Number.isFinite(costGold) || costGold <= 0) {
    return 0;
  }

  return round(gainPercent / costGold * 100000, 4);
}

function gemBasicAttackEffectForLevel(level) {
  const value = GEM_BASIC_ATTACK_PERCENT_BY_LEVEL[level];

  if (!Number.isFinite(value)) {
    return null;
  }

  return {
    Name: "기본 공격력",
    Value: value,
    Unit: "%",
    Direction: "증가"
  };
}

function gemWithTargetLevel(gem, targetLevel, nextPrice) {
  const basicAttackEffect = gemBasicAttackEffectForLevel(targetLevel);
  const additionalEffects = listOf(gem, ["AdditionalEffects", "additionalEffects"])
    .filter((effect) => valueOf(effect, ["Name", "name"], "") !== "기본 공격력");

  if (basicAttackEffect) {
    additionalEffects.push(basicAttackEffect);
  }

  return {
    ...gem,
    Level: targetLevel,
    EffectValue: toNumber(valueOf(nextPrice, ["EffectValue"], null), valueOf(gem, ["EffectValue", "effectValue"], null)),
    AdditionalEffects: additionalEffects
  };
}

function buildGemCandidates({ profile, equipment, combatContext, gems, gemCostIndex }) {
  const currentGems = listOf({ gems }, ["gems"]);
  const currentEstimate = combatPowerEstimateForGems({
    profile,
    equipment,
    combatContext,
    gems: currentGems
  });

  if (!Number.isFinite(currentEstimate) || currentEstimate <= 0) {
    return [];
  }

  return currentGems
    .map((gem) => {
      const currentLevel = toNumber(valueOf(gem, ["Level", "level"], null), null);
      const effectType = valueOf(gem, ["EffectType", "effectType"], "");
      const targetLevel = currentLevel === null ? null : currentLevel + 1;

      if (!currentLevel || currentLevel >= 10 || !effectType || targetLevel === null) {
        return null;
      }

      const currentPrice = valueOf(gemCostIndex[currentLevel], [effectType], null);
      const nextPrice = valueOf(gemCostIndex[targetLevel], [effectType], null);
      const nextBuyPrice = toNumber(valueOf(nextPrice, ["MinBuyPrice"], null), null);
      const currentBuyPrice = toNumber(valueOf(currentPrice, ["MinBuyPrice"], null), null);

      if (nextBuyPrice === null) {
        return null;
      }

      const nextGems = currentGems.map((currentGem) => (
        currentGem === gem ? gemWithTargetLevel(gem, targetLevel, nextPrice) : currentGem
      ));
      const nextEstimate = combatPowerEstimateForGems({
        profile,
        equipment,
        combatContext,
        gems: nextGems
      });

      if (!Number.isFinite(nextEstimate) || nextEstimate <= currentEstimate) {
        return null;
      }

      const rawNetCostGold = currentBuyPrice === null ? nextBuyPrice : nextBuyPrice - currentBuyPrice;
      const netCostGold = rawNetCostGold > 0 ? rawNetCostGold : nextBuyPrice;
      const gainPercent = ((nextEstimate / currentEstimate) - 1) * 100;
      const score = efficiencyPer100kGold(gainPercent, netCostGold);

      return {
        Id: `gem-${valueOf(gem, ["Slot", "slot"], "x")}-${currentLevel}-${targetLevel}`,
        Type: "gem",
        Label: `${valueOf(gem, ["SkillName", "skillName"], valueOf(gem, ["Name", "name"], "보석"))} ${currentLevel}->${targetLevel}`,
        CostGold: nextBuyPrice,
        NetCostGold: round(netCostGold, 0),
        GainPercent: round(gainPercent, 4),
        GainType: "combatPower",
        EfficiencyScore: score,
        ScoreUnit: "전투력 % / 10만 골드",
        Target: valueOf(gem, ["SkillName", "skillName"], valueOf(gem, ["Name", "name"], "보석")),
        CurrentLevel: currentLevel,
        TargetLevel: targetLevel,
        EffectType: effectType,
        CostDetail: {
          CurrentPrice: currentPrice,
          NextPrice: nextPrice
        },
        Caveat: "보석 최저가 순비용, 기본공%는 레벨별 추정"
      };
    })
    .filter(Boolean);
}

function buildAvatarCandidates(avatars, avatarCostInputs) {
  return AVATAR_SLOT_TARGETS.map((target) => {
    const costInput = avatarCostInputs.find((item) => item.Slot === target.slot);
    const minPrice = toNumber(valueOf(costInput, ["MinPrice"], null), null);
    const currentValue = avatarSlotCurrentValue(avatars, target);
    const targetValue = toNumber(valueOf(costInput, ["TargetMainStatPercent"], 2), 2);
    const className = valueOf(costInput, ["ClassName", "className"], "");
    const gainPercent = round(targetValue - currentValue);

    if (minPrice === null || gainPercent <= 0) {
      return null;
    }

    return {
      Id: `legendary-avatar-${target.slot}`,
      Type: "legendaryAvatar",
      Label: className ? `${className} 전설 아바타 ${target.slot}` : `전설 아바타 ${target.slot}`,
      CostGold: minPrice,
      NetCostGold: minPrice,
      GainPercent: gainPercent,
      GainType: "mainStatPercent",
      EfficiencyScore: efficiencyPer100kGold(gainPercent, minPrice),
      ScoreUnit: "주스탯 % / 10만 골드",
      Target: target.slot,
      CostDetail: costInput,
      Caveat: "아바타 주스탯 기준. 실제 최종 피해 환산은 주스탯-공격력 모델 필요"
    };
  }).filter(Boolean);
}

export function buildUpgradeEfficiency({
  equipment = [],
  profile = {},
  avatars = [],
  gems = [],
  criticalStats = null,
  marketSnapshot = null,
  engravings = [],
  combatContext = {},
  engravingBookPrices = [],
  legendaryAvatarPrices = null
} = {}) {
  if (!marketSnapshot) {
    return {
      MarketDataStatus: "unavailable",
      UpdatedAt: "",
      CostInputs: null,
      Candidates: [],
      MissingInputs: ["거래소/경매장 가격 스냅샷"]
    };
  }

  const gemCostIndex = buildGemCostIndex(marketSnapshot);
  const honingCostInputs = buildHoningCostInputs(marketSnapshot);
  const avatarCostInputs = buildAvatarCostInputs(marketSnapshot, legendaryAvatarPrices);
  const costInputs = {
    Honing: honingCostInputs,
    Accessories: buildAccessoryCostInputs(marketSnapshot, equipment, profile, criticalStats),
    EngravingBooks: engravingBookPrices,
    LegendaryAvatars: avatarCostInputs,
    Gems: buildGemCostInputs(marketSnapshot)
  };
  const candidates = [
    ...buildHoningCandidates(equipment, honingCostInputs),
    ...buildEngravingBookCandidates({ profile, equipment, engravings, combatContext, engravingBookPrices }),
    ...buildGemCandidates({ profile, equipment, combatContext, gems, gemCostIndex }),
    ...buildAvatarCandidates(avatars, avatarCostInputs)
  ].sort((left, right) => right.EfficiencyScore - left.EfficiencyScore);

  return {
    MarketDataStatus: "ready",
    UpdatedAt: valueOf(marketSnapshot, ["updatedAt", "UpdatedAt"], ""),
    CostInputs: costInputs,
    Candidates: candidates,
    MissingInputs: [
      ...buildHoningMissingInputs(honingCostInputs),
      ...buildEngravingBookMissingInputs(engravings, engravingBookPrices),
      "악세 효율: 목표 옵션 필터와 후보 악세 옵션별 기여도",
      "보석 최종 피해 효율: 스킬별 실제 딜 지분"
    ]
  };
}
