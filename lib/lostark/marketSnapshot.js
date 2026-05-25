export const MARKET_SNAPSHOT_CACHE_TTL_MS = 5 * 60 * 1000;

export const MARKET_SNAPSHOT_QUERIES = [
  {
    id: "honing-materials",
    label: "강화 재료",
    description: "T4 재련 재료 최저가",
    sourceType: "market",
    endpoint: "/markets/items",
    itemLimit: 20,
    itemsPerRequest: 10,
    requests: [
      {
        CategoryCode: 50010,
        CategoryName: "재련 재료",
        ItemTier: 4,
        ItemName: "운명의 파괴석 결정",
        PageNo: 1
      },
      {
        CategoryCode: 50010,
        CategoryName: "재련 재료",
        ItemTier: 4,
        ItemName: "운명의 수호석 결정",
        PageNo: 1
      },
      {
        CategoryCode: 50010,
        CategoryName: "재련 재료",
        ItemTier: 4,
        ItemName: "위대한 운명의 돌파석",
        PageNo: 1
      },
      {
        CategoryCode: 50010,
        CategoryName: "재련 재료",
        ItemTier: 4,
        ItemName: "상급 아비도스 융화 재료",
        PageNo: 1
      },
      {
        CategoryCode: 50010,
        CategoryName: "재련 재료",
        ItemTier: 4,
        ItemName: "운명의 파편",
        PageNo: 1
      }
    ]
  },
  {
    id: "honing-supports",
    label: "재련 보조 재료",
    description: "T4 숨결/야금술/재봉술 최저가",
    sourceType: "market",
    endpoint: "/markets/items",
    itemLimit: 10,
    itemsPerRequest: 10,
    requests: [
      {
        CategoryCode: 50020,
        CategoryName: "재련 보조 재료",
        ItemTier: 4,
        ItemName: "용암의 숨결",
        PageNo: 1
      },
      {
        CategoryCode: 50020,
        CategoryName: "재련 보조 재료",
        ItemTier: 4,
        ItemName: "빙하의 숨결",
        PageNo: 1
      }
    ]
  },
  {
    id: "legendary-avatars",
    label: "전설 아바타",
    description: "부위별 전설 아바타 최저가",
    sourceType: "market",
    endpoint: "/markets/items",
    itemLimit: 12,
    requests: [
      {
        CategoryCode: 20005,
        CategoryName: "무기",
        ItemGrade: "전설",
        PageNo: 1
      },
      {
        CategoryCode: 20010,
        CategoryName: "머리",
        ItemGrade: "전설",
        PageNo: 1
      },
      {
        CategoryCode: 20050,
        CategoryName: "상의",
        ItemGrade: "전설",
        PageNo: 1
      },
      {
        CategoryCode: 20060,
        CategoryName: "하의",
        ItemGrade: "전설",
        PageNo: 1
      }
    ]
  },
  {
    id: "accessories",
    label: "악세사리",
    description: "T4 고대 악세 매물",
    sourceType: "auction",
    endpoint: "/auctions/items",
    itemLimit: 12,
    requests: [
      {
        CategoryCode: 200010,
        CategoryName: "목걸이",
        ItemTier: 4,
        ItemGrade: "고대",
        PageNo: 1,
        Sort: "BUY_PRICE",
        SortCondition: "ASC"
      },
      {
        CategoryCode: 200020,
        CategoryName: "귀걸이",
        ItemTier: 4,
        ItemGrade: "고대",
        PageNo: 1,
        Sort: "BUY_PRICE",
        SortCondition: "ASC"
      },
      {
        CategoryCode: 200030,
        CategoryName: "반지",
        ItemTier: 4,
        ItemGrade: "고대",
        PageNo: 1,
        Sort: "BUY_PRICE",
        SortCondition: "ASC"
      },
      {
        CategoryCode: 200040,
        CategoryName: "팔찌",
        ItemTier: 4,
        ItemGrade: "고대",
        PageNo: 1,
        Sort: "BUY_PRICE",
        SortCondition: "ASC"
      }
    ]
  },
  {
    id: "gems",
    label: "보석",
    description: "T4 주요 레벨별 즉시 구매가",
    sourceType: "auction",
    endpoint: "/auctions/items",
    itemLimit: 12,
    itemsPerRequest: 3,
    preserveRequestOrder: true,
    requests: [7, 8, 9, 10].map((level) => ({
      CategoryCode: 210000,
      CategoryName: `${level}레벨`,
      ItemTier: 4,
      ItemName: `${level}레벨`,
      PageNo: 1,
      Sort: "BUY_PRICE",
      SortCondition: "ASC"
    }))
  }
];

function toFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function getAuctionBuyPrice(item) {
  const auctionInfo = item?.AuctionInfo || {};
  return toFiniteNumber(auctionInfo.BuyPrice) ?? toFiniteNumber(auctionInfo.StartPrice) ?? toFiniteNumber(auctionInfo.BidStartPrice);
}

function getPriceDelta(currentPrice, previousPrice) {
  if (!Number.isFinite(currentPrice) || !Number.isFinite(previousPrice) || previousPrice <= 0) {
    return null;
  }

  const amount = currentPrice - previousPrice;

  return {
    amount,
    percent: (amount / previousPrice) * 100
  };
}

function formatOptionValue(option) {
  const value = toFiniteNumber(option?.Value);

  if (value === null) {
    return "";
  }

  return `${value}${option?.IsValuePercentage ? "%" : ""}`;
}

function normalizeAuctionOptions(options) {
  if (!Array.isArray(options)) {
    return [];
  }

  return options
    .map((option) => normalizeAuctionOption(option).text)
    .filter(Boolean)
    .slice(0, 3);
}

function normalizeAuctionOption(option) {
  const name = option?.OptionName || "";
  const value = formatOptionValue(option);
  const className = option?.ClassName || "";
  const text = [className, name, value].filter(Boolean).join(" ");

  return {
    type: option?.Type || "",
    name,
    value: toFiniteNumber(option?.Value),
    isValuePercentage: Boolean(option?.IsValuePercentage),
    className,
    text
  };
}

function normalizeAuctionOptionDetails(options) {
  if (!Array.isArray(options)) {
    return [];
  }

  return options
    .map((option) => {
      const normalized = normalizeAuctionOption(option);
      return normalized.text ? normalized : null;
    })
    .filter(Boolean)
    .slice(0, 3);
}

function getGemEffectType(optionDetails) {
  const gemOption = optionDetails.find((option) => option.type.includes("GEM_SKILL"));

  if (!gemOption) {
    return "";
  }

  if (gemOption.type.includes("DAMAGE")) {
    return "damage";
  }

  if (gemOption.type.includes("COOLDOWN")) {
    return "cooldown";
  }

  if (gemOption.type.includes("SUPPORT")) {
    return "support";
  }

  return "other";
}

function getGemLevelFromName(name) {
  const level = Number(String(name || "").match(/(?<level>\d+)\s*레벨/)?.groups?.level);

  return Number.isFinite(level) ? level : null;
}

function normalizeMarketItem(item, context) {
  const currentMinPrice = toFiniteNumber(item?.CurrentMinPrice);
  const recentPrice = toFiniteNumber(item?.RecentPrice);
  const yesterdayAveragePrice = toFiniteNumber(item?.YDayAvgPrice);

  return {
    key: `market-${item?.Id || item?.Name || "item"}-${context.categoryCode || "category"}`,
    sourceType: "market",
    categoryName: context.categoryName || "",
    name: item?.Name || "이름 없음",
    grade: item?.Grade || "",
    icon: item?.Icon || "",
    currentMinPrice,
    recentPrice,
    yesterdayAveragePrice,
    priceDelta: getPriceDelta(currentMinPrice, yesterdayAveragePrice),
    bundleCount: toFiniteNumber(item?.BundleCount),
    tradeRemainCount: toFiniteNumber(item?.TradeRemainCount),
    options: []
  };
}

function normalizeAuctionItem(item, context) {
  const buyPrice = getAuctionBuyPrice(item);
  const auctionInfo = item?.AuctionInfo || {};
  const optionDetails = normalizeAuctionOptionDetails(item?.Options);
  const gemEffectType = getGemEffectType(optionDetails);
  const gemOption = optionDetails.find((option) => option.type.includes("GEM_SKILL"));

  return {
    key: `auction-${item?.Name || "item"}-${context.categoryCode || "category"}-${buyPrice || 0}`,
    sourceType: "auction",
    categoryName: context.categoryName || "",
    name: item?.Name || "이름 없음",
    grade: item?.Grade || "",
    icon: item?.Icon || "",
    currentMinPrice: buyPrice,
    recentPrice: null,
    yesterdayAveragePrice: null,
    priceDelta: null,
    bundleCount: 1,
    tradeRemainCount: toFiniteNumber(auctionInfo.TradeAllowCount),
    quality: toFiniteNumber(item?.GradeQuality),
    tier: toFiniteNumber(item?.Tier),
    itemLevel: toFiniteNumber(item?.Level),
    endDate: auctionInfo.EndDate || "",
    options: normalizeAuctionOptions(item?.Options),
    optionDetails,
    gemLevel: getGemLevelFromName(item?.Name),
    gemEffectType,
    gemEffectValue: gemOption?.value ?? null
  };
}

function normalizeItems(group, responses) {
  const items = responses
    .flatMap(({ request, response }) => {
      const items = Array.isArray(response?.Items) ? response.Items : [];
      const context = {
        categoryCode: request.CategoryCode,
        categoryName: request.CategoryName
      };

      return items
        .slice(0, group.itemsPerRequest || 3)
        .map((item) => (group.sourceType === "auction" ? normalizeAuctionItem(item, context) : normalizeMarketItem(item, context)));
    })
    .filter((item) => item.name);

  if (group.preserveRequestOrder) {
    return items.slice(0, group.itemLimit);
  }

  return items
    .sort((left, right) => {
      const leftPrice = left.currentMinPrice ?? Number.MAX_SAFE_INTEGER;
      const rightPrice = right.currentMinPrice ?? Number.MAX_SAFE_INTEGER;

      return leftPrice - rightPrice;
    })
    .slice(0, group.itemLimit);
}

export function normalizeMarketSnapshotGroup(group, responses) {
  const totalCount = responses.reduce((sum, { response }) => sum + (toFiniteNumber(response?.TotalCount) || 0), 0);
  const items = normalizeItems(group, responses);

  return {
    id: group.id,
    label: group.label,
    description: group.description,
    sourceType: group.sourceType,
    totalCount,
    itemCount: items.length,
    items
  };
}

export function buildMarketSnapshot(groups, now = new Date()) {
  const normalizedGroups = groups.map(({ group, responses }) => normalizeMarketSnapshotGroup(group, responses));

  return {
    updatedAt: now.toISOString(),
    cacheTtlMs: MARKET_SNAPSHOT_CACHE_TTL_MS,
    groups: normalizedGroups
  };
}
