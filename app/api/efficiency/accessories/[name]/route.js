import { NextResponse } from "next/server";
import {
  createAccessoryAuctionSearch,
  sharedAccessoryRawPageCache
} from "../../../../../lib/lostark/accessoryAuctionApi.js";
import { buildAccessoryFingerprint } from "../../../../../lib/lostark/accessoryAuction.js";
import {
  CHARACTER_EFFICIENCY_ERROR_CODES,
  CharacterEfficiencyError,
  defaultFetchLostark,
  getLostarkAuthorizationHeader,
  loadCharacterEfficiencyContext
} from "../../../../../lib/lostark/characterEfficiencyContext.js";
import { buildAccessoryEfficiencyRecommendation } from "../../../../../lib/spec/accessoryEfficiencySimulation.js";

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

function errorResponse(code, message, status) {
  return NextResponse.json({ code, message }, { status });
}

function decodeCharacterName(name) {
  try {
    return decodeURIComponent(name || "").trim();
  } catch {
    return "";
  }
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
    const characterContext = await loadCharacterEfficiencyContext({
      characterName,
      authorization,
      fetchLostark: defaultFetchLostark
    });
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

    const candidates = [...candidatesByKey.values()];
    const recommendation = buildAccessoryEfficiencyRecommendation({
      profile: characterContext.profile,
      equipment: characterContext.equipment,
      candidates,
      combatContext: characterContext.combatContext,
      criticalStats: characterContext.criticalStats
    });
    const marketUpdatedAt = searchResults
      .map((result) => result.updatedAt)
      .filter(Boolean)
      .sort()
      .at(-1) || null;

    return NextResponse.json({
      CharacterName: characterName,
      UpdatedAt: new Date().toISOString(),
      MarketUpdatedAt: marketUpdatedAt,
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
