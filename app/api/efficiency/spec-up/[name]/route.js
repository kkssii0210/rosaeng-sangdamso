import { NextResponse } from "next/server";
import {
  createAccessoryAuctionSearch,
  sharedAccessoryRawPageCache
} from "../../../../../lib/lostark/accessoryAuctionApi.js";
import { buildAccessoryFingerprint } from "../../../../../lib/lostark/accessoryAuction.js";
import { createLegendaryAvatarMarketSearch } from "../../../../../lib/lostark/avatarMarket.js";
import { createEngravingBookMarketSearch } from "../../../../../lib/lostark/engravingBookMarket.js";
import {
  CHARACTER_EFFICIENCY_ERROR_CODES,
  CharacterEfficiencyError,
  defaultFetchLostark,
  getLostarkAuthorizationHeader,
  loadCharacterEfficiencyContext
} from "../../../../../lib/lostark/characterEfficiencyContext.js";
import { getMarketSnapshot } from "../../../../../lib/lostark/marketApi.js";
import { buildAccessoryEfficiencyRecommendation } from "../../../../../lib/spec/accessoryEfficiencySimulation.js";
import { buildSpecUpRecommendation } from "../../../../../lib/spec/specUpRecommendation.js";
import { buildUpgradeEfficiency } from "../../../../../lib/spec/upgradeEfficiency.js";

export const runtime = "nodejs";

const ERROR_CODES = {
  INVALID_CHARACTER_NAME: "INVALID_CHARACTER_NAME",
  MISSING_API_KEY: "MISSING_API_KEY",
  CHARACTER_NOT_FOUND: "CHARACTER_NOT_FOUND",
  LOSTARK_API_ERROR: "LOSTARK_API_ERROR"
};
const SUPPORTED_ACCESSORY_TYPES = new Set(["목걸이", "귀걸이", "반지"]);

async function postAuction(body, authorization) {
  const response = await fetch("https://developer-lostark.game.onstove.com/auctions/items", {
    method: "POST",
    cache: "no-store",
    headers: {
      accept: "application/json",
      authorization,
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Lostark auction API ${response.status}`);
  }

  return response.json();
}

async function postMarket(body, authorization) {
  const response = await fetch("https://developer-lostark.game.onstove.com/markets/items", {
    method: "POST",
    cache: "no-store",
    headers: {
      accept: "application/json",
      authorization,
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Lostark market API ${response.status}`);
  }

  return response.json();
}

function errorResponse(code, message, status) {
  return NextResponse.json({ code, message }, { status });
}

function engravingLevel(engraving) {
  const level = Math.trunc(Number(engraving?.Level ?? engraving?.level ?? 0));

  return Number.isFinite(level) ? Math.max(0, Math.min(4, level)) : 0;
}

function upgradeableEngravingNames(characterContext) {
  const engravings = Array.isArray(characterContext?.combatContext?.engravings)
    ? characterContext.combatContext.engravings
    : [];

  return [...new Set(engravings
    .filter((engraving) => engravingLevel(engraving) < 4)
    .map((engraving) => String(engraving?.Name ?? engraving?.name ?? "").trim())
    .filter(Boolean))];
}

function decodeCharacterName(name) {
  try {
    return decodeURIComponent(name || "").trim();
  } catch {
    return "";
  }
}

async function searchAccessoryCandidates({ characterContext, authorization, forceRefresh }) {
  const auctionSearch = createAccessoryAuctionSearch({
    postAuction: (body) => postAuction(body, authorization),
    rawPageCache: sharedAccessoryRawPageCache
  });
  const accessorySlots = characterContext.equipment
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => SUPPORTED_ACCESSORY_TYPES.has(item?.Type));
  const searchResults = await Promise.all(
    accessorySlots.map(({ item }) => auctionSearch.searchAccessoryCandidates({
      type: item.Type,
      currentAccessory: item,
      forceRefresh
    }))
  );
  const candidatesByKey = new Map();

  for (const [resultIndex, result] of searchResults.entries()) {
    const targetEquipmentIndex = accessorySlots[resultIndex]?.index;

    for (const candidate of result.items) {
      const targetCandidate = {
        ...candidate,
        TargetEquipmentIndex: targetEquipmentIndex
      };

      candidatesByKey.set(
        `${targetEquipmentIndex}|${buildAccessoryFingerprint(candidate)}|price:${candidate.BuyPrice}|end:${candidate.EndDate}`,
        targetCandidate
      );
    }
  }

  return {
    candidates: [...candidatesByKey.values()],
    searchResults,
    accessorySlots
  };
}

async function searchEngravingBookPrices({ characterContext, authorization, forceRefresh }) {
  const engravingNames = upgradeableEngravingNames(characterContext);

  if (engravingNames.length === 0) {
    return [];
  }

  const marketSearch = createEngravingBookMarketSearch({
    postMarket: (body) => postMarket(body, authorization)
  });

  return marketSearch.getRelicBookPrices(engravingNames, { forceRefresh });
}

async function searchLegendaryAvatarPrices({ characterContext, authorization, forceRefresh }) {
  const className = String(characterContext?.profile?.CharacterClassName || "").trim();
  const marketSearch = createLegendaryAvatarMarketSearch({
    postMarket: (body) => postMarket(body, authorization)
  });

  return marketSearch.getLegendaryAvatarPrices({ className, forceRefresh });
}

export async function GET(request, context) {
  const { name } = await context.params;
  const characterName = decodeCharacterName(name);
  const authorization = getLostarkAuthorizationHeader();
  const forceRefresh = new URL(request.url).searchParams.get("refresh") === "1";

  if (!characterName) {
    return errorResponse(
      ERROR_CODES.INVALID_CHARACTER_NAME,
      "조회할 캐릭터명을 입력해줘.",
      400
    );
  }

  if (!authorization) {
    return errorResponse(
      ERROR_CODES.MISSING_API_KEY,
      "공식 Lostark Open API 키가 필요해.",
      500
    );
  }

  try {
    const [characterContext, marketSnapshot] = await Promise.all([
      loadCharacterEfficiencyContext({
        characterName,
        authorization,
        fetchLostark: defaultFetchLostark,
        includeAvatars: true
      }),
      getMarketSnapshot({ authorization, forceRefresh })
    ]);
    const [{ candidates, searchResults, accessorySlots }, engravingBookPrices, legendaryAvatarPrices] = await Promise.all([
      searchAccessoryCandidates({
        characterContext,
        authorization,
        forceRefresh
      }),
      searchEngravingBookPrices({
        characterContext,
        authorization,
        forceRefresh
      }),
      searchLegendaryAvatarPrices({
        characterContext,
        authorization,
        forceRefresh
      })
    ]);
    const accessoryRecommendation = buildAccessoryEfficiencyRecommendation({
      profile: characterContext.profile,
      equipment: characterContext.equipment,
      candidates,
      combatContext: characterContext.combatContext,
      criticalStats: characterContext.criticalStats
    });
    const upgradeEfficiency = buildUpgradeEfficiency({
      profile: characterContext.profile,
      equipment: characterContext.equipment,
      avatars: characterContext.avatars,
      gems: characterContext.combatContext.gems,
      criticalStats: characterContext.criticalStats,
      marketSnapshot,
      engravings: characterContext.combatContext.engravings,
      combatContext: characterContext.combatContext,
      engravingBookPrices,
      legendaryAvatarPrices
    });
    const recommendation = buildSpecUpRecommendation({
      accessoryRecommendation,
      upgradeEfficiency,
      limit: 5
    });
    const accessoryMarketUpdatedAt = searchResults
      .map((result) => result.updatedAt)
      .filter(Boolean)
      .sort()
      .at(-1) || null;

    return NextResponse.json({
      CharacterName: characterName,
      UpdatedAt: new Date().toISOString(),
      MarketUpdatedAt: marketSnapshot?.updatedAt || null,
      AccessoryMarketUpdatedAt: accessoryMarketUpdatedAt,
      SearchSummary: searchResults.map((result, index) => ({
        Type: result.type,
        EquipmentIndex: accessorySlots[index]?.index,
        SearchOptions: result.searchOptions.map((option) => option.Label),
        CandidateCount: result.items.length,
        PagesFetched: result.pagesFetched
      })),
      Recommendation: recommendation
    });
  } catch (error) {
    if (error instanceof CharacterEfficiencyError) {
      if (error.code === CHARACTER_EFFICIENCY_ERROR_CODES.INVALID_CHARACTER_NAME) {
        return errorResponse(
          ERROR_CODES.INVALID_CHARACTER_NAME,
          "조회할 캐릭터명을 입력해줘.",
          400
        );
      }

      if (error.code === CHARACTER_EFFICIENCY_ERROR_CODES.CHARACTER_NOT_FOUND) {
        return errorResponse(
          ERROR_CODES.CHARACTER_NOT_FOUND,
          "해당 캐릭터를 찾지 못했어.",
          404
        );
      }
    }

    console.error(error);

    return errorResponse(
      ERROR_CODES.LOSTARK_API_ERROR,
      "전투력 효율 계산에 필요한 정보를 불러오지 못했어.",
      502
    );
  }
}
