import test from "node:test";
import assert from "node:assert/strict";
import { AVATAR_MARKET_CATEGORIES, createLegendaryAvatarMarketSearch } from "../lib/lostark/avatarMarket.js";

test("searches legendary avatar prices by character class and slot", async () => {
  const requests = [];
  const marketSearch = createLegendaryAvatarMarketSearch({
    now: () => 1000,
    rawPriceCache: new Map(),
    postMarket: async (body) => {
      requests.push(body);
      const slot = AVATAR_MARKET_CATEGORIES.find((category) => category.CategoryCode === body.CategoryCode)?.Slot;

      return {
        TotalCount: 1,
        Items: [
          {
            Name: `전설 스카우터 ${slot}`,
            Grade: "전설",
            CurrentMinPrice: body.CategoryCode === 20010 ? 250000 : 200000,
            BundleCount: 1,
            RecentPrice: 190000,
            YDayAvgPrice: 180000
          }
        ]
      };
    }
  });

  const prices = await marketSearch.getLegendaryAvatarPrices({ className: "스카우터" });

  assert.deepEqual(
    requests.map((request) => request.CategoryCode),
    AVATAR_MARKET_CATEGORIES.map((category) => category.CategoryCode)
  );
  assert.deepEqual(
    requests.map((request) => request.ItemName),
    ["스카우터", "스카우터", "스카우터", "스카우터"]
  );
  assert.deepEqual(requests[1], {
    CategoryCode: 20010,
    ItemGrade: "전설",
    ItemName: "스카우터",
    PageNo: 1,
    Sort: "CURRENT_MIN_PRICE",
    SortCondition: "ASC"
  });
  assert.equal(prices.find((item) => item.Slot === "머리").UnitPrice, 250000);
  assert.equal(prices.find((item) => item.Slot === "머리").ClassName, "스카우터");
});
