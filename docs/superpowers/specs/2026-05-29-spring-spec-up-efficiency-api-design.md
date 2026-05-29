# Spring Spec-Up Efficiency API Design

Date: 2026-05-29

## Decision

Spring Boot will own `GET /api/efficiency/spec-up/{name}`. The endpoint will replace the current Next.js API route for integrated spec-up recommendations and will return the same frontend-facing response shape.

This work includes Java ownership for accessory auction search, accessory replacement evaluation, upgrade-efficiency candidate reuse, and Top 5 recommendation merging. The existing JavaScript route remains the parity reference until Spring tests prove equivalent behavior.

## Goals

- Add Spring `GET /api/efficiency/spec-up/{name}` with the current response contract.
- Return a unified Top 5 across accessories, honing, gems, engraving books, and legendary avatars.
- Move accessory auction search and accessory replacement scoring from JavaScript runtime into Java.
- Reuse the existing Spring `UpgradeEfficiencyService` for non-accessory candidates.
- Keep `/efficiency` UI behavior stable by preserving response field names and error codes.
- Keep recommendation scoring consistent: `GainPercent / NetCostGold * 100000`.

## Non-Goals

- Move `/api/efficiency/accessories/recovery` in this step.
- Redesign the efficiency page UI.
- Add user accounts, saved budgets, or custom filters.
- Change Lostark formula rules beyond what is required for parity.
- Delete the JavaScript route before Spring ownership is active and verified.

## Current State

- Spring owns `/api/characters/{name}`, `/api/market/snapshot`, and `/api/consult/sggu`.
- Spring `UpgradeEfficiencyService` already returns market-backed honing, avatar, gem, and engraving-book candidates.
- Next.js still owns `/api/efficiency/spec-up/{name}`.
- The current Next.js spec-up route:
  - loads character efficiency context,
  - loads market snapshot,
  - searches accessory auction candidates,
  - searches engraving-book and legendary-avatar prices,
  - builds accessory efficiency recommendations,
  - builds upgrade-efficiency recommendations,
  - merges both into `Recommendation.TopCandidates`.
- `/efficiency` calls `/api/efficiency/spec-up/{name}` and renders the returned contract.

## Target Contract

The Spring endpoint returns:

```json
{
  "CharacterName": "붐버",
  "UpdatedAt": "2026-05-29T00:00:00Z",
  "MarketUpdatedAt": "2026-05-29T00:00:00Z",
  "AccessoryMarketUpdatedAt": "2026-05-29T00:00:00Z",
  "SearchSummary": [
    {
      "Type": "목걸이",
      "EquipmentIndex": 6,
      "SearchOptions": ["추가 피해 1.50% 이상"],
      "CandidateCount": 20,
      "PagesFetched": 3
    }
  ],
  "Recommendation": {
    "Status": "ready",
    "TopCandidates": [],
    "AccessoryRecommendation": {},
    "UpgradeEfficiency": {},
    "MissingInputs": []
  }
}
```

Top candidates keep the existing normalized candidate fields:

- `Id`
- `Type`
- `Label`
- `CostGold`
- `NetCostGold`
- `GainPercent`
- `GainType`
- `EfficiencyScore`
- `ScoreUnit`
- `Caveat`

Accessory candidates include `AccessoryComparison` so the existing panel can render current and candidate accessory details.

## Architecture

### `SpecUpEfficiencyController`

Owns the browser-facing endpoint:

- `GET /api/efficiency/spec-up/{name}`
- Validates blank names.
- Accepts `refresh=1` and forwards it to market and auction reads.
- Maps exceptions to the current error contract.

### `SpecUpEfficiencyService`

Orchestrates the full recommendation flow:

1. Load armory sections needed for spec-up evaluation.
2. Build the same context used by `UpgradeEfficiencyService`.
3. Load market snapshot.
4. Load relic engraving-book prices through `MarketSnapshotService`.
5. Search accessory auction candidates.
6. Build accessory recommendations.
7. Build upgrade-efficiency candidates.
8. Merge both candidate families into Top 5.

This service should not contain parsing or scoring internals. It coordinates smaller services and shapes the response.

### `AccessoryAuctionSearchService`

Ports the JavaScript accessory auction search behavior:

- Supported types: `목걸이`, `귀걸이`, `반지`.
- Categories:
  - `목걸이`: `200010`
  - `귀걸이`: `200020`
  - `반지`: `200030`
- Search only tier 4 ancient accessories.
- Sort by immediate buy price ascending.
- Build refinement search options from the current accessory's refinement lines.
- Fetch at least 3 pages and at most 10 pages per accessory type.
- Keep up to 100 eligible candidates per type.
- Deduplicate candidates by target equipment index, fingerprint, buy price, and end date.

The service returns candidates plus search metadata for `SearchSummary`.

### `AccessoryNormalizer`

Converts Lostark auction items into equipment-like accessory objects:

- `Type`
- `Name`
- `Icon`
- `Grade`
- `Quality`
- `Tier`
- `ItemLevel`
- `BuyPrice`
- `UpgradeLevel`
- `TradeRemainCount`
- `EndDate`
- `MainStatValue`
- `EnlightenmentPoint`
- `DetailSections`

It also owns candidate eligibility:

- Grade must be `고대`.
- Tier must be `4`.
- Buy price must be positive.
- Accessory type must be supported.
- Quality and enlightenment rules should match the current JavaScript behavior.

### `AccessoryEfficiencyService`

Ports accessory replacement evaluation:

- Match a candidate only to accessories of the same type and target equipment index.
- Simulate replacing one accessory in the equipment array.
- Apply combat stat deltas from basic-effect lines to profile stats.
- Apply enlightenment point delta to ark passive context.
- Estimate current and simulated combat power using the Java combat-power estimator path.
- Reject candidates with missing estimate, non-positive gain, or missing buy price.
- Sort comparisons by gold per 1% combat-power gain.

The returned shape matches current `AccessoryRecommendation`:

- `Status`
- `TopRecommendation`
- `Comparisons`
- `MissingInputs`

### `SpecUpRecommendationService`

Ports JavaScript `buildSpecUpRecommendation`:

- Normalize accessory comparisons into `Type: "accessory"` candidates.
- Normalize upgrade-efficiency candidates.
- Filter non-positive costs and gains.
- Sort by `EfficiencyScore` descending.
- Return first 5 candidates.
- Merge missing inputs from accessory and upgrade services.

## Data Flow

```text
/api/efficiency/spec-up/{name}
  -> SpecUpEfficiencyController
  -> SpecUpEfficiencyService
      -> LostarkApiClient armory reads
      -> MarketSnapshotService.getSnapshot(refresh)
      -> MarketSnapshotService.getRelicBookPrices(engravings)
      -> AccessoryAuctionSearchService.search(...)
      -> AccessoryEfficiencyService.build(...)
      -> UpgradeEfficiencyService.build(...)
      -> SpecUpRecommendationService.build(...)
  -> frontend-compatible JSON
```

## Error Handling

- Blank name returns `INVALID_CHARACTER_NAME` with HTTP 400.
- Missing API key returns `MISSING_API_KEY` with HTTP 500.
- Missing character returns `CHARACTER_NOT_FOUND` with HTTP 404.
- Lostark armory failure returns `LOSTARK_API_ERROR` with HTTP 502.
- Market snapshot failure should not fail the whole endpoint. It should make upgrade-efficiency market data unavailable and add missing inputs.
- Accessory auction failure should not fail the whole endpoint. It should return `AccessoryRecommendation.Status: "unavailable"` with a direct missing input such as `악세사리 경매장 후보`.

Partial results are preferred because non-accessory upgrade recommendations can still be useful when accessory auction search is temporarily unavailable.

## Frontend Integration

The `/efficiency` page should continue calling `/api/efficiency/spec-up/{name}` through the same browser-facing path. The active owner changes from Next.js to Spring through the existing local proxy setup and ownership rules.

No UI redesign is required in this step. Frontend changes are limited to removing or disabling the replaced Next.js route after Spring parity passes.

## Testing Strategy

Backend tests:

- Controller contract test for success and error responses.
- Accessory refinement search option tests.
- Auction accessory normalization tests.
- Accessory eligibility tests.
- Accessory replacement efficiency tests.
- Spec-up recommendation merge tests.
- Service orchestration test proving upgrade and accessory candidates appear together.

Parity tests:

- Mirror representative JavaScript fixtures for:
  - accessory search options,
  - normalized auction accessories,
  - accessory recommendation shape,
  - Top 5 merge ordering.

Frontend tests:

- Existing `npm test` should keep passing.
- Add or update tests only if route ownership changes require a mock adjustment.

Standard verification:

```bash
cd backend && ./mvnw test
npm test
npm run lint
npm run build
git diff --check
```

## Rollout

1. Implement Spring endpoint behind the same path.
2. Verify Spring contract against tests.
3. Update ownership docs.
4. Remove or disable replaced Next.js `spec-up` route after proxy ownership is active.
5. Keep `/api/efficiency/accessories/recovery` as a separate follow-up migration.

## Open Follow-Up

`/api/efficiency/accessories/recovery` remains Next-owned after this step. It should be migrated separately because it has different request shape, recovery-price confidence rules, and UI timing.
