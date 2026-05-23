# Combat Power Efficiency API Completion Design

## Context

The `/efficiency` page is already present and renders the combat power efficiency simulator UI. The page currently fails after a character name is submitted because the client calls API routes that do not exist:

- `GET /api/efficiency/accessories/{name}`
- `POST /api/efficiency/accessories/recovery`

Existing API routes only cover character analysis and market snapshots:

- `app/api/characters/[name]/route.js`
- `app/api/market/snapshot/route.js`

The fix is to complete the simulator backend/API path described by the existing 2026-05-20 simulator design and plan, not to hide the UI error.

## Goals

- Make character-name submission on `/efficiency` return a real accessory recommendation response.
- Recommend T4 ancient necklace, earring, and ring replacements ranked by gold per +1% combat power.
- Estimate recovery value for the replaced current accessory when enough exact auction matches exist.
- Reuse existing combat power model behavior instead of introducing a second formula path.
- Keep all domain logic testable without calling the Lostark Open API from tests.

## Non-Goals

- No bracelet recommendations in this phase.
- No honing, gem, or avatar recommendations in this simulator response.
- No Spring Boot backend changes. This simulator path runs through Next.js API routes.
- No UI redesign beyond behavior needed to consume the new API responses.

## Architecture

The simulator flow stays in the existing Next.js/JavaScript stack:

1. `/efficiency` UI submits the character name.
2. `GET /api/efficiency/accessories/{name}` validates input and API key.
3. The route loads the character armory data required for combat-power simulation.
4. Armory data is normalized with the same existing helpers used by the character analysis route.
5. The route searches auction pages for T4 ancient necklace, earring, and ring candidates.
6. Candidates are normalized into equipment-like accessory objects.
7. Each eligible candidate is virtually swapped into matching current accessory slots.
8. `buildCombatPowerAnalysis` calculates current and simulated estimates.
9. The API returns the top recommendation and top three comparisons.
10. If a top recommendation exists, the UI calls `POST /api/efficiency/accessories/recovery`.
11. The recovery route searches comparable auction candidates and returns a high-confidence net-cost estimate only when evidence is stable.

## Components

### `lib/lostark/characterEfficiencyContext.js`

Loads and normalizes the character data needed by the simulator:

- profile
- equipment
- ark passive
- ark grid
- cards
- combat skills
- engravings
- gems

It also builds:

- normalized equipment
- normalized engravings, cards, and gems
- class identity effects
- critical stats
- combat context for `buildCombatPowerAnalysis`

### `lib/lostark/accessoryAuction.js`

Owns accessory candidate normalization:

- T4 ancient category definitions for necklace, earring, and ring.
- Quality and enlightenment-point eligibility rules.
- Conversion from raw auction items into equipment-like accessories.
- Stable accessory fingerprints for recovery matching.

Eligibility rules:

- grade: `고대`
- tier: `4`
- quality: `>= 90`
- enlightenment point: necklace `13`, earring `9`, ring `9`
- positive buy price

### `lib/lostark/accessoryAuctionApi.js`

Fetches auction candidates with controlled search behavior:

- minimum pages per type: `3`
- maximum pages per type: `10`
- maximum eligible candidates per type: `100`
- raw page cache TTL: `2 minutes`
- `forceRefresh` support for explicit refresh calls

Tests use a fake `postAuction` function; no test hits the real Lostark API.

### `lib/spec/accessoryEfficiencySimulation.js`

Simulates replacements:

- Finds current slots matching each candidate type.
- Replaces one accessory at a time without mutating the original equipment array.
- Runs `buildCombatPowerAnalysis` for current and simulated equipment.
- Converts internal model delta into expected official combat power:
  `current official combat power + internal simulated gain`
- Ranks by `BuyPrice / CombatPowerGainPercent`.

Response states:

- `ready`: at least one improving recommendation exists.
- `noRecommendation`: candidates exist but none improve combat power.
- `unavailable`: required current combat-power inputs are missing.

### `lib/spec/accessoryRecoveryEstimate.js`

Estimates current accessory recovery value:

- Builds fingerprint for the current replaced accessory.
- Finds exact fingerprint matches among auction candidates.
- Uses median buy price when at least three matches exist and price spread is stable.
- Returns low-confidence response when evidence is insufficient.
- Hides net efficiency for low-confidence data.

### `app/api/efficiency/accessories/[name]/route.js`

Fast recommendation route.

Validation and errors:

- empty name: `400 INVALID_CHARACTER_NAME`
- missing API key: `500 MISSING_API_KEY`
- missing character profile: `404 CHARACTER_NOT_FOUND`
- Lostark API or auction failure: `502 LOSTARK_API_ERROR`

Success response includes:

- `CharacterName`
- `UpdatedAt`
- `MarketUpdatedAt`
- `SearchSummary`
- `Recommendation`

### `app/api/efficiency/accessories/recovery/route.js`

Recovery estimate route.

Validation and errors:

- invalid body: `400 INVALID_RECOVERY_REQUEST`
- missing API key: `500 MISSING_API_KEY`
- Lostark API or auction failure: `502 LOSTARK_API_ERROR`

Success response includes:

- `UpdatedAt`
- `SearchSummary`
- `RecoveryEstimate`

## Data Flow

### Recommendation

```text
character name
  -> decode and trim
  -> API key check
  -> armory fetch
  -> normalize character context
  -> auction candidate search
  -> normalize and filter candidates
  -> virtual replacement simulation
  -> combat power analysis
  -> rank by gold per +1% combat power
  -> API response
```

### Recovery

```text
top recommendation
  -> validate current accessory and recommendation fields
  -> auction candidate search for same accessory type
  -> exact fingerprint matching
  -> median recovery estimate
  -> confidence check
  -> API response
```

## Error Handling

The UI should continue showing the current error message behavior from `CombatPowerEfficiencyPage.jsx`: non-OK JSON responses supply `message`, and unknown failures fall back to `전투력 효율을 계산하지 못했어.`

API routes must return JSON for expected errors. They must not leak raw Lostark response bodies to the client. Server logs can keep the underlying error for debugging.

Calculation insufficiency is not always a route error. If armory data exists but the combat model cannot produce a reliable current estimate, return `200` with `Recommendation.Status = "unavailable"` so the UI can show a non-crashing empty state.

## Testing

Add focused tests:

- `tests/accessoryAuction.test.js`
  - category definitions
  - normalization
  - max enlightenment filtering
  - fingerprint stability

- `tests/accessoryEfficiencySimulation.test.js`
  - immutable replacement
  - candidate ranking
  - best same-type slot selection
  - no-recommendation state

- `tests/accessoryRecoveryEstimate.test.js`
  - percentile calculation
  - median exact-match pricing
  - high-confidence threshold
  - low-confidence net-efficiency hiding

- `tests/accessoryAuctionApi.test.js`
  - page traversal
  - raw page cache
  - forced refresh

- `tests/characterEfficiencyContext.test.js`
  - authorization header normalization
  - character-not-found handling
  - successful context assembly

- `tests/accessoryEfficiencyApi.test.js`
  - empty name validation
  - missing key validation
  - recovery request validation

Verification commands:

```bash
npm test -- tests/accessoryAuction.test.js tests/accessoryEfficiencySimulation.test.js tests/accessoryRecoveryEstimate.test.js tests/accessoryAuctionApi.test.js tests/characterEfficiencyContext.test.js tests/accessoryEfficiencyApi.test.js
npm test
npm run lint
```

## Rollout

Implementation order:

1. Add fixtures and `accessoryAuction` normalization.
2. Add replacement simulation.
3. Add recovery estimate logic.
4. Add auction page search and cache.
5. Add character efficiency context loader.
6. Add recommendation and recovery API routes.
7. Verify with tests.
8. Verify live local route with `curl` against the running Next.js dev server.

The Spring Boot backend can remain running but is not required for this feature path.

## Risks

- Lostark auction API response fields may differ from fixtures. The normalization module should be the only place needing adjustment.
- Auction searching may be slow. The first implementation limits page count and caches raw pages for two minutes.
- The displayed expected combat power is not a fresh official value from Lostark. It is current official combat power plus the internal model gain. This must remain explicit in implementation comments or response naming.
- If current armory data lacks enough inputs for `buildCombatPowerAnalysis`, the route should return an unavailable recommendation rather than crashing.
