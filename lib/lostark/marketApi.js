import { buildMarketSnapshot, MARKET_SNAPSHOT_CACHE_TTL_MS, MARKET_SNAPSHOT_QUERIES } from "./marketSnapshot.js";

const LOSTARK_API_BASE_URL = "https://developer-lostark.game.onstove.com";

const snapshotCache = globalThis.__sgguMarketSnapshotCache || {
  value: null,
  expiresAt: 0,
  pending: null
};

globalThis.__sgguMarketSnapshotCache = snapshotCache;

async function postLostark(path, authorization, body) {
  const response = await fetch(`${LOSTARK_API_BASE_URL}${path}`, {
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
    const errorText = await response.text();
    throw new Error(`Lostark Open API ${response.status}: ${errorText.slice(0, 180)}`);
  }

  return response.json();
}

function stripRequestMetadata(request) {
  const { CategoryName: _categoryName, ...body } = request;
  return body;
}

async function fetchMarketSnapshot(authorization) {
  const groups = await Promise.all(
    MARKET_SNAPSHOT_QUERIES.map(async (group) => {
      const responses = await Promise.all(
        group.requests.map(async (request) => ({
          request,
          response: await postLostark(group.endpoint, authorization, stripRequestMetadata(request))
        }))
      );

      return {
        group,
        responses
      };
    })
  );

  return buildMarketSnapshot(groups);
}

export async function getMarketSnapshot({ authorization, forceRefresh = false } = {}) {
  const now = Date.now();

  if (!forceRefresh && snapshotCache.value && snapshotCache.expiresAt > now) {
    return {
      ...snapshotCache.value,
      cached: true,
      cacheExpiresAt: new Date(snapshotCache.expiresAt).toISOString()
    };
  }

  if (!snapshotCache.pending) {
    snapshotCache.pending = fetchMarketSnapshot(authorization)
      .then((snapshot) => {
        snapshotCache.value = snapshot;
        snapshotCache.expiresAt = Date.now() + MARKET_SNAPSHOT_CACHE_TTL_MS;
        return snapshot;
      })
      .finally(() => {
        snapshotCache.pending = null;
      });
  }

  const snapshot = await snapshotCache.pending;

  return {
    ...snapshot,
    cached: false,
    cacheExpiresAt: new Date(snapshotCache.expiresAt).toISOString()
  };
}
