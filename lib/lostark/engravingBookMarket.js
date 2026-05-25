export const ENGRAVING_BOOK_CATEGORY_CODE = 40000;
export const ENGRAVING_BOOK_PRICE_CACHE_TTL_MS = 5 * 60 * 1000;

export const sharedEngravingBookPriceCache = globalThis.__sgguEngravingBookPriceCache || new Map();

globalThis.__sgguEngravingBookPriceCache = sharedEngravingBookPriceCache;

function toFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeName(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function requestBodyForEngraving(engravingName) {
  return {
    CategoryCode: ENGRAVING_BOOK_CATEGORY_CODE,
    ItemGrade: "유물",
    ItemName: engravingName,
    PageNo: 1,
    Sort: "CURRENT_MIN_PRICE",
    SortCondition: "ASC"
  };
}

function isRelicBookForEngraving(item, engravingName) {
  const itemName = normalizeName(item?.Name);
  const targetName = normalizeName(`유물 ${engravingName} 각인서`);

  return item?.Grade === "유물" && itemName === targetName;
}

function normalizeBookPrice(item, engravingName) {
  const currentMinPrice = toFiniteNumber(item?.CurrentMinPrice);
  const bundleCount = toFiniteNumber(item?.BundleCount) || 1;
  const unitPrice = currentMinPrice === null ? null : currentMinPrice / bundleCount;

  return {
    EngravingName: engravingName,
    Name: item?.Name || `유물 ${engravingName} 각인서`,
    Grade: item?.Grade || "유물",
    Icon: item?.Icon || "",
    CurrentMinPrice: currentMinPrice,
    BundleCount: bundleCount,
    UnitPrice: unitPrice,
    CostForFiveBooks: unitPrice === null ? null : unitPrice * 5,
    RecentPrice: toFiniteNumber(item?.RecentPrice),
    YesterdayAveragePrice: toFiniteNumber(item?.YDayAvgPrice),
    IsAvailable: unitPrice !== null
  };
}

function unavailableBookPrice(engravingName) {
  return {
    EngravingName: engravingName,
    Name: `유물 ${engravingName} 각인서`,
    Grade: "유물",
    Icon: "",
    CurrentMinPrice: null,
    BundleCount: null,
    UnitPrice: null,
    CostForFiveBooks: null,
    RecentPrice: null,
    YesterdayAveragePrice: null,
    IsAvailable: false
  };
}

export function createEngravingBookMarketSearch({
  postMarket,
  now = Date.now,
  rawPriceCache = sharedEngravingBookPriceCache
} = {}) {
  if (typeof postMarket !== "function") {
    throw new TypeError("postMarket must be a function");
  }

  async function getRelicBookPrice(engravingName, { forceRefresh = false } = {}) {
    const normalizedName = normalizeName(engravingName);
    const cacheKey = `relic:${normalizedName}`;
    const cached = rawPriceCache.get(cacheKey);
    const currentTime = now();

    if (!forceRefresh && cached && currentTime - cached.updatedAt < ENGRAVING_BOOK_PRICE_CACHE_TTL_MS) {
      return {
        ...cached.price,
        Cached: true,
        UpdatedAt: new Date(cached.updatedAt).toISOString()
      };
    }

    const response = await postMarket(requestBodyForEngraving(normalizedName));
    const items = Array.isArray(response?.Items) ? response.Items : [];
    const selected = items.find((item) => isRelicBookForEngraving(item, normalizedName));
    const price = selected ? normalizeBookPrice(selected, normalizedName) : unavailableBookPrice(normalizedName);

    rawPriceCache.set(cacheKey, { price, updatedAt: currentTime });

    return {
      ...price,
      Cached: false,
      UpdatedAt: new Date(currentTime).toISOString()
    };
  }

  async function getRelicBookPrices(engravingNames, options = {}) {
    const uniqueNames = [...new Set((Array.isArray(engravingNames) ? engravingNames : [])
      .map(normalizeName)
      .filter(Boolean))];

    return Promise.all(uniqueNames.map((engravingName) => getRelicBookPrice(engravingName, options)));
  }

  return {
    getRelicBookPrice,
    getRelicBookPrices
  };
}
