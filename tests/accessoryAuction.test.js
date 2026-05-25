import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAccessoryRefinementSearchOptions,
  isEligibleAccessoryCandidate,
  normalizeAuctionAccessoryItem
} from "../lib/lostark/accessoryAuction.js";
import { createAccessoryAuctionSearch } from "../lib/lostark/accessoryAuctionApi.js";

function auctionAccessory({ upgradeLevel = 3, arkPassiveValue = 13, quality = 95 } = {}) {
  return {
    Name: "도래한 결전의 목걸이",
    Grade: "고대",
    Tier: 4,
    Level: 1680,
    GradeQuality: quality,
    AuctionInfo: {
      BuyPrice: 1000,
      TradeAllowCount: 2,
      UpgradeLevel: upgradeLevel
    },
    Options: [
      {
        Type: "ARK_PASSIVE",
        OptionName: "깨달음",
        Value: arkPassiveValue,
        IsValuePercentage: false
      },
      {
        Type: "ACCESSORY_UPGRADE",
        OptionName: "적에게 주는 피해 증가",
        Value: 2,
        IsValuePercentage: true
      },
      {
        Type: "ACCESSORY_UPGRADE",
        OptionName: "추가 피해",
        Value: 1.6,
        IsValuePercentage: true
      },
      {
        Type: "ACCESSORY_UPGRADE",
        OptionName: "공격력 ",
        Value: 390,
        IsValuePercentage: false
      },
      {
        Type: "STAT",
        OptionName: "힘",
        Value: 15000,
        IsValuePercentage: false
      }
    ]
  };
}

test("normalizes ark passive and upgrade level from auction accessories", () => {
  const accessory = normalizeAuctionAccessoryItem(auctionAccessory(), "목걸이");

  assert.equal(accessory.EnlightenmentPoint, 13);
  assert.equal(accessory.UpgradeLevel, 3);
});

test("only three-upgrade auction accessories are eligible", () => {
  const eligibleAccessory = normalizeAuctionAccessoryItem(auctionAccessory(), "목걸이");
  const twoUpgradeAccessory = normalizeAuctionAccessoryItem(auctionAccessory({ upgradeLevel: 2 }), "목걸이");

  assert.equal(isEligibleAccessoryCandidate(eligibleAccessory).eligible, true);
  assert.deepEqual(isEligibleAccessoryCandidate(twoUpgradeAccessory), {
    eligible: false,
    reason: "BELOW_REQUIRED_UPGRADE_LEVEL"
  });
});

test("does not reject eligible accessories by quality", () => {
  const accessory = normalizeAuctionAccessoryItem(auctionAccessory({ quality: 77 }), "목걸이");

  assert.equal(isEligibleAccessoryCandidate(accessory).eligible, true);
});

test("builds refinement filters from the equipped accessory damage options", () => {
  const filters = buildAccessoryRefinementSearchOptions({
    Type: "목걸이",
    DetailSections: [
      {
        title: "연마 효과",
        lines: ["적에게 주는 피해 +2.00%", "최대 마나 +15", "추가 피해 +1.60%"]
      }
    ]
  });

  assert.deepEqual(filters, [
    {
      FirstOption: 7,
      SecondOption: 42,
      MinValue: 200,
      MaxValue: 200,
      Label: "적에게 주는 피해 2.00% 이상"
    },
    {
      FirstOption: 7,
      SecondOption: 41,
      MinValue: 160,
      MaxValue: 260,
      Label: "추가 피해 1.60% 이상"
    }
  ]);
});

test("auction search requests equipped accessory refinement filters without quality", async () => {
  const requestBodies = [];
  const search = createAccessoryAuctionSearch({
    postAuction: async (body) => {
      requestBodies.push(body);

      return {
        TotalCount: 1,
        Items: body.PageNo === 1 ? [auctionAccessory()] : []
      };
    }
  });

  const result = await search.searchAccessoryCandidates({
    type: "목걸이",
    currentAccessory: {
      Type: "목걸이",
      DetailSections: [
        {
          title: "연마 효과",
          lines: ["적에게 주는 피해 +2.00%", "최대 마나 +15", "추가 피해 +1.60%"]
        }
      ]
    }
  });

  assert.equal(result.items.length, 1);
  assert.equal(requestBodies[0].ItemGradeQuality, undefined);
  assert.deepEqual(requestBodies[0].EtcOptions, [
    {
      FirstOption: 7,
      SecondOption: 42,
      MinValue: 200,
      MaxValue: 200
    },
    {
      FirstOption: 7,
      SecondOption: 41,
      MinValue: 160,
      MaxValue: 260
    }
  ]);
  assert.deepEqual(result.searchOptions.map((option) => option.Label), [
    "적에게 주는 피해 2.00% 이상",
    "추가 피해 1.60% 이상"
  ]);
});
