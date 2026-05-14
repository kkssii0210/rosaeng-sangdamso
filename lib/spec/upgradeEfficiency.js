import { buildAccessoryContributionIndex } from "./accessoryContributions.js";

const AVATAR_SLOT_TARGETS = [
  { slot: "무기", typePattern: /무기/ },
  { slot: "머리", typePattern: /머리/ },
  { slot: "상의", typePattern: /상의/ },
  { slot: "하의", typePattern: /하의/ }
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

function buildHoningCostInputs(snapshot) {
  return {
    Materials: listOf(findGroup(snapshot, "honing-materials"), ["items", "Items"]).map(normalizeMarketCostItem),
    Supports: listOf(findGroup(snapshot, "honing-supports"), ["items", "Items"]).map(normalizeMarketCostItem)
  };
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

function buildAvatarCostInputs(snapshot) {
  const group = findGroup(snapshot, "legendary-avatars");
  const items = listOf(group, ["items", "Items"]);

  return AVATAR_SLOT_TARGETS.map((target) => {
    const cheapest = minByPrice(items.filter((item) => valueOf(item, ["categoryName", "CategoryName"], "") === target.slot));

    return {
      Slot: target.slot,
      TargetMainStatPercent: 2,
      MinPrice: toNumber(valueOf(cheapest, ["currentMinPrice", "CurrentMinPrice"], null), null),
      SampleName: valueOf(cheapest, ["name", "Name"], "")
    };
  });
}

function efficiencyPer100kGold(gainPercent, costGold) {
  if (!Number.isFinite(gainPercent) || !Number.isFinite(costGold) || costGold <= 0) {
    return 0;
  }

  return round(gainPercent / costGold * 100000, 4);
}

function buildGemCandidates(gems, gemCostIndex) {
  return listOf({ gems }, ["gems"])
    .map((gem) => {
      const currentLevel = toNumber(valueOf(gem, ["Level", "level"], null), null);
      const effectType = valueOf(gem, ["EffectType", "effectType"], "");
      const currentEffectValue = toNumber(valueOf(gem, ["EffectValue", "effectValue"], null), null);

      if (!currentLevel || currentLevel >= 10 || !effectType || currentEffectValue === null) {
        return null;
      }

      const currentPrice = valueOf(gemCostIndex[currentLevel], [effectType], null);
      const nextPrice = valueOf(gemCostIndex[currentLevel + 1], [effectType], null);
      const nextBuyPrice = toNumber(valueOf(nextPrice, ["MinBuyPrice"], null), null);
      const currentBuyPrice = toNumber(valueOf(currentPrice, ["MinBuyPrice"], null), null);
      const nextEffectValue = toNumber(valueOf(nextPrice, ["EffectValue"], null), null);

      if (nextBuyPrice === null || nextEffectValue === null || nextEffectValue <= currentEffectValue) {
        return null;
      }

      const netCostGold = currentBuyPrice === null ? nextBuyPrice : Math.max(0, nextBuyPrice - currentBuyPrice);
      const gainPercent = round(nextEffectValue - currentEffectValue);
      const score = efficiencyPer100kGold(gainPercent, netCostGold || nextBuyPrice);

      return {
        Id: `gem-${valueOf(gem, ["Slot", "slot"], "x")}-${currentLevel}-${currentLevel + 1}`,
        Type: "gem",
        Label: `${valueOf(gem, ["SkillName", "skillName"], valueOf(gem, ["Name", "name"], "보석"))} ${currentLevel}->${currentLevel + 1}`,
        CostGold: nextBuyPrice,
        NetCostGold: netCostGold,
        GainPercent: gainPercent,
        GainType: effectType === "cooldown" ? "cooldownGemEffect" : "damageGemEffect",
        EfficiencyScore: score,
        ScoreUnit: `${effectType === "cooldown" ? "쿨감" : "피해"} % / 10만 골드`,
        Caveat: "스킬별 딜 지분은 아직 반영하지 않은 보석 효과 기준"
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
    const gainPercent = round(targetValue - currentValue);

    if (minPrice === null || gainPercent <= 0) {
      return null;
    }

    return {
      Id: `legendary-avatar-${target.slot}`,
      Type: "legendaryAvatar",
      Label: `전설 아바타 ${target.slot}`,
      CostGold: minPrice,
      NetCostGold: minPrice,
      GainPercent: gainPercent,
      GainType: "mainStatPercent",
      EfficiencyScore: efficiencyPer100kGold(gainPercent, minPrice),
      ScoreUnit: "주스탯 % / 10만 골드",
      Caveat: "아바타 주스탯 기준. 실제 최종 피해 환산은 주스탯-공격력 모델 필요"
    };
  }).filter(Boolean);
}

export function buildUpgradeEfficiency({ equipment = [], profile = {}, avatars = [], gems = [], criticalStats = null, marketSnapshot = null } = {}) {
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
  const avatarCostInputs = buildAvatarCostInputs(marketSnapshot);
  const costInputs = {
    Honing: buildHoningCostInputs(marketSnapshot),
    Accessories: buildAccessoryCostInputs(marketSnapshot, equipment, profile, criticalStats),
    LegendaryAvatars: avatarCostInputs,
    Gems: buildGemCostInputs(marketSnapshot)
  };
  const candidates = [
    ...buildGemCandidates(gems, gemCostIndex),
    ...buildAvatarCandidates(avatars, avatarCostInputs)
  ].sort((left, right) => right.EfficiencyScore - left.EfficiencyScore);

  return {
    MarketDataStatus: "ready",
    UpdatedAt: valueOf(marketSnapshot, ["updatedAt", "UpdatedAt"], ""),
    CostInputs: costInputs,
    Candidates: candidates,
    MissingInputs: [
      "강화 효율: 목표 강화 단계별 재료 수량, 성공률, 장기백 기대값",
      "악세 효율: 목표 옵션 필터와 후보 악세 옵션별 기여도",
      "보석 최종 피해 효율: 스킬별 실제 딜 지분"
    ]
  };
}
