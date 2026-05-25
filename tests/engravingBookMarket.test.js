import test from "node:test";
import assert from "node:assert/strict";
import { createEngravingBookMarketSearch } from "../lib/lostark/engravingBookMarket.js";

test("searches only current engraving relic books through market API", async () => {
  const requests = [];
  const marketSearch = createEngravingBookMarketSearch({
    now: () => 1000,
    rawPriceCache: new Map(),
    postMarket: async (body) => {
      requests.push(body);

      return {
        TotalCount: 1,
        Items: [
          {
            Name: `유물 ${body.ItemName} 각인서`,
            Grade: "유물",
            CurrentMinPrice: body.ItemName === "원한" ? 190000 : 120000,
            BundleCount: 1,
            RecentPrice: 119000,
            YDayAvgPrice: 118000
          }
        ]
      };
    }
  });

  const prices = await marketSearch.getRelicBookPrices(["원한", "아드레날린", "원한"]);

  assert.deepEqual(requests.map((request) => request.ItemName), ["원한", "아드레날린"]);
  assert.deepEqual(requests[0], {
    CategoryCode: 40000,
    ItemGrade: "유물",
    ItemName: "원한",
    PageNo: 1,
    Sort: "CURRENT_MIN_PRICE",
    SortCondition: "ASC"
  });
  assert.equal(prices.find((item) => item.EngravingName === "원한").UnitPrice, 190000);
  assert.equal(prices.find((item) => item.EngravingName === "아드레날린").CostForFiveBooks, 600000);
});
