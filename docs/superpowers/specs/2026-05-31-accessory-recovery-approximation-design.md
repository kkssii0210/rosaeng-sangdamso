# Accessory Recovery Approximation Design

Date: 2026-05-31

## Decision

Accessory recovery estimation will keep the current exact-match model first. When exact-match evidence is missing or unstable, the service will fall back to a conservative approximation based on similar active auction listings.

The approximation is dealer-only for now. Supporter-specific value signals are intentionally out of scope and will be handled later.

The Recovery API will not generate randomized user-facing counseling copy. It will return stable structured facts such as `Method`, `CaveatCode`, and `Facts`. Later, the Sggu LLM counseling layer can turn those facts into varied natural language while preserving the numeric result and evidence.

## Goals

- Return a conservative recovery estimate when no stable exact-match auction evidence exists.
- Avoid overfitting to small-market outliers.
- Avoid comparing irrelevant refinement options that do not affect dealer combat power.
- Keep exact-match estimates as the highest-confidence path.
- Preserve the existing 5% seller fee and trade-count handling.
- Expose enough structured evidence for UI and future LLM counseling.

## Non-Goals

- Use completed-sale history. The official auction endpoint exposes active auctions only.
- Use `/markets/trades` for accessories. It is market-item oriented and did not return accessory trade data in exploratory checks.
- Build supporter approximation rules.
- Let LLM produce numbers, confidence, or criteria.
- Randomize API caveat text.
- Model sale probability, listing deposit, undercutting, failed sales, or listing duration.

## Current State

`AccessoryRecoveryEstimateService` currently:

1. Filters auction candidates by exact fingerprint.
2. Optionally filters by current `TradeRemainCount` when known.
3. Uses median active `BuyPrice` as gross recovery.
4. Subtracts 5% seller fee.
5. Returns high confidence when exact evidence count is at least 3 and `IQR / median <= 0.35`.

The exact fingerprint includes:

- accessory type
- item name
- quality
- main stat value
- enlightenment point
- all refinement lines

This is safe when matches exist, but can return low confidence/null recovery when the current accessory has no identical active listing.

## Source Data Constraints

`/auctions/items` returns active auction listings. The observed response has:

- root fields: `PageNo`, `PageSize`, `TotalCount`, `Items`
- item fields: `Name`, `Grade`, `Tier`, `Level`, `Icon`, `GradeQuality`, `AuctionInfo`, `Options`
- `AuctionInfo` fields: `StartPrice`, `BuyPrice`, `BidPrice`, `EndDate`, `BidCount`, `BidStartPrice`, `IsCompetitive`, `TradeAllowCount`, `UpgradeLevel`

It does not include previous completed sales, sold price history, or sale time.

`/markets/trades` exposes recently traded market item fields such as `RecentPrice` and `YDayAvgPrice`, but accessory category checks returned no accessory data. Do not rely on it for accessory recovery.

## Approximation Rule

Exact remains first:

```text
if exact evidence is stable:
  use Method = "exact"
else:
  try Method = "approximateImpactRefinement"
```

Sparse exact evidence is still useful as a conservative price anchor. If exact evidence exists but is not stable enough for `Method = "exact"`, keep the lowest exact active `BuyPrice` as an optional conservative ceiling:

```text
exactSparseGross = min(exactPrices) when exactPrices is not empty
approxGross = min(nearCandidates.BuyPrice)
grossRecovery = min(exactSparseGross, approxGross) when both exist
```

This prevents an approximate listing from valuing the item above an actual identical active listing.

Approximation candidate filters:

```text
same accessory type
same tier and grade
same current TradeRemainCount when known
same dealer-impact refinement signature
positive BuyPrice
```

If the current accessory has no dealer-impact refinement signature, do not approximate. An empty signature would match too many unrelated accessories.

If current `TradeRemainCount == 0`, keep the existing untradable path:

```text
gross = 0
fee = 0
net = 0
Method = "untradable"
```

## Dealer-Impact Refinement Signature

Only refinement effects that affect dealer combat power are included in the approximation signature.

Necklace:

- `적에게 주는 피해`
- `추가 피해`

Earring:

- `공격력 %`
- `무기 공격력 %`
- flat `공격력`
- flat `무기 공격력`

Ring:

- `치명타 적중률`
- `치명타 피해`
- flat `공격력`
- flat `무기 공격력`

Ignored for dealer approximation:

- maximum HP
- defense
- recovery effects
- shield effects
- supporter-specific effects
- any refinement effect not used by the dealer combat-power model

Signature normalization:

```text
effectName + normalizedValue
```

Examples:

```text
목걸이: 추가 피해 +2.60%
귀걸이: 공격력 +1.55%
귀걸이: 무기 공격력 +300
반지: 치명타 피해 +2.40%
```

Non-impact refinement lines are ignored before comparing signatures.

Current and candidate signatures must both be non-empty and equal:

```text
currentImpactSignature is not empty
candidateImpactSignature == currentImpactSignature
```

## Main Stat Proximity

Accessories do not use combat stat values such as critical, specialization, or swiftness as comparison inputs here. The approximation compares only the main stat value parsed from `힘`, `민첩`, or `지능`.

After impact-signature filtering:

```text
mainStatDelta = abs(candidate.MainStatValue - current.MainStatValue)
minMainStatDelta = min(mainStatDelta)
nearThreshold = max(minMainStatDelta, round(current.MainStatValue * 0.01))
nearCandidates = candidates where mainStatDelta <= nearThreshold
```

This avoids depending on one single listing while still staying close to the current accessory's stat range.

If current or candidate main stat is missing, exclude that candidate from approximation. If current main stat is missing, return unavailable for the approximate path.

## Conservative Price Rule

Use the lowest active buy price among near candidates:

```text
approxGross = min(nearCandidates.BuyPrice)
grossRecovery = min(exactSparseGross, approxGross) if sparse exact evidence exists
fee = ceil(grossRecovery * 0.05)
netRecovery = grossRecovery - fee
```

The estimate is intentionally conservative. It answers:

```text
"비슷한 조건으로 지금 시장에 걸린 매물 중 낮게 보면 얼마 정도 회수로 볼 수 있나?"
```

It does not claim the current item will certainly sell at that price.

## Confidence

Exact:

```text
Method = "exact"
Confidence = "high"
```

Approximate:

```text
if nearCandidates >= 3:
  Method = "approximateImpactRefinement"
  Confidence = "conservative"
else if nearCandidates >= 1:
  Method = "approximateImpactRefinement"
  Confidence = "low"
else:
  Method = "unavailable"
  Confidence = "low"
```

Approximate estimates should not be promoted to `high`, even with many listings, because active auction listings are not completed-sale history.

## Response Shape

Exact responses should add method fields without removing existing fields:

```json
{
  "Status": "ready",
  "Method": "exact",
  "Confidence": "high",
  "EvidenceCount": 3,
  "EstimatedGrossRecoveryGold": 100000,
  "EstimatedFeeGold": 5000,
  "EstimatedRecoveryGold": 95000,
  "CaveatCode": null,
  "Facts": {
    "pricePolicy": "exactMedianActiveAuction",
    "feeRate": 0.05
  }
}
```

Approximate response:

```json
{
  "Status": "ready",
  "Method": "approximateImpactRefinement",
  "Confidence": "conservative",
  "EvidenceCount": 4,
  "EstimatedGrossRecoveryGold": 80000,
  "EstimatedFeeGold": 4000,
  "EstimatedRecoveryGold": 76000,
  "CaveatCode": "APPROXIMATE_IMPACT_REFINEMENT",
  "Facts": {
    "role": "dealer",
    "pricePolicy": "minimumNearMainStatActiveAuction",
    "impactRefinementSignature": ["추가 피해 +2.60%"],
    "exactSparseEvidenceCount": 1,
    "usedExactSparseCeiling": false,
    "mainStatDelta": 120,
    "nearMainStatThreshold": 178,
    "tradeCountMatched": true,
    "feeRate": 0.05
  }
}
```

Unavailable response:

```json
{
  "Status": "lowConfidence",
  "Method": "unavailable",
  "Confidence": "low",
  "EvidenceCount": 0,
  "EstimatedGrossRecoveryGold": null,
  "EstimatedFeeGold": null,
  "EstimatedRecoveryGold": null,
  "CaveatCode": "NO_APPROXIMATE_EVIDENCE",
  "Facts": {
    "role": "dealer",
    "pricePolicy": "none",
    "feeRate": 0.05
  }
}
```

## Counseling Copy Boundary

The Recovery API should return stable facts, not conversational variation.

The Sggu LLM layer can later receive:

- `Method`
- `Confidence`
- `CaveatCode`
- `Facts`
- numeric estimates

The LLM may vary phrasing according to future mood/personality design, but it must not invent:

- recovery gold
- fee
- confidence
- evidence count
- matching criteria

Test assertions should target structured fields and only check generated copy for presence when necessary.

## UI Behavior

For now, UI can keep compact deterministic hints:

- exact: no extra approximate caveat.
- approximate: show a short caveat derived from `CaveatCode`.
- unavailable: keep existing low-confidence/no-recovery message.

Later Sggu responses can provide richer explanation in the consultation area.

## Testing Strategy

Backend service tests:

- exact stable evidence still wins over approximate candidates.
- sparse exact evidence caps approximate gross recovery when exact sparse price is lower.
- no exact evidence but same dealer-impact signature returns approximate conservative recovery.
- empty current dealer-impact signature returns unavailable.
- non-impact refinement differences do not block approximate matching.
- different dealer-impact refinement value does block approximate matching.
- known current trade count filters approximate candidates by same count.
- current trade count 0 still returns zero recovery.
- main stat proximity chooses the closest band, then uses the lowest buy price in that band.
- missing current main stat returns unavailable for the approximate path.
- approximate response includes `Method`, `CaveatCode`, and `Facts`.
- no approximate evidence returns `Method = "unavailable"`.

Controller tests:

- endpoint response exposes method/facts fields through existing recovery endpoint.

Frontend/build checks:

- existing recovery UI still renders exact and approximate responses without crashing.

## Risks

- Active listing prices can still be stale or intentionally overpriced.
  - Mitigation: use the lowest price among near candidates and label the method approximate.
- Small markets may produce only one candidate.
  - Mitigation: mark confidence low when candidate count is below 3.
- Dealer-impact option classification can miss an effect.
  - Mitigation: centralize classification in one helper and test ignored/impact effects explicitly.
- Future supporter logic differs.
  - Mitigation: keep role fixed to `dealer` and return that in `Facts`.
