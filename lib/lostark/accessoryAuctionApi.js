import {
  ACCESSORY_AUCTION_CATEGORIES,
  buildAccessoryRefinementSearchOptions,
  isEligibleAccessoryCandidate,
  normalizeAuctionAccessoryItem
} from "./accessoryAuction.js";

export const ACCESSORY_SEARCH_LIMITS = {
  minPagesPerType: 3,
  maxPagesPerType: 10,
  maxCandidatesPerType: 100,
  rawPageTtlMs: 2 * 60 * 1000
};

export const sharedAccessoryRawPageCache = new Map();

function requestSearchOptions(searchOptions) {
  return searchOptions.map(({ FirstOption, SecondOption, MinValue, MaxValue }) => ({
    FirstOption,
    SecondOption,
    MinValue,
    MaxValue
  }));
}

function searchOptionsCacheKey(searchOptions) {
  return JSON.stringify(requestSearchOptions(searchOptions));
}

export function createAccessoryAuctionSearch({ postAuction, now = Date.now, rawPageCache = new Map() } = {}) {
  if (typeof postAuction !== "function") {
    throw new TypeError("postAuction must be a function");
  }

  async function getPage({ type, categoryCode, searchOptions, pageNo, forceRefresh }) {
    const cacheKey = `${type}:${searchOptionsCacheKey(searchOptions)}:${pageNo}`;
    const cachedPage = rawPageCache.get(cacheKey);
    const currentTime = now();

    if (
      !forceRefresh &&
      cachedPage &&
      currentTime - cachedPage.updatedAt < ACCESSORY_SEARCH_LIMITS.rawPageTtlMs
    ) {
      return { raw: cachedPage.raw, cached: true, updatedAt: cachedPage.updatedAt };
    }

    const requestBody = {
      CategoryCode: categoryCode,
      ItemTier: 4,
      ItemGrade: "고대",
      PageNo: pageNo,
      Sort: "BUY_PRICE",
      SortCondition: "ASC"
    };

    if (searchOptions.length > 0) {
      requestBody.EtcOptions = requestSearchOptions(searchOptions);
    }

    const raw = await postAuction(requestBody);

    rawPageCache.set(cacheKey, { raw, updatedAt: currentTime });

    return { raw, cached: false, updatedAt: currentTime };
  }

  async function searchAccessoryCandidates({ type, currentAccessory = null, forceRefresh = false, eligibleOnly = true } = {}) {
    const category = ACCESSORY_AUCTION_CATEGORIES.find((item) => item.type === type);
    const searchOptions = buildAccessoryRefinementSearchOptions(currentAccessory);
    const items = [];
    let pagesFetched = 0;
    let rawItemsSeen = 0;
    const pageUpdatedTimes = [];

    if (!category) {
      return {
        type,
        items,
        pagesFetched,
        updatedAt: new Date(now()).toISOString()
      };
    }

    for (let pageNo = 1; pageNo <= ACCESSORY_SEARCH_LIMITS.maxPagesPerType; pageNo += 1) {
      const { raw, cached, updatedAt } = await getPage({
        type,
        categoryCode: category.categoryCode,
        searchOptions,
        pageNo,
        forceRefresh
      });
      pageUpdatedTimes.push(updatedAt);

      if (!cached) {
        pagesFetched += 1;
      }

      const rawItems = Array.isArray(raw?.Items) ? raw.Items : [];
      rawItemsSeen += rawItems.length;

      for (const rawItem of rawItems) {
        const accessory = normalizeAuctionAccessoryItem(rawItem, type);

        if (!eligibleOnly || isEligibleAccessoryCandidate(accessory).eligible) {
          items.push(accessory);
        }
      }

      const totalCount = Number(raw?.TotalCount || 0);
      const passedMinimumPages = pageNo >= ACCESSORY_SEARCH_LIMITS.minPagesPerType;
      const reachedLastPage = rawItems.length === 0 || rawItemsSeen >= totalCount;
      const reachedCandidateLimit = items.length >= ACCESSORY_SEARCH_LIMITS.maxCandidatesPerType;

      if (passedMinimumPages && (reachedLastPage || reachedCandidateLimit)) {
        break;
      }
    }

    return {
      type,
      items: items.slice(0, ACCESSORY_SEARCH_LIMITS.maxCandidatesPerType),
      searchOptions,
      pagesFetched,
      updatedAt: new Date(Math.max(...pageUpdatedTimes)).toISOString()
    };
  }

  return { searchAccessoryCandidates };
}
