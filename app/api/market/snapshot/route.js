import { NextResponse } from "next/server";
import { getMarketSnapshot } from "../../../../lib/lostark/marketApi.js";

export const runtime = "nodejs";

const ERROR_CODES = {
  MISSING_API_KEY: "MISSING_API_KEY",
  LOSTARK_API_ERROR: "LOSTARK_API_ERROR"
};

function getAuthorizationHeader() {
  const token = process.env.LOSTARK_API_KEY || process.env.LOSTARK_OPEN_API_KEY;

  if (!token) {
    return null;
  }

  const normalizedToken = token.trim();

  if (normalizedToken.toLowerCase().startsWith("bearer ")) {
    return normalizedToken;
  }

  return `bearer ${normalizedToken}`;
}

export async function GET(request) {
  const authorization = getAuthorizationHeader();
  const forceRefresh = new URL(request.url).searchParams.get("refresh") === "1";

  if (!authorization) {
    return NextResponse.json(
      {
        code: ERROR_CODES.MISSING_API_KEY,
        message: "공식 Lostark Open API 키가 필요해. .env.local에 LOSTARK_API_KEY를 설정해줘."
      },
      { status: 500 }
    );
  }

  try {
    return NextResponse.json(await getMarketSnapshot({ authorization, forceRefresh }));
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        code: ERROR_CODES.LOSTARK_API_ERROR,
        message: "공식 Lostark 거래소/경매장 API 응답이 불안정해. 잠시 후 다시 조회해줘."
      },
      { status: 502 }
    );
  }
}
