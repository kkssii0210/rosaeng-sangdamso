export const LEGENDARY_AVATAR_PRICE_CACHE_TTL_MS = 5 * 60 * 1000;

export const AVATAR_MARKET_CATEGORIES = [
  { Slot: "무기", CategoryCode: 20005 },
  { Slot: "머리", CategoryCode: 20010 },
  { Slot: "상의", CategoryCode: 20050 },
  { Slot: "하의", CategoryCode: 20060 }
];

export const sharedLegendaryAvatarPriceCache = globalThis.__sgguLegendaryAvatarPriceCache || new Map();

globalThis.__sgguLegendaryAvatarPriceCache = sharedLegendaryAvatarPriceCache;

function toFiniteNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function normalizeName(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function requestBodyForAvatar(category, className) {
  return {
    CategoryCode: category.CategoryCode,
    ItemGrade: "전설",
    ItemName: className,
    PageNo: 1,
    Sort: "CURRENT_MIN_PRICE",
    SortCondition: "ASC"
  };
}

function unitPriceOf(item) {
  const currentMinPrice = toFiniteNumber(item?.CurrentMinPrice);
  const bundleCount = toFiniteNumber(item?.BundleCount) || 1;

  return currentMinPrice === null ? null : currentMinPrice / bundleCount;
}

function cheapestMarketItem(items) {
  return items
    .filter((item) => item?.Grade === "전설" && unitPriceOf(item) !== null)
    .sort((left, right) => unitPriceOf(left) - unitPriceOf(right))[0] || null;
}

function normalizeAvatarPrice(item, category, className) {
  const currentMinPrice = toFiniteNumber(item?.CurrentMinPrice);
  const bundleCount = toFiniteNumber(item?.BundleCount) || 1;
  const unitPrice = currentMinPrice === null ? null : currentMinPrice / bundleCount;

  return {
    Slot: category.Slot,
    ClassName: className,
    CategoryCode: category.CategoryCode,
    Name: item?.Name || `전설 ${className} ${category.Slot} 아바타`,
    Grade: item?.Grade || "전설",
    Icon: item?.Icon || "",
    CurrentMinPrice: currentMinPrice,
    BundleCount: bundleCount,
    UnitPrice: unitPrice,
    RecentPrice: toFiniteNumber(item?.RecentPrice),
    YesterdayAveragePrice: toFiniteNumber(item?.YDayAvgPrice),
    IsAvailable: unitPrice !== null
  };
}

function unavailableAvatarPrice(category, className) {
  return {
    Slot: category.Slot,
    ClassName: className,
    CategoryCode: category.CategoryCode,
    Name: `전설 ${className} ${category.Slot} 아바타`,
    Grade: "전설",
    Icon: "",
    CurrentMinPrice: null,
    BundleCount: null,
    UnitPrice: null,
    RecentPrice: null,
    YesterdayAveragePrice: null,
    IsAvailable: false
  };
}

export function createLegendaryAvatarMarketSearch({
  postMarket,
  now = Date.now,
  rawPriceCache = sharedLegendaryAvatarPriceCache
} = {}) {
  if (typeof postMarket !== "function") {
    throw new TypeError("postMarket must be a function");
  }

  async function getLegendaryAvatarPrice(category, className, { forceRefresh = false } = {}) {
    const normalizedClassName = normalizeName(className);
    const cacheKey = `legendary-avatar:${normalizedClassName}:${category.Slot}`;
    const cached = rawPriceCache.get(cacheKey);
    const currentTime = now();

    if (!normalizedClassName) {
      return {
        ...unavailableAvatarPrice(category, normalizedClassName),
        Cached: false,
        UpdatedAt: new Date(currentTime).toISOString()
      };
    }

    if (!forceRefresh && cached && currentTime - cached.updatedAt < LEGENDARY_AVATAR_PRICE_CACHE_TTL_MS) {
      return {
        ...cached.price,
        Cached: true,
        UpdatedAt: new Date(cached.updatedAt).toISOString()
      };
    }

    const response = await postMarket(requestBodyForAvatar(category, normalizedClassName));
    const items = Array.isArray(response?.Items) ? response.Items : [];
    const selected = cheapestMarketItem(items);
    const price = selected
      ? normalizeAvatarPrice(selected, category, normalizedClassName)
      : unavailableAvatarPrice(category, normalizedClassName);

    rawPriceCache.set(cacheKey, { price, updatedAt: currentTime });

    return {
      ...price,
      Cached: false,
      UpdatedAt: new Date(currentTime).toISOString()
    };
  }

  async function getLegendaryAvatarPrices({ className, forceRefresh = false } = {}) {
    return Promise.all(
      AVATAR_MARKET_CATEGORIES.map((category) => (
        getLegendaryAvatarPrice(category, className, { forceRefresh })
      ))
    );
  }

  return {
    getLegendaryAvatarPrice,
    getLegendaryAvatarPrices
  };
}
