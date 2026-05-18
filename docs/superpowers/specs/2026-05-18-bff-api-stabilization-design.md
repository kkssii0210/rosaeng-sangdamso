# BFF API Stabilization Design

Date: 2026-05-18

## Goal

Stabilize the current backend boundary without changing the visible character-analysis response shape.

The first backend phase focuses on the BFF/API layer that calls Lostark Open API. It separates external API calling concerns from route handlers, adds predictable timeout and retry behavior, and keeps user-facing error messages simple.

## Current State

The app uses Next.js API Routes as a lightweight BFF.

- `app/api/characters/[name]/route.js` validates the character name, builds the Lostark authorization header, calls several Lostark armory endpoints, normalizes data, runs spec analysis, and returns the UI DTO.
- `app/api/market/snapshot/route.js` repeats authorization header handling and calls `getMarketSnapshot`.
- `lib/lostark/marketApi.js` owns an in-memory market snapshot cache and performs POST requests directly to Lostark market and auction endpoints.
- Domain normalization and calculation already live in focused modules under `lib/lostark/*` and `lib/spec/*`.

This works, but authorization, fetch behavior, timeout policy, retry policy, and upstream error mapping are split across route files and market code.

## Scope

This phase includes:

- Create a shared Lostark API client module.
- Move Lostark base URL, authorization header normalization, GET requests, POST requests, timeout, retry, and upstream error mapping into that module.
- Update character and market API routes to use the shared client behavior.
- Preserve the existing `/api/characters/{name}` success response DTO.
- Preserve the existing market snapshot in-memory cache behavior.
- Add focused `node:test` coverage for client behavior and route-facing error contracts.
- Keep the current UI behavior compatible with existing components.

This phase excludes:

- Redis, Postgres, persistent lookup history, or durable market snapshot storage.
- Local LLM/Ollama consultation APIs.
- Service-layer decomposition beyond what is needed to isolate Lostark API calls.
- Changes to combat-power, accessory, engraving, gem, card, avatar, or upgrade-efficiency formulas.
- Frontend redesign.

## Architecture

Add `lib/lostark/apiClient.js` as the single module responsible for Lostark Open API transport behavior.

The module exposes:

- `LOSTARK_API_ERROR_CODES`
- `LostarkApiError`
- `getLostarkAuthorizationFromEnv()`
- `createLostarkApiClient({ authorization, fetchImpl, timeoutMs, retryCount })`
- `client.get(path)`
- `client.post(path, body)`

Route handlers remain responsible for BFF-level behavior:

- Validate request input.
- Convert missing configuration and upstream failures into BFF JSON responses.
- Call domain normalization and analysis modules.
- Assemble the existing DTO.

`lib/lostark/marketApi.js` remains responsible for market snapshot query grouping, normalization, and in-memory cache. Its direct POST helper should be removed. `getMarketSnapshot` should receive the shared Lostark API client and call `client.post(...)` for market and auction requests.

## Request Policy

Default Lostark request policy:

- Timeout: 5 seconds per upstream request.
- Retry count: 1 retry after the first failed attempt.
- Retryable failures: network errors, timeout, HTTP `429`, and HTTP `5xx`.
- Non-retryable failures: HTTP `400`, `401`, `403`, and `404`.
- Request cache mode remains `no-store`.
- Headers include `accept: application/json`, normalized `authorization`, and `content-type: application/json` for POST.

Authorization behavior:

- Read `LOSTARK_API_KEY` first.
- Fall back to `LOSTARK_OPEN_API_KEY`.
- Trim whitespace.
- Preserve tokens that already start with `Bearer ` or `bearer `.
- Prefix other tokens as `bearer ${token}`.
- Return `null` if no usable token exists.

## Error Codes

The shared client maps upstream failures to internal codes:

- `BAD_REQUEST`: Lostark returned HTTP `400`.
- `AUTH_ERROR`: Lostark returned HTTP `401` or `403`.
- `NOT_FOUND`: Lostark returned HTTP `404`.
- `RATE_LIMITED`: Lostark returned HTTP `429` after retry attempts are exhausted.
- `UPSTREAM_ERROR`: Lostark returned HTTP `5xx` after retry attempts are exhausted.
- `TIMEOUT`: the request exceeded the timeout after retry attempts are exhausted.
- `NETWORK_ERROR`: fetch threw for a non-timeout network failure after retry attempts are exhausted.

The BFF response codes stay route-oriented:

- `INVALID_CHARACTER_NAME`
- `MISSING_API_KEY`
- `CHARACTER_NOT_FOUND`
- `LOSTARK_API_ERROR`

## Character API Flow

`GET /api/characters/{name}` should behave as follows:

1. Decode and trim the character name.
2. If empty, return HTTP `400`:

```json
{
  "code": "INVALID_CHARACTER_NAME",
  "message": "조회할 캐릭터명을 입력해줘."
}
```

3. Build a Lostark API client from environment authorization.
4. If authorization is missing, return HTTP `500`:

```json
{
  "code": "MISSING_API_KEY",
  "message": "잠시 설정을 확인하고 있어요."
}
```

5. Fetch the current armory endpoints in parallel:
   - `/armories/characters/{encodedName}/profiles`
   - `/armories/characters/{encodedName}/equipment`
   - `/armories/characters/{encodedName}/avatars`
   - `/armories/characters/{encodedName}/arkpassive`
   - `/armories/characters/{encodedName}/arkgrid`
   - `/armories/characters/{encodedName}/cards`
   - `/armories/characters/{encodedName}/combat-skills`
   - `/armories/characters/{encodedName}/engravings`
   - `/armories/characters/{encodedName}/gems`

   Each armory fetch should convert client `NOT_FOUND` errors to `null`. This preserves the previous route behavior where missing armory payloads become empty normalized sections. The profile payload is the only required payload for a successful character lookup.

6. Start market snapshot loading in parallel.
7. If the normalized profile result is `null`, return HTTP `404`:

```json
{
  "code": "CHARACTER_NOT_FOUND",
  "message": "없는 캐릭터입니다."
}
```

8. If any non-market armory endpoint fails with timeout, network failure, rate limit exhaustion, auth failure, bad request, or upstream failure, return HTTP `502`:

```json
{
  "code": "LOSTARK_API_ERROR",
  "message": "지금은 캐릭터 정보를 불러오지 못했어요. 잠시 후 다시 조회해줘."
}
```

9. If market snapshot loading fails, log the error, use `marketSnapshot: null` for analysis input, and continue returning the character response.
10. Normalize equipment, avatars, cards, engravings, gems, and skills using existing modules.
11. Build class identity, critical stats, combat power, and upgrade efficiency using existing modules.
12. Return the same success DTO keys currently used by the UI:
    - `profile`
    - `equipment`
    - `paradiseOrb`
    - `avatars`
    - `arkPassive`
    - `arkGrid`
    - `cards`
    - `skills`
    - `engravings`
    - `gems`
    - `classIdentityEffects`
    - `criticalStats`
    - `combatPowerAnalysis`
    - `upgradeEfficiency`

## Market Snapshot API Flow

`GET /api/market/snapshot` should behave as follows:

1. Build a Lostark API client from environment authorization.
2. If authorization is missing, return HTTP `500`:

```json
{
  "code": "MISSING_API_KEY",
  "message": "잠시 설정을 확인하고 있어요."
}
```

3. Read `refresh=1` as the existing force-refresh flag.
4. Call `getMarketSnapshot({ client, forceRefresh })` using the shared Lostark API client behavior.
5. Preserve current cache semantics:
   - use the in-memory snapshot while it is fresh;
   - deduplicate concurrent refreshes with the existing pending promise;
   - return `cached` and `cacheExpiresAt`.
6. If snapshot loading fails after retry attempts, return HTTP `502`:

```json
{
  "code": "LOSTARK_API_ERROR",
  "message": "공식 Lostark 거래소/경매장 API 응답이 불안정해. 잠시 후 다시 조회해줘."
}
```

## Testing Strategy

Add `tests/lostarkApiClient.test.js` with fake `fetchImpl` functions so tests do not call the network.

Required coverage:

- `getLostarkAuthorizationFromEnv` returns `null` when both environment variables are missing.
- `getLostarkAuthorizationFromEnv` prefers `LOSTARK_API_KEY` over `LOSTARK_OPEN_API_KEY`.
- authorization normalization preserves an existing bearer prefix.
- authorization normalization prefixes raw tokens with `bearer `.
- `client.get` sends the expected method, URL, `accept`, `authorization`, and `cache: "no-store"`.
- `client.post` sends JSON body and `content-type: application/json`.
- HTTP `404` throws `LostarkApiError` with code `NOT_FOUND` and does not retry.
- HTTP `500` retries once and can succeed on the second attempt.
- HTTP `429` retries once and can succeed on the second attempt.
- HTTP `400` throws `BAD_REQUEST` and does not retry.
- fetch rejection retries once and then throws `NETWORK_ERROR` if it still fails.
- timeout throws `TIMEOUT`.

Add route-level tests that invoke exported route handlers with fake `globalThis.fetch` behavior and verify:

- empty character name returns `INVALID_CHARACTER_NAME` with `조회할 캐릭터명을 입력해줘.`
- missing API key returns `MISSING_API_KEY` with `잠시 설정을 확인하고 있어요.`
- profile `NOT_FOUND` maps to `CHARACTER_NOT_FOUND` with `없는 캐릭터입니다.`
- non-market upstream failure maps to `LOSTARK_API_ERROR` with `지금은 캐릭터 정보를 불러오지 못했어요. 잠시 후 다시 조회해줘.`
- market snapshot route missing API key returns `MISSING_API_KEY` with `잠시 설정을 확인하고 있어요.`

Preserve existing tests:

- `npm test`
- `npm run lint`
- `npm run build`

## Acceptance Criteria

The work is complete when:

- Route handlers no longer implement Lostark base URL, authorization normalization, or direct fetch retry behavior themselves.
- Lostark GET and POST calls share the same timeout, retry, and error mapping policy.
- `/api/characters/{name}` success responses keep the existing DTO keys.
- Missing character responses return `CHARACTER_NOT_FOUND` with `없는 캐릭터입니다.`
- Missing API key responses return `MISSING_API_KEY` with `잠시 설정을 확인하고 있어요.`
- Lostark upstream failures return `LOSTARK_API_ERROR` with `지금은 캐릭터 정보를 불러오지 못했어요. 잠시 후 다시 조회해줘.` for character lookup.
- Market snapshot failures do not block character lookup.
- New client tests pass without network access.
- Existing domain tests still pass.

## Open Questions

There are no open design questions for this phase. Cache persistence, lookup history, and local LLM consultation APIs are intentionally deferred to later backend phases.
