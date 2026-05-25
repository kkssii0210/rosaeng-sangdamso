import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next/server") {
      return nextResolve("next/server.js", context);
    }

    return nextResolve(specifier, context);
  }
});

const { GET: getRecommendation } = await import("../app/api/efficiency/accessories/[name]/route.js");
const { GET: getSpecUpRecommendation } = await import("../app/api/efficiency/spec-up/[name]/route.js");

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function createAvatarTooltip(statLine) {
  return JSON.stringify({
    AvatarAttribute: {
      IsInner: true,
      IsSet: false
    },
    Element_005: {
      type: "ItemPartBox",
      value: {
        Element_000: "<FONT COLOR='#A9D0F5'>기본 효과</FONT>",
        Element_001: statLine
      }
    }
  });
}

function createGemTooltip({ className = "스카우터", skillName = "라이징 스피어", effectValue = 24, basicAttack = 0.6 } = {}) {
  return JSON.stringify({
    Element_005: {
      type: "ItemPartBox",
      value: {
        Element_000: "<FONT COLOR='#A9D0F5'>보석 효과</FONT>",
        Element_001: [
          `[${className}] ${skillName} 피해 ${effectValue}% 증가`,
          `기본 공격력 ${basicAttack}% 증가`
        ].join("<BR>")
      }
    }
  });
}

function createLegendaryAvatar(type) {
  return {
    Type: `${type} 아바타`,
    Name: `전설 ${type} 아바타`,
    Grade: "전설",
    IsInner: true,
    IsSet: false,
    Tooltip: createAvatarTooltip("민첩 +2.00%")
  };
}

function createAttackStat({ basic }) {
  return {
    Type: "공격력",
    Value: String(basic),
    Tooltip: [
      `힘, 민첩, 지능과 무기 공격력을 기반으로 증가한 기본 공격력은 <font color='#99ff99'>${basic}</font> 입니다.`,
      "공격력 증감 효과로 공격력이 <font color='#99ff99'>0</font> 증가되었습니다."
    ]
  };
}

function createMarketItem(body) {
  if (body.ItemGrade === "전설") {
    return {
      Name: `전설 ${body.CategoryName}`,
      Grade: "전설",
      CurrentMinPrice: 50000,
      BundleCount: 1
    };
  }

  return null;
}

const AVATAR_SLOT_BY_CATEGORY_CODE = {
  20005: "무기",
  20010: "머리",
  20050: "상의",
  20060: "하의"
};

test("efficiency recommendation route returns JSON for invalid character name", async () => {
  const response = await getRecommendation(new Request("http://localhost/api/efficiency/accessories/%20"), {
    params: Promise.resolve({ name: "%20" })
  });
  const data = await response.json();

  assert.equal(response.status, 400);
  assert.equal(data.code, "INVALID_CHARACTER_NAME");
});

test("spec-up recommendation route returns JSON for invalid character name", async () => {
  const response = await getSpecUpRecommendation(new Request("http://localhost/api/efficiency/spec-up/%20"), {
    params: Promise.resolve({ name: "%20" })
  });
  const data = await response.json();

  assert.equal(response.status, 400);
  assert.equal(data.code, "INVALID_CHARACTER_NAME");
});

test("spec-up route does not recommend legendary avatars already equipped", async () => {
  const previousFetch = globalThis.fetch;
  const previousApiKey = process.env.LOSTARK_API_KEY;
  const seenPaths = [];

  process.env.LOSTARK_API_KEY = "test-api-key";

  if (globalThis.__sgguMarketSnapshotCache) {
    globalThis.__sgguMarketSnapshotCache.value = null;
    globalThis.__sgguMarketSnapshotCache.expiresAt = 0;
    globalThis.__sgguMarketSnapshotCache.pending = null;
  }

  globalThis.fetch = async (url, options = {}) => {
    const parsedUrl = new URL(url);
    const path = parsedUrl.pathname;
    seenPaths.push(path);

    if (path.endsWith("/profiles")) {
      return jsonResponse({
        CharacterName: "붐버",
        CharacterClassName: "스카우터",
        ServerName: "루페온",
        Stats: []
      });
    }

    if (path.endsWith("/equipment")) {
      return jsonResponse([]);
    }

    if (path.endsWith("/avatars")) {
      return jsonResponse([
        createLegendaryAvatar("무기"),
        createLegendaryAvatar("머리"),
        createLegendaryAvatar("상의"),
        createLegendaryAvatar("하의")
      ]);
    }

    if (
      path.endsWith("/arkpassive") ||
      path.endsWith("/arkgrid") ||
      path.endsWith("/cards") ||
      path.endsWith("/combat-skills") ||
      path.endsWith("/engravings") ||
      path.endsWith("/gems")
    ) {
      return jsonResponse(path.endsWith("/combat-skills") ? [] : {});
    }

    if (path.endsWith("/markets/items")) {
      const body = JSON.parse(options.body || "{}");
      const item = createMarketItem(body);

      return jsonResponse({
        PageNo: 1,
        PageSize: 10,
        TotalCount: item ? 1 : 0,
        Items: item ? [item] : []
      });
    }

    if (path.endsWith("/auctions/items")) {
      return jsonResponse({
        PageNo: 1,
        PageSize: 10,
        TotalCount: 0,
        Items: []
      });
    }

    return jsonResponse({}, 404);
  };

  try {
    const response = await getSpecUpRecommendation(new Request("http://localhost/api/efficiency/spec-up/%EB%B6%90%EB%B2%84?refresh=1"), {
      params: Promise.resolve({ name: "%EB%B6%90%EB%B2%84" })
    });
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(seenPaths.some((path) => path.endsWith("/avatars")), true);
    assert.equal(
      data.Recommendation.TopCandidates.some((candidate) => candidate.Type === "legendaryAvatar"),
      false
    );
  } finally {
    globalThis.fetch = previousFetch;

    if (previousApiKey === undefined) {
      delete process.env.LOSTARK_API_KEY;
    } else {
      process.env.LOSTARK_API_KEY = previousApiKey;
    }
  }
});

test("spec-up route searches current engraving relic books and returns engraving candidate", async () => {
  const previousFetch = globalThis.fetch;
  const previousApiKey = process.env.LOSTARK_API_KEY;
  const marketRequests = [];

  process.env.LOSTARK_API_KEY = "test-api-key";

  if (globalThis.__sgguMarketSnapshotCache) {
    globalThis.__sgguMarketSnapshotCache.value = null;
    globalThis.__sgguMarketSnapshotCache.expiresAt = 0;
    globalThis.__sgguMarketSnapshotCache.pending = null;
  }

  if (globalThis.__sgguEngravingBookPriceCache) {
    globalThis.__sgguEngravingBookPriceCache.clear();
  }

  globalThis.fetch = async (url, options = {}) => {
    const parsedUrl = new URL(url);
    const path = parsedUrl.pathname;

    if (path.endsWith("/profiles")) {
      return jsonResponse({
        CharacterName: "붐버",
        CharacterClassName: "스카우터",
        ServerName: "루페온",
        CharacterLevel: 70,
        Stats: [createAttackStat({ basic: 100000 })]
      });
    }

    if (path.endsWith("/equipment")) {
      return jsonResponse([]);
    }

    if (path.endsWith("/engravings")) {
      return jsonResponse({
        ArkPassiveEffects: [
          { Name: "원한", Grade: "유물", Level: 3, Description: "" },
          { Name: "아드레날린", Grade: "유물", Level: 4, Description: "" }
        ]
      });
    }

    if (
      path.endsWith("/avatars") ||
      path.endsWith("/arkpassive") ||
      path.endsWith("/arkgrid") ||
      path.endsWith("/cards") ||
      path.endsWith("/combat-skills") ||
      path.endsWith("/gems")
    ) {
      return jsonResponse(path.endsWith("/combat-skills") || path.endsWith("/avatars") ? [] : {});
    }

    if (path.endsWith("/markets/items")) {
      const body = JSON.parse(options.body || "{}");
      marketRequests.push(body);

      if (body.CategoryCode === 40000) {
        return jsonResponse({
          PageNo: 1,
          PageSize: 10,
          TotalCount: 1,
          Items: [
            {
              Name: `유물 ${body.ItemName} 각인서`,
              Grade: "유물",
              CurrentMinPrice: 200000,
              BundleCount: 1
            }
          ]
        });
      }

      return jsonResponse({
        PageNo: 1,
        PageSize: 10,
        TotalCount: 0,
        Items: []
      });
    }

    if (path.endsWith("/auctions/items")) {
      return jsonResponse({
        PageNo: 1,
        PageSize: 10,
        TotalCount: 0,
        Items: []
      });
    }

    return jsonResponse({}, 404);
  };

  try {
    const response = await getSpecUpRecommendation(new Request("http://localhost/api/efficiency/spec-up/%EB%B6%90%EB%B2%84?refresh=1"), {
      params: Promise.resolve({ name: "%EB%B6%90%EB%B2%84" })
    });
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(
      marketRequests.filter((request) => request.CategoryCode === 40000).map((request) => request.ItemName),
      ["원한"]
    );
    assert.equal(
      data.Recommendation.TopCandidates.some((candidate) => candidate.Type === "engravingBook" && candidate.Target === "원한"),
      true
    );
  } finally {
    globalThis.fetch = previousFetch;

    if (previousApiKey === undefined) {
      delete process.env.LOSTARK_API_KEY;
    } else {
      process.env.LOSTARK_API_KEY = previousApiKey;
    }
  }
});

test("spec-up route includes current gem combat power candidates", async () => {
  const previousFetch = globalThis.fetch;
  const previousApiKey = process.env.LOSTARK_API_KEY;

  process.env.LOSTARK_API_KEY = "test-api-key";

  if (globalThis.__sgguMarketSnapshotCache) {
    globalThis.__sgguMarketSnapshotCache.value = null;
    globalThis.__sgguMarketSnapshotCache.expiresAt = 0;
    globalThis.__sgguMarketSnapshotCache.pending = null;
  }

  if (globalThis.__sgguEngravingBookPriceCache) {
    globalThis.__sgguEngravingBookPriceCache.clear();
  }

  globalThis.fetch = async (url, options = {}) => {
    const parsedUrl = new URL(url);
    const path = parsedUrl.pathname;

    if (path.endsWith("/profiles")) {
      return jsonResponse({
        CharacterName: "붐버",
        CharacterClassName: "스카우터",
        ServerName: "루페온",
        CharacterLevel: 70,
        Stats: [createAttackStat({ basic: 100000 })]
      });
    }

    if (path.endsWith("/equipment") || path.endsWith("/avatars")) {
      return jsonResponse([]);
    }

    if (path.endsWith("/gems")) {
      return jsonResponse({
        Gems: [
          {
            Slot: 0,
            Name: "7레벨 겁화의 보석",
            Grade: "유물",
            Level: 7,
            Tooltip: createGemTooltip({ effectValue: 24, basicAttack: 0.6 })
          }
        ]
      });
    }

    if (
      path.endsWith("/arkpassive") ||
      path.endsWith("/arkgrid") ||
      path.endsWith("/cards") ||
      path.endsWith("/combat-skills") ||
      path.endsWith("/engravings")
    ) {
      return jsonResponse(path.endsWith("/combat-skills") ? [] : {});
    }

    if (path.endsWith("/markets/items")) {
      return jsonResponse({
        PageNo: 1,
        PageSize: 10,
        TotalCount: 0,
        Items: []
      });
    }

    if (path.endsWith("/auctions/items")) {
      const body = JSON.parse(options.body || "{}");
      const level = Number(String(body.ItemName || "").match(/(?<level>\d+)레벨/)?.groups?.level);

      if (body.CategoryCode === 210000 && Number.isFinite(level)) {
        return jsonResponse({
          PageNo: 1,
          PageSize: 10,
          TotalCount: 1,
          Items: [
            {
              Name: `${level}레벨 겁화의 보석`,
              Grade: "유물",
              Tier: 4,
              AuctionInfo: {
                BuyPrice: level === 7 ? 100000 : 200000,
                TradeAllowCount: 0
              },
              Options: [
                {
                  Type: "GEM_SKILL_DAMAGE",
                  ClassName: "스카우터",
                  OptionName: "라이징 스피어",
                  Value: level === 7 ? 24 : 30,
                  IsValuePercentage: true
                }
              ]
            }
          ]
        });
      }

      return jsonResponse({
        PageNo: 1,
        PageSize: 10,
        TotalCount: 0,
        Items: []
      });
    }

    return jsonResponse({}, 404);
  };

  try {
    const response = await getSpecUpRecommendation(new Request("http://localhost/api/efficiency/spec-up/%EB%B6%90%EB%B2%84?refresh=1"), {
      params: Promise.resolve({ name: "%EB%B6%90%EB%B2%84" })
    });
    const data = await response.json();
    const gemCandidate = data.Recommendation.TopCandidates.find((candidate) => candidate.Type === "gem");

    assert.equal(response.status, 200);
    assert.equal(gemCandidate.Label, "라이징 스피어 7->8");
    assert.equal(gemCandidate.NetCostGold, 100000);
    assert.equal(gemCandidate.GainType, "combatPower");
  } finally {
    globalThis.fetch = previousFetch;

    if (previousApiKey === undefined) {
      delete process.env.LOSTARK_API_KEY;
    } else {
      process.env.LOSTARK_API_KEY = previousApiKey;
    }
  }
});

test("spec-up route prices legendary avatars with character class name", async () => {
  const previousFetch = globalThis.fetch;
  const previousApiKey = process.env.LOSTARK_API_KEY;
  const marketRequests = [];

  process.env.LOSTARK_API_KEY = "test-api-key";

  if (globalThis.__sgguMarketSnapshotCache) {
    globalThis.__sgguMarketSnapshotCache.value = null;
    globalThis.__sgguMarketSnapshotCache.expiresAt = 0;
    globalThis.__sgguMarketSnapshotCache.pending = null;
  }

  if (globalThis.__sgguLegendaryAvatarPriceCache) {
    globalThis.__sgguLegendaryAvatarPriceCache.clear();
  }

  globalThis.fetch = async (url, options = {}) => {
    const parsedUrl = new URL(url);
    const path = parsedUrl.pathname;

    if (path.endsWith("/profiles")) {
      return jsonResponse({
        CharacterName: "붐버",
        CharacterClassName: "스카우터",
        ServerName: "루페온",
        Stats: []
      });
    }

    if (path.endsWith("/equipment")) {
      return jsonResponse([]);
    }

    if (path.endsWith("/avatars")) {
      return jsonResponse([
        {
          Type: "머리 아바타",
          Name: "영웅 머리 아바타",
          Grade: "영웅",
          IsInner: true,
          IsSet: false,
          Tooltip: createAvatarTooltip("민첩 +1.00%")
        },
        createLegendaryAvatar("무기"),
        createLegendaryAvatar("상의"),
        createLegendaryAvatar("하의")
      ]);
    }

    if (
      path.endsWith("/arkpassive") ||
      path.endsWith("/arkgrid") ||
      path.endsWith("/cards") ||
      path.endsWith("/combat-skills") ||
      path.endsWith("/engravings") ||
      path.endsWith("/gems")
    ) {
      return jsonResponse(path.endsWith("/combat-skills") ? [] : {});
    }

    if (path.endsWith("/markets/items")) {
      const body = JSON.parse(options.body || "{}");
      marketRequests.push(body);

      if (body.ItemGrade === "전설" && body.ItemName === "스카우터") {
        return jsonResponse({
          PageNo: 1,
          PageSize: 10,
          TotalCount: 1,
          Items: [
            {
              Name: `전설 스카우터 ${AVATAR_SLOT_BY_CATEGORY_CODE[body.CategoryCode]}`,
              Grade: "전설",
              CurrentMinPrice: body.CategoryCode === 20010 ? 250000 : 300000,
              BundleCount: 1
            }
          ]
        });
      }

      if (body.ItemGrade === "전설") {
        return jsonResponse({
          PageNo: 1,
          PageSize: 10,
          TotalCount: 1,
          Items: [
            {
              Name: "공용 전설 아바타",
              Grade: "전설",
              CurrentMinPrice: 50000,
              BundleCount: 1
            }
          ]
        });
      }

      return jsonResponse({
        PageNo: 1,
        PageSize: 10,
        TotalCount: 0,
        Items: []
      });
    }

    if (path.endsWith("/auctions/items")) {
      return jsonResponse({
        PageNo: 1,
        PageSize: 10,
        TotalCount: 0,
        Items: []
      });
    }

    return jsonResponse({}, 404);
  };

  try {
    const response = await getSpecUpRecommendation(new Request("http://localhost/api/efficiency/spec-up/%EB%B6%90%EB%B2%84?refresh=1"), {
      params: Promise.resolve({ name: "%EB%B6%90%EB%B2%84" })
    });
    const data = await response.json();
    const avatarCandidate = data.Recommendation.TopCandidates.find((candidate) => candidate.Type === "legendaryAvatar");

    assert.equal(response.status, 200);
    assert.deepEqual(
      marketRequests
        .filter((request) => request.ItemGrade === "전설" && request.ItemName === "스카우터")
        .map((request) => request.CategoryCode),
      [20005, 20010, 20050, 20060]
    );
    assert.equal(avatarCandidate.Target, "머리");
    assert.equal(avatarCandidate.NetCostGold, 250000);
  } finally {
    globalThis.fetch = previousFetch;

    if (previousApiKey === undefined) {
      delete process.env.LOSTARK_API_KEY;
    } else {
      process.env.LOSTARK_API_KEY = previousApiKey;
    }
  }
});
