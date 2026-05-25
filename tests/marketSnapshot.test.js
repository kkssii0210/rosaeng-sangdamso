import test from "node:test";
import assert from "node:assert/strict";
import { buildMarketSnapshot, MARKET_SNAPSHOT_QUERIES } from "../lib/lostark/marketSnapshot.js";

test("market snapshot queries explicit weapon honing material prices", () => {
  const honingMaterials = MARKET_SNAPSHOT_QUERIES.find((group) => group.id === "honing-materials");
  const honingSupports = MARKET_SNAPSHOT_QUERIES.find((group) => group.id === "honing-supports");

  assert.deepEqual(
    honingMaterials.requests.map((request) => request.ItemName),
    ["운명의 파괴석 결정", "운명의 수호석 결정", "위대한 운명의 돌파석", "상급 아비도스 융화 재료", "운명의 파편"]
  );
  assert.deepEqual(
    honingSupports.requests.map((request) => request.ItemName),
    ["용암의 숨결", "빙하의 숨결"]
  );
});

test("normalizes market and auction snapshot groups", () => {
  const snapshot = buildMarketSnapshot(
    [
      {
        group: {
          id: "honing-materials",
          label: "강화 재료",
          description: "T4 재련 재료 최저가",
          sourceType: "market",
          itemLimit: 5
        },
        responses: [
          {
            request: {
              CategoryCode: 50010,
              CategoryName: "재련 재료"
            },
            response: {
              TotalCount: 1,
              Items: [
                {
                  CurrentMinPrice: 297,
                  Id: 66102006,
                  Name: "운명의 파괴석",
                  Grade: "일반",
                  Icon: "https://cdn-lostark.game.onstove.com/sample.png",
                  BundleCount: 100,
                  YDayAvgPrice: 300,
                  RecentPrice: 298
                }
              ]
            }
          }
        ]
      },
      {
        group: {
          id: "gems",
          label: "보석",
          description: "T4 주요 레벨별 즉시 구매가",
          sourceType: "auction",
          itemLimit: 5
        },
        responses: [
          {
            request: {
              CategoryCode: 210000,
              CategoryName: "9레벨"
            },
            response: {
              TotalCount: 1,
              Items: [
                {
                  Name: "9레벨 겁화의 보석",
                  Grade: "유물",
                  Tier: 4,
                  Level: 1640,
                  Icon: "https://cdn-lostark.game.onstove.com/gem.png",
                  AuctionInfo: {
                    BuyPrice: 1050000,
                    TradeAllowCount: 0
                  },
                  Options: [
                    {
                      Type: "GEM_SKILL_DAMAGE",
                      ClassName: "워로드",
                      OptionName: "라이징 스피어",
                      Value: 32,
                      IsValuePercentage: true
                    }
                  ]
                }
              ]
            }
          }
        ]
      }
    ],
    new Date("2026-05-12T12:00:00.000Z")
  );

  assert.equal(snapshot.updatedAt, "2026-05-12T12:00:00.000Z");
  assert.equal(snapshot.groups.length, 2);
  assert.deepEqual(snapshot.groups[0].items[0], {
    key: "market-66102006-50010",
    sourceType: "market",
    categoryName: "재련 재료",
    name: "운명의 파괴석",
    grade: "일반",
    icon: "https://cdn-lostark.game.onstove.com/sample.png",
    currentMinPrice: 297,
    recentPrice: 298,
    yesterdayAveragePrice: 300,
    priceDelta: {
      amount: -3,
      percent: -1
    },
    bundleCount: 100,
    tradeRemainCount: null,
    options: []
  });
  assert.equal(snapshot.groups[1].items[0].currentMinPrice, 1050000);
  assert.deepEqual(snapshot.groups[1].items[0].options, ["워로드 라이징 스피어 32%"]);
  assert.equal(snapshot.groups[1].items[0].gemLevel, 9);
  assert.equal(snapshot.groups[1].items[0].gemEffectType, "damage");
  assert.equal(snapshot.groups[1].items[0].gemEffectValue, 32);
});
