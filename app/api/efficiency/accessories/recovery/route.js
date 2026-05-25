import { NextResponse } from "next/server";
import {
  createAccessoryAuctionSearch,
  sharedAccessoryRawPageCache
} from "../../../../../lib/lostark/accessoryAuctionApi.js";
import { getLostarkAuthorizationHeader } from "../../../../../lib/lostark/characterEfficiencyContext.js";
import { buildRecoveryEstimate } from "../../../../../lib/spec/accessoryRecoveryEstimate.js";

export const runtime = "nodejs";

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

function isPositiveFiniteNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0;
  }

  if (typeof value !== "string") {
    return false;
  }

  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return false;
  }

  const number = Number(normalizedValue);

  return Number.isFinite(number) && number > 0;
}

export async function POST(request) {
  const authorization = getLostarkAuthorizationHeader();
  const body = await request.json().catch(() => null);

  if (
    !SUPPORTED_ACCESSORY_TYPES.has(body?.CurrentAccessory?.Type) ||
    !isPositiveFiniteNumber(body?.Recommendation?.BuyPrice) ||
    !isPositiveFiniteNumber(body?.Recommendation?.CombatPowerGainPercent)
  ) {
    return errorResponse(
      "INVALID_RECOVERY_REQUEST",
      "회수가 추정에 필요한 추천 결과가 없어.",
      400
    );
  }

  if (!authorization) {
    return errorResponse(
      "MISSING_API_KEY",
      "공식 Lostark Open API 키가 필요해.",
      500
    );
  }

  try {
    const auctionSearch = createAccessoryAuctionSearch({
      postAuction: (auctionBody) => postAuction(auctionBody, authorization),
      rawPageCache: sharedAccessoryRawPageCache
    });
    const searchResult = await auctionSearch.searchAccessoryCandidates({
      type: body.CurrentAccessory.Type,
      currentAccessory: body.CurrentAccessory,
      forceRefresh: Boolean(body.ForceRefresh),
      eligibleOnly: false
    });
    const recoveryEstimate = buildRecoveryEstimate({
      currentAccessory: body.CurrentAccessory,
      auctionCandidates: searchResult.items,
      recommendation: body.Recommendation
    });

    return NextResponse.json({
      UpdatedAt: searchResult.updatedAt,
      SearchSummary: {
        Type: searchResult.type,
        SearchOptions: searchResult.searchOptions.map((option) => option.Label),
        CandidateCount: searchResult.items.length,
        PagesFetched: searchResult.pagesFetched
      },
      RecoveryEstimate: recoveryEstimate
    });
  } catch (error) {
    console.error(error);

    return errorResponse(
      "LOSTARK_API_ERROR",
      "현재 악세 예상 회수가를 계산하지 못했어.",
      502
    );
  }
}
