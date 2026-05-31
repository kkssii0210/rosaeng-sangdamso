# Spring API Ownership Completion Design

Date: 2026-05-31

## Decision

Spring Boot will become the sole runtime owner for browser-facing API behavior. Next.js will keep rendering the UI and will proxy migrated `/api/*` paths to Spring Boot in local development.

This step finishes the first portfolio-facing backend ownership milestone:

- `GET /api/efficiency/spec-up/{name}` stays Spring-owned.
- `POST /api/efficiency/accessories/recovery` moves from Next.js to Spring Boot.
- Remaining Next.js efficiency API route files are removed after Spring contract tests pass.
- README, ownership docs, and local proxy defaults are updated to match the actual runtime boundary.

## Goals

- Make Spring Boot own all active API endpoints used by the app.
- Remove stale or duplicate Next.js API route implementations.
- Preserve the existing frontend request paths and response contracts.
- Port accessory recovery estimation from JavaScript to Java.
- Keep spec-up recommendation behavior unchanged.
- Add contract and parity tests that show the Spring responses match the existing UI needs.
- Make the repository read clearly as a full-stack portfolio project with a real backend boundary.

## Non-Goals

- Add Postgres, Redis, Docker Compose, CI/CD, or observability in this step.
- Redesign the efficiency page UI.
- Change recommendation formulas or scoring rules.
- Change browser-facing API paths.
- Add account login, saved characters, or user-specific persistence.

## Current State

Spring Boot already contains:

- `GET /api/characters/{name}`
- `GET /api/market/snapshot`
- `POST /api/consult/sggu`
- `GET /api/efficiency/spec-up/{name}`
- Java services for accessory auction search, accessory normalization, accessory efficiency, upgrade efficiency, and spec-up candidate merging.

Next.js still contains:

- `app/api/efficiency/accessories/[name]/route.js`
- `app/api/efficiency/accessories/recovery/route.js`

The ownership document says `/api/efficiency/spec-up/{name}` is Spring-owned and the Next route is removed, but a stale Next route file still exists under `/api/efficiency/accessories/[name]`. The README proxy examples also omit some migrated paths.

## Target API Ownership

| Browser Path | Owner | Notes |
| --- | --- | --- |
| `GET /api/characters/{name}` | Spring Boot | Character armory BFF |
| `GET /api/market/snapshot` | Spring Boot | Market snapshot |
| `POST /api/consult/sggu` | Spring Boot | Local LLM consultation |
| `GET /api/efficiency/spec-up/{name}` | Spring Boot | Integrated spec-up recommendation |
| `POST /api/efficiency/accessories/recovery` | Spring Boot | Current accessory recovery estimate |

Next.js owns no API routes after this step.

## Runtime Boundary

The frontend continues to call same-origin browser paths:

```text
Next.js UI
  -> /api/characters/{name}
  -> /api/efficiency/spec-up/{name}
  -> /api/efficiency/accessories/recovery
  -> /api/market/snapshot
  -> /api/consult/sggu
```

In local development, `next.config.mjs` rewrites those paths to the Spring backend. The default `SPRING_API_PATHS` behavior should include all migrated paths so the portfolio demo does not require remembering a long environment variable. `SPRING_API_PATHS` can still override the defaults when needed.

## Accessory Recovery Endpoint

### Controller

Add `AccessoryRecoveryController` under `com.rosaeng.sangdamso.efficiency`.

Endpoint:

```text
POST /api/efficiency/accessories/recovery
```

Request contract stays compatible with the current UI:

```json
{
  "CurrentAccessory": {},
  "Recommendation": {
    "BuyPrice": 100000,
    "CombatPowerGainPercent": 1.23
  },
  "ForceRefresh": false
}
```

Response contract stays compatible:

```json
{
  "UpdatedAt": "2026-05-31T00:00:00Z",
  "SearchSummary": {
    "Type": "목걸이",
    "SearchOptions": ["추가 피해 1.50% 이상"],
    "CandidateCount": 30,
    "PagesFetched": 3
  },
  "RecoveryEstimate": {
    "Status": "ready",
    "Confidence": "high",
    "EvidenceCount": 3,
    "EstimatedRecoveryGold": 50000,
    "NetCostGold": 50000,
    "NetGoldPerOnePercentCombatPower": 40650
  }
}
```

### Validation

The controller rejects invalid requests with the existing error contract:

- Unsupported or missing `CurrentAccessory.Type`: `INVALID_RECOVERY_REQUEST`, HTTP 400.
- Missing or non-positive `Recommendation.BuyPrice`: `INVALID_RECOVERY_REQUEST`, HTTP 400.
- Missing or non-positive `Recommendation.CombatPowerGainPercent`: `INVALID_RECOVERY_REQUEST`, HTTP 400.
- Missing Lostark API key from `LostarkApiClient`: `MISSING_API_KEY`, HTTP 500.
- Lostark auction upstream failures: `LOSTARK_API_ERROR`, HTTP 502.

Supported recovery accessory types are `목걸이`, `귀걸이`, and `반지`.

## Accessory Recovery Service

Add `AccessoryRecoveryEstimateService` and port the JavaScript recovery algorithm.

Rules:

- Build a fingerprint for the current accessory.
- Build fingerprints for auction candidates.
- Keep only exact fingerprint matches.
- Extract positive `BuyPrice` values.
- Sort prices ascending.
- Calculate median, first quartile, third quartile, and interquartile range.
- Return low confidence when fewer than 3 matching prices exist.
- Return low confidence when `InterquartileRange / MedianPrice > 0.35`.
- Return high confidence when evidence count and spread are stable.
- Estimate recovery gold as rounded median price.
- Calculate `NetCostGold = max(0, recommendation buy price - estimated recovery gold)`.
- Calculate `NetGoldPerOnePercentCombatPower = round(NetCostGold / CombatPowerGainPercent)`.

Low confidence response shape:

```json
{
  "Status": "lowConfidence",
  "Confidence": "low",
  "EvidenceCount": 1,
  "EstimatedRecoveryGold": 50000,
  "NetCostGold": null,
  "NetGoldPerOnePercentCombatPower": null
}
```

## Accessory Search Changes

`AccessoryAuctionSearchService` currently filters eligible candidates for spec-up recommendation. Recovery estimation needs broader auction evidence, including candidates that would not be recommended as upgrades.

Add an `eligibleOnly` option:

- `eligibleOnly=true` for spec-up recommendation.
- `eligibleOnly=false` for recovery estimation.

Recovery search should keep the same page limits and request body as current search:

- Tier 4.
- Grade `고대`.
- Sort by immediate buy price ascending.
- Minimum 3 pages per type.
- Maximum 10 pages per type.
- Maximum 100 candidates per type.
- Same refinement search options from the current accessory.

## Fingerprint Parity

`AccessoryNormalizer.fingerprint` should match JavaScript recovery behavior:

- Include accessory type.
- Include name.
- Include quality.
- Include main stat value.
- Include enlightenment point.
- Include refinement lines.

If `MainStatValue` or `EnlightenmentPoint` is absent, the normalizer should derive them from `DetailSections`:

- `기본 효과` first line, e.g. `힘 +12000`.
- `아크 패시브 포인트 효과` first line, e.g. `깨달음 +13`.

This keeps current equipped accessory objects and auction candidate objects comparable.

## Route Removal

After Spring tests pass:

- Delete `app/api/efficiency/accessories/[name]/route.js`.
- Delete `app/api/efficiency/accessories/recovery/route.js`.
- Remove or replace tests that import those route files directly.

The UI remains unchanged because it calls same-origin paths and Next rewrites the paths to Spring.

## Documentation Updates

Update `docs/backend-api-ownership.md`:

- Mark all listed API paths as Spring Boot active owner.
- Note that Next.js owns no API route files.
- Keep the rule that one path has one active owner.

Update `README.md`:

- Replace outdated architecture wording.
- List all migrated browser API paths.
- Show local backend/frontend commands with default Spring proxy behavior.
- State that Next.js renders UI and Spring Boot owns API behavior.

Update `next.config.mjs`:

- Add default migrated API paths.
- Keep `SPRING_API_PATHS` as an override.

## Testing Strategy

Backend unit tests:

- `AccessoryRecoveryEstimateServiceTest`
  - high confidence exact-match estimate,
  - low confidence with insufficient evidence,
  - low confidence with wide price spread,
  - percentile interpolation.
- `AccessoryNormalizerTest`
  - fingerprint derives missing main stat and enlightenment point from detail sections.
- `AccessoryAuctionSearchServiceTest`
  - default spec-up search filters eligible candidates,
  - recovery search with `eligibleOnly=false` keeps auction evidence that fails eligibility.

Backend controller tests:

- `AccessoryRecoveryControllerTest`
  - rejects invalid request with `INVALID_RECOVERY_REQUEST`,
  - returns recovery estimate for a valid request,
  - maps missing API key to `MISSING_API_KEY`,
  - maps upstream auction error to `LOSTARK_API_ERROR`.

Frontend tests:

- Remove the stale Next route import test.
- Keep UI tests focused on request paths and rendering behavior if needed.

Verification commands:

```bash
cd backend && ./mvnw test
npm test
npm run lint
npm run build
git diff --check
```

## Rollout

1. Add recovery service tests and controller tests.
2. Port recovery estimation to Java.
3. Extend auction search with `eligibleOnly`.
4. Add Spring recovery controller.
5. Delete remaining Next.js API route files.
6. Update docs and proxy defaults.
7. Run full backend and frontend verification.

## Risks

- Recovery estimates can change if fingerprint parity differs from JavaScript. Mitigation: test detail-section fallback and exact match behavior.
- Deleting Next route files can break local development if rewrites are not configured. Mitigation: default migrated paths in `next.config.mjs`.
- Auction failures should not affect spec-up endpoint unless spec-up search itself fails. Mitigation: keep recovery endpoint separate and preserve existing spec-up unavailable behavior.

## Portfolio Value

This milestone gives the project a clear story:

- Next.js is the frontend.
- Spring Boot is the backend API and domain engine.
- External API integration is centralized.
- Route ownership is documented and enforced by deleting replaced implementations.
- Complex formula and market logic has Java service tests.
