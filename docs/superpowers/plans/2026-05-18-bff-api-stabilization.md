# BFF API Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize Lostark Open API access by moving transport behavior into a shared client while preserving the current character-analysis response DTO.

**Architecture:** Add `lib/lostark/apiClient.js` for authorization normalization, GET/POST requests, timeout, retry, and upstream error mapping. Keep route handlers as BFF controllers and keep market snapshot caching inside `lib/lostark/marketApi.js`.

**Tech Stack:** Next.js 16 API Routes, Node.js 22, native `fetch`, native `AbortController`, `node:test`, ES modules. Java/JDK is not required for this phase because the backend remains Node/Next.js.

---

## File Structure

- Create: `lib/lostark/apiClient.js`
  - Owns Lostark base URL, authorization normalization, request timeout, retry, and upstream error mapping.
- Create: `tests/lostarkApiClient.test.js`
  - Unit tests for the shared client with fake `fetchImpl`; no network access.
- Modify: `lib/lostark/marketApi.js`
  - Remove direct Lostark POST helper and accept the shared client through `getMarketSnapshot({ client, forceRefresh })`.
- Modify: `app/api/characters/[name]/route.js`
  - Remove route-local authorization/fetch helpers and call the shared client.
  - Convert client `NOT_FOUND` errors to `null` for armory payloads.
  - Keep existing success DTO keys.
- Modify: `app/api/market/snapshot/route.js`
  - Remove route-local authorization helper and create the shared client from env.
- Create: `tests/apiRoutes.test.js`
  - Route-level error contract tests with fake `globalThis.fetch`.

## Environment Note

The current workspace has Node `v22.22.2` and npm `10.9.7`. `java` and `javac` are not installed, but no task in this plan uses Java or a JDK. Do not install JDK for this phase; add a separate environment plan if the backend stack later changes to Java or Spring.

---

### Task 1: Shared Lostark API Client

**Files:**
- Create: `tests/lostarkApiClient.test.js`
- Create: `lib/lostark/apiClient.js`

- [ ] **Step 1: Write the failing client tests**

Create `tests/lostarkApiClient.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  LOSTARK_API_ERROR_CODES,
  LostarkApiError,
  createLostarkApiClient,
  getLostarkAuthorizationFromEnv
} from "../lib/lostark/apiClient.js";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}

function textResponse(body, status) {
  return new Response(body, { status });
}

async function withEnv(values, fn) {
  const previousApiKey = process.env.LOSTARK_API_KEY;
  const previousOpenApiKey = process.env.LOSTARK_OPEN_API_KEY;

  delete process.env.LOSTARK_API_KEY;
  delete process.env.LOSTARK_OPEN_API_KEY;

  Object.assign(process.env, values);

  try {
    await fn();
  } finally {
    if (previousApiKey === undefined) {
      delete process.env.LOSTARK_API_KEY;
    } else {
      process.env.LOSTARK_API_KEY = previousApiKey;
    }

    if (previousOpenApiKey === undefined) {
      delete process.env.LOSTARK_OPEN_API_KEY;
    } else {
      process.env.LOSTARK_OPEN_API_KEY = previousOpenApiKey;
    }
  }
}

test("returns null when no Lostark API token exists", async () => {
  await withEnv({}, async () => {
    assert.equal(getLostarkAuthorizationFromEnv(), null);
  });
});

test("prefers LOSTARK_API_KEY over LOSTARK_OPEN_API_KEY", async () => {
  await withEnv(
    {
      LOSTARK_API_KEY: "primary-token",
      LOSTARK_OPEN_API_KEY: "fallback-token"
    },
    async () => {
      assert.equal(getLostarkAuthorizationFromEnv(), "bearer primary-token");
    }
  );
});

test("preserves an existing bearer prefix", async () => {
  await withEnv({ LOSTARK_API_KEY: "Bearer existing-token" }, async () => {
    assert.equal(getLostarkAuthorizationFromEnv(), "Bearer existing-token");
  });
});

test("prefixes raw tokens with bearer", async () => {
  await withEnv({ LOSTARK_OPEN_API_KEY: "  raw-token  " }, async () => {
    assert.equal(getLostarkAuthorizationFromEnv(), "bearer raw-token");
  });
});

test("client.get sends expected Lostark request options", async () => {
  const calls = [];
  const client = createLostarkApiClient({
    authorization: "bearer test-token",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return jsonResponse({ ok: true });
    }
  });

  assert.deepEqual(await client.get("/armories/characters/test/profiles"), { ok: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://developer-lostark.game.onstove.com/armories/characters/test/profiles");
  assert.equal(calls[0].options.method, "GET");
  assert.equal(calls[0].options.cache, "no-store");
  assert.equal(calls[0].options.headers.accept, "application/json");
  assert.equal(calls[0].options.headers.authorization, "bearer test-token");
});

test("client.post sends JSON body and content type", async () => {
  const calls = [];
  const client = createLostarkApiClient({
    authorization: "bearer test-token",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return jsonResponse({ ok: true });
    }
  });

  assert.deepEqual(await client.post("/markets/items", { PageNo: 1 }), { ok: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers["content-type"], "application/json");
  assert.equal(calls[0].options.body, JSON.stringify({ PageNo: 1 }));
});

test("404 maps to NOT_FOUND without retry", async () => {
  let callCount = 0;
  const client = createLostarkApiClient({
    authorization: "bearer test-token",
    fetchImpl: async () => {
      callCount += 1;
      return textResponse("missing", 404);
    }
  });

  await assert.rejects(() => client.get("/missing"), (error) => {
    assert.ok(error instanceof LostarkApiError);
    assert.equal(error.code, LOSTARK_API_ERROR_CODES.NOT_FOUND);
    assert.equal(error.status, 404);
    return true;
  });
  assert.equal(callCount, 1);
});

test("500 retries once and can succeed on second attempt", async () => {
  let callCount = 0;
  const client = createLostarkApiClient({
    authorization: "bearer test-token",
    fetchImpl: async () => {
      callCount += 1;
      return callCount === 1 ? textResponse("temporary", 500) : jsonResponse({ ok: true });
    }
  });

  assert.deepEqual(await client.get("/unstable"), { ok: true });
  assert.equal(callCount, 2);
});

test("429 retries once and can succeed on second attempt", async () => {
  let callCount = 0;
  const client = createLostarkApiClient({
    authorization: "bearer test-token",
    fetchImpl: async () => {
      callCount += 1;
      return callCount === 1 ? textResponse("rate limited", 429) : jsonResponse({ ok: true });
    }
  });

  assert.deepEqual(await client.get("/rate-limited"), { ok: true });
  assert.equal(callCount, 2);
});

test("400 maps to BAD_REQUEST without retry", async () => {
  let callCount = 0;
  const client = createLostarkApiClient({
    authorization: "bearer test-token",
    fetchImpl: async () => {
      callCount += 1;
      return textResponse("bad request", 400);
    }
  });

  await assert.rejects(() => client.get("/bad-request"), (error) => {
    assert.ok(error instanceof LostarkApiError);
    assert.equal(error.code, LOSTARK_API_ERROR_CODES.BAD_REQUEST);
    assert.equal(error.status, 400);
    return true;
  });
  assert.equal(callCount, 1);
});

test("fetch rejection retries once and then maps to NETWORK_ERROR", async () => {
  let callCount = 0;
  const client = createLostarkApiClient({
    authorization: "bearer test-token",
    fetchImpl: async () => {
      callCount += 1;
      throw new TypeError("network failed");
    }
  });

  await assert.rejects(() => client.get("/network-failure"), (error) => {
    assert.ok(error instanceof LostarkApiError);
    assert.equal(error.code, LOSTARK_API_ERROR_CODES.NETWORK_ERROR);
    return true;
  });
  assert.equal(callCount, 2);
});

test("timeout maps to TIMEOUT", async () => {
  const client = createLostarkApiClient({
    authorization: "bearer test-token",
    timeoutMs: 10,
    retryCount: 0,
    fetchImpl: async (_url, options) =>
      new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      })
  });

  await assert.rejects(() => client.get("/slow"), (error) => {
    assert.ok(error instanceof LostarkApiError);
    assert.equal(error.code, LOSTARK_API_ERROR_CODES.TIMEOUT);
    return true;
  });
});
```

- [ ] **Step 2: Run the new client tests to verify they fail**

Run:

```bash
node --test tests/lostarkApiClient.test.js
```

Expected: FAIL with a module-not-found error for `../lib/lostark/apiClient.js`.

- [ ] **Step 3: Implement the shared API client**

Create `lib/lostark/apiClient.js`:

```js
const LOSTARK_API_BASE_URL = "https://developer-lostark.game.onstove.com";
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_RETRY_COUNT = 1;

export const LOSTARK_API_ERROR_CODES = Object.freeze({
  BAD_REQUEST: "BAD_REQUEST",
  AUTH_ERROR: "AUTH_ERROR",
  NOT_FOUND: "NOT_FOUND",
  RATE_LIMITED: "RATE_LIMITED",
  UPSTREAM_ERROR: "UPSTREAM_ERROR",
  TIMEOUT: "TIMEOUT",
  NETWORK_ERROR: "NETWORK_ERROR"
});

export class LostarkApiError extends Error {
  constructor(code, message, { status = null, responseText = "", cause = null } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = "LostarkApiError";
    this.code = code;
    this.status = status;
    this.responseText = responseText;
  }
}

function normalizeAuthorization(token) {
  if (!token) {
    return null;
  }

  const normalizedToken = token.trim();

  if (!normalizedToken) {
    return null;
  }

  if (normalizedToken.toLowerCase().startsWith("bearer ")) {
    return normalizedToken;
  }

  return `bearer ${normalizedToken}`;
}

export function getLostarkAuthorizationFromEnv(env = process.env) {
  return normalizeAuthorization(env.LOSTARK_API_KEY || env.LOSTARK_OPEN_API_KEY);
}

function getErrorCodeForStatus(status) {
  if (status === 400) {
    return LOSTARK_API_ERROR_CODES.BAD_REQUEST;
  }

  if (status === 401 || status === 403) {
    return LOSTARK_API_ERROR_CODES.AUTH_ERROR;
  }

  if (status === 404) {
    return LOSTARK_API_ERROR_CODES.NOT_FOUND;
  }

  if (status === 429) {
    return LOSTARK_API_ERROR_CODES.RATE_LIMITED;
  }

  return LOSTARK_API_ERROR_CODES.UPSTREAM_ERROR;
}

function isRetryableCode(code) {
  return (
    code === LOSTARK_API_ERROR_CODES.RATE_LIMITED ||
    code === LOSTARK_API_ERROR_CODES.UPSTREAM_ERROR ||
    code === LOSTARK_API_ERROR_CODES.TIMEOUT ||
    code === LOSTARK_API_ERROR_CODES.NETWORK_ERROR
  );
}

function isAbortError(error) {
  return error?.name === "AbortError";
}

async function readErrorText(response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function createTimeoutController(timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  timeoutId.unref?.();

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeoutId)
  };
}

export function createLostarkApiClient({
  authorization,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  retryCount = DEFAULT_RETRY_COUNT,
  baseUrl = LOSTARK_API_BASE_URL
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new TypeError("createLostarkApiClient requires a fetch implementation.");
  }

  async function request(method, path, body) {
    let lastError = null;

    for (let attempt = 0; attempt <= retryCount; attempt += 1) {
      const timeout = createTimeoutController(timeoutMs);

      try {
        const headers = {
          accept: "application/json",
          authorization
        };

        if (method === "POST") {
          headers["content-type"] = "application/json";
        }

        const response = await fetchImpl(`${baseUrl}${path}`, {
          method,
          cache: "no-store",
          headers,
          signal: timeout.signal,
          ...(method === "POST" ? { body: JSON.stringify(body) } : {})
        });

        timeout.clear();

        if (!response.ok) {
          const code = getErrorCodeForStatus(response.status);
          const responseText = await readErrorText(response);
          const error = new LostarkApiError(code, `Lostark Open API ${response.status}: ${responseText.slice(0, 180)}`, {
            status: response.status,
            responseText
          });

          if (attempt < retryCount && isRetryableCode(code)) {
            lastError = error;
            continue;
          }

          throw error;
        }

        return response.json();
      } catch (error) {
        timeout.clear();

        if (error instanceof LostarkApiError) {
          if (attempt < retryCount && isRetryableCode(error.code)) {
            lastError = error;
            continue;
          }

          throw error;
        }

        const code = isAbortError(error) ? LOSTARK_API_ERROR_CODES.TIMEOUT : LOSTARK_API_ERROR_CODES.NETWORK_ERROR;
        const mappedError = new LostarkApiError(code, `Lostark Open API request failed: ${error.message}`, { cause: error });

        if (attempt < retryCount && isRetryableCode(code)) {
          lastError = mappedError;
          continue;
        }

        throw mappedError;
      }
    }

    throw lastError;
  }

  return {
    get: (path) => request("GET", path),
    post: (path, body) => request("POST", path, body)
  };
}
```

- [ ] **Step 4: Run the client tests to verify they pass**

Run:

```bash
node --test tests/lostarkApiClient.test.js
```

Expected: PASS for all tests in `tests/lostarkApiClient.test.js`.

- [ ] **Step 5: Commit the shared client**

Run:

```bash
git add lib/lostark/apiClient.js tests/lostarkApiClient.test.js
git commit -m "feat: add lostark api client"
```

Expected: one commit containing only the shared client and its tests.

---

### Task 2: Market Snapshot Client Injection

**Files:**
- Modify: `lib/lostark/marketApi.js`

- [ ] **Step 1: Update `marketApi.js` to use the shared client**

Replace the full contents of `lib/lostark/marketApi.js` with:

```js
import { buildMarketSnapshot, MARKET_SNAPSHOT_CACHE_TTL_MS, MARKET_SNAPSHOT_QUERIES } from "./marketSnapshot.js";

const snapshotCache = globalThis.__sgguMarketSnapshotCache || {
  value: null,
  expiresAt: 0,
  pending: null
};

globalThis.__sgguMarketSnapshotCache = snapshotCache;

function stripRequestMetadata(request) {
  const { CategoryName: _categoryName, ...body } = request;
  return body;
}

async function fetchMarketSnapshot(client) {
  const groups = await Promise.all(
    MARKET_SNAPSHOT_QUERIES.map(async (group) => {
      const responses = await Promise.all(
        group.requests.map(async (request) => ({
          request,
          response: await client.post(group.endpoint, stripRequestMetadata(request))
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

export async function getMarketSnapshot({ client, forceRefresh = false } = {}) {
  if (!client) {
    throw new TypeError("getMarketSnapshot requires a Lostark API client.");
  }

  const now = Date.now();

  if (!forceRefresh && snapshotCache.value && snapshotCache.expiresAt > now) {
    return {
      ...snapshotCache.value,
      cached: true,
      cacheExpiresAt: new Date(snapshotCache.expiresAt).toISOString()
    };
  }

  if (!snapshotCache.pending) {
    snapshotCache.pending = fetchMarketSnapshot(client)
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
```

- [ ] **Step 2: Run existing market snapshot tests**

Run:

```bash
node --test tests/marketSnapshot.test.js
```

Expected: PASS. This test imports `buildMarketSnapshot`, so it should stay unaffected by the `marketApi.js` transport change.

- [ ] **Step 3: Commit the market client injection**

Run:

```bash
git add lib/lostark/marketApi.js
git commit -m "refactor: inject lostark client into market snapshots"
```

Expected: one commit containing only `lib/lostark/marketApi.js`.

---

### Task 3: Route Refactor

**Files:**
- Modify: `app/api/characters/[name]/route.js`
- Modify: `app/api/market/snapshot/route.js`

- [ ] **Step 1: Refactor the character route to use the shared client**

In `app/api/characters/[name]/route.js`, remove `LOSTARK_API_BASE_URL`, `getAuthorizationHeader`, and `fetchLostark`. Add this import:

```js
import {
  LOSTARK_API_ERROR_CODES as LOSTARK_CLIENT_ERROR_CODES,
  LostarkApiError,
  createLostarkApiClient,
  getLostarkAuthorizationFromEnv
} from "../../../../lib/lostark/apiClient.js";
```

Add this helper below `ERROR_CODES`:

```js
async function fetchArmoryOrNull(client, path) {
  try {
    return await client.get(path);
  } catch (error) {
    if (error instanceof LostarkApiError && error.code === LOSTARK_CLIENT_ERROR_CODES.NOT_FOUND) {
      return null;
    }

    throw error;
  }
}
```

Replace the authorization and fetch setup inside `GET` with:

```js
  const authorization = getLostarkAuthorizationFromEnv();

  if (!characterName) {
    return NextResponse.json(
      {
        code: ERROR_CODES.INVALID_CHARACTER_NAME,
        message: "조회할 캐릭터명을 입력해줘."
      },
      { status: 400 }
    );
  }

  if (!authorization) {
    return NextResponse.json(
      {
        code: ERROR_CODES.MISSING_API_KEY,
        message: "잠시 설정을 확인하고 있어요."
      },
      { status: 500 }
    );
  }

  const lostarkClient = createLostarkApiClient({ authorization });
```

Replace the parallel request block with:

```js
    const encodedName = encodeURIComponent(characterName);
    const marketSnapshotPromise = getMarketSnapshot({ client: lostarkClient }).catch((error) => {
      console.error(error);
      return null;
    });
    const [profile, equipment, avatars, arkPassive, arkGrid, cards, skills, engravings, gems, marketSnapshot] = await Promise.all([
      fetchArmoryOrNull(lostarkClient, `/armories/characters/${encodedName}/profiles`),
      fetchArmoryOrNull(lostarkClient, `/armories/characters/${encodedName}/equipment`),
      fetchArmoryOrNull(lostarkClient, `/armories/characters/${encodedName}/avatars`),
      fetchArmoryOrNull(lostarkClient, `/armories/characters/${encodedName}/arkpassive`),
      fetchArmoryOrNull(lostarkClient, `/armories/characters/${encodedName}/arkgrid`),
      fetchArmoryOrNull(lostarkClient, `/armories/characters/${encodedName}/cards`),
      fetchArmoryOrNull(lostarkClient, `/armories/characters/${encodedName}/combat-skills`),
      fetchArmoryOrNull(lostarkClient, `/armories/characters/${encodedName}/engravings`),
      fetchArmoryOrNull(lostarkClient, `/armories/characters/${encodedName}/gems`),
      marketSnapshotPromise
    ]);
```

Replace the character-not-found message with:

```js
        message: "없는 캐릭터입니다."
```

Replace the catch response message with:

```js
        message: "지금은 캐릭터 정보를 불러오지 못했어요. 잠시 후 다시 조회해줘."
```

- [ ] **Step 2: Refactor the market snapshot route to use the shared client**

Replace the full contents of `app/api/market/snapshot/route.js` with:

```js
import { NextResponse } from "next/server";
import { createLostarkApiClient, getLostarkAuthorizationFromEnv } from "../../../../lib/lostark/apiClient.js";
import { getMarketSnapshot } from "../../../../lib/lostark/marketApi.js";

export const runtime = "nodejs";

const ERROR_CODES = {
  MISSING_API_KEY: "MISSING_API_KEY",
  LOSTARK_API_ERROR: "LOSTARK_API_ERROR"
};

export async function GET(request) {
  const authorization = getLostarkAuthorizationFromEnv();
  const forceRefresh = new URL(request.url).searchParams.get("refresh") === "1";

  if (!authorization) {
    return NextResponse.json(
      {
        code: ERROR_CODES.MISSING_API_KEY,
        message: "잠시 설정을 확인하고 있어요."
      },
      { status: 500 }
    );
  }

  try {
    const lostarkClient = createLostarkApiClient({ authorization });
    return NextResponse.json(await getMarketSnapshot({ client: lostarkClient, forceRefresh }));
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
```

- [ ] **Step 3: Run the current test suite**

Run:

```bash
npm test
```

Expected: PASS for existing tests and `tests/lostarkApiClient.test.js`.

- [ ] **Step 4: Commit the route refactor**

Run:

```bash
git add app/api/characters/[name]/route.js app/api/market/snapshot/route.js
git commit -m "refactor: route lostark calls through api client"
```

Expected: one commit containing only the two route files.

---

### Task 4: Route Error Contract Tests

**Files:**
- Create: `tests/apiRoutes.test.js`

- [ ] **Step 1: Write route error contract tests**

Create `tests/apiRoutes.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { GET as characterGET } from "../app/api/characters/[name]/route.js";
import { GET as marketSnapshotGET } from "../app/api/market/snapshot/route.js";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}

function textResponse(body, status) {
  return new Response(body, { status });
}

async function responseJson(response) {
  return response.json();
}

async function withEnv(values, fn) {
  const previousApiKey = process.env.LOSTARK_API_KEY;
  const previousOpenApiKey = process.env.LOSTARK_OPEN_API_KEY;

  delete process.env.LOSTARK_API_KEY;
  delete process.env.LOSTARK_OPEN_API_KEY;
  Object.assign(process.env, values);

  try {
    await fn();
  } finally {
    if (previousApiKey === undefined) {
      delete process.env.LOSTARK_API_KEY;
    } else {
      process.env.LOSTARK_API_KEY = previousApiKey;
    }

    if (previousOpenApiKey === undefined) {
      delete process.env.LOSTARK_OPEN_API_KEY;
    } else {
      process.env.LOSTARK_OPEN_API_KEY = previousOpenApiKey;
    }
  }
}

async function withFetch(fetchImpl, fn) {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl;

  try {
    await fn();
  } finally {
    globalThis.fetch = previousFetch;
  }
}

test("character route rejects an empty character name", async () => {
  const response = await characterGET(new Request("http://localhost/api/characters/%20"), {
    params: { name: "%20" }
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await responseJson(response), {
    code: "INVALID_CHARACTER_NAME",
    message: "조회할 캐릭터명을 입력해줘."
  });
});

test("character route hides missing API key details", async () => {
  await withEnv({}, async () => {
    const response = await characterGET(new Request("http://localhost/api/characters/test"), {
      params: { name: "test" }
    });

    assert.equal(response.status, 500);
    assert.deepEqual(await responseJson(response), {
      code: "MISSING_API_KEY",
      message: "잠시 설정을 확인하고 있어요."
    });
  });
});

test("character route maps profile not found to 없는 캐릭터입니다", async () => {
  await withEnv({ LOSTARK_API_KEY: "test-token" }, async () => {
    await withFetch(async (url) => {
      if (String(url).includes("/markets/") || String(url).includes("/auctions/")) {
        return textResponse("market unavailable", 500);
      }

      return textResponse("missing", 404);
    }, async () => {
      const response = await characterGET(new Request("http://localhost/api/characters/missing"), {
        params: { name: "missing" }
      });

      assert.equal(response.status, 404);
      assert.deepEqual(await responseJson(response), {
        code: "CHARACTER_NOT_FOUND",
        message: "없는 캐릭터입니다."
      });
    });
  });
});

test("character route maps non-market upstream failure to lookup failure", async () => {
  await withEnv({ LOSTARK_API_KEY: "test-token" }, async () => {
    await withFetch(async (url) => {
      const urlText = String(url);

      if (urlText.includes("/profiles")) {
        return jsonResponse({
          CharacterName: "테스트",
          CharacterClassName: "블래스터",
          CombatPower: "0",
          Stats: []
        });
      }

      if (urlText.includes("/equipment")) {
        return textResponse("upstream failed", 500);
      }

      if (urlText.includes("/markets/") || urlText.includes("/auctions/")) {
        return textResponse("market unavailable", 500);
      }

      return jsonResponse([]);
    }, async () => {
      const response = await characterGET(new Request("http://localhost/api/characters/test"), {
        params: { name: "test" }
      });

      assert.equal(response.status, 502);
      assert.deepEqual(await responseJson(response), {
        code: "LOSTARK_API_ERROR",
        message: "지금은 캐릭터 정보를 불러오지 못했어요. 잠시 후 다시 조회해줘."
      });
    });
  });
});

test("market snapshot route hides missing API key details", async () => {
  await withEnv({}, async () => {
    const response = await marketSnapshotGET(new Request("http://localhost/api/market/snapshot"));

    assert.equal(response.status, 500);
    assert.deepEqual(await responseJson(response), {
      code: "MISSING_API_KEY",
      message: "잠시 설정을 확인하고 있어요."
    });
  });
});
```

- [ ] **Step 2: Run the route tests**

Run:

```bash
node --test tests/apiRoutes.test.js
```

Expected: PASS for all route error contract tests.

- [ ] **Step 3: Commit the route tests**

Run:

```bash
git add tests/apiRoutes.test.js
git commit -m "test: cover api route error contracts"
```

Expected: one commit containing only `tests/apiRoutes.test.js`.

---

### Task 5: Full Verification

**Files:**
- Modify only files already changed by Tasks 1-4 if verification exposes defects.

- [ ] **Step 1: Run all tests**

Run:

```bash
npm test
```

Expected: PASS for all `node:test` files.

- [ ] **Step 2: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS with no ESLint errors.

- [ ] **Step 3: Run production build**

Run:

```bash
npm run build
```

Expected: PASS with a successful Next.js build.

- [ ] **Step 4: Check the diff**

Run:

```bash
git diff --check
```

Expected: no whitespace errors.

- [ ] **Step 5: Inspect final status**

Run:

```bash
git status --short
```

Expected: no unstaged changes in files touched by this plan. Existing unrelated untracked plugin or skill directories may remain untracked.

