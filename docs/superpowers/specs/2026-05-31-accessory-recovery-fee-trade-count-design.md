# Accessory Recovery Fee And Trade Count Design

Date: 2026-05-31

## Decision

Accessory recovery estimates will subtract Lost Ark's 5% sales fee and will use trade-remaining count when the current accessory exposes it.

The current implementation estimates recovery from exact-match auction median price. This change keeps that model, but makes two corrections:

- `EstimatedRecoveryGold` becomes net seller proceeds after fee.
- If the current accessory has a known `TradeRemainCount`, auction evidence must match the same `TradeRemainCount`.

When the current accessory's trade count is unknown, the service keeps the existing fingerprint-only estimate but returns an explicit trade-count caveat so the UI and Sggu can describe the uncertainty.

## Goals

- Apply a fixed 5% seller fee to recovery estimates.
- Preserve gross median price in the response for diagnostics.
- Return the fee amount used in the estimate.
- Filter exact-match auction evidence by `TradeRemainCount` when the current accessory has a known trade count.
- Keep recovery available when the current accessory trade count cannot be parsed, but label that state clearly.
- Parse equipped accessory trade count from armory tooltip when available.
- Keep existing UI request path and response shape backward-compatible.

## Non-Goals

- Model registration deposit, listing duration, failed sale risk, price undercutting, or sale probability.
- Change spec-up candidate scoring.
- Change auction search options.
- Require trade count to be known before returning a recovery estimate.
- Add user-configurable fee rate.

## Current State

Auction candidates already carry trade count:

- Lostark auction raw field: `AuctionInfo.TradeAllowCount`
- Spring normalized field: `TradeRemainCount`

Equipped accessories currently do not expose `TradeRemainCount`. `EquipmentNormalizer` normalizes quality, detail sections, and main stat values from the armory tooltip, but does not parse trade count.

Recovery service currently:

1. Builds a fingerprint from type, name, quality, main stat, enlightenment point, and refinement lines.
2. Keeps auction candidates with the same fingerprint.
3. Uses positive `BuyPrice` values.
4. Estimates recovery as median `BuyPrice`.
5. Returns high confidence when at least 3 exact matches exist and `IQR / median <= 0.35`.

## Target Response

High-confidence recovery response:

```json
{
  "Status": "ready",
  "Confidence": "high",
  "EvidenceCount": 3,
  "EstimatedGrossRecoveryGold": 100000,
  "EstimatedFeeGold": 5000,
  "EstimatedRecoveryGold": 95000,
  "FeeRate": 0.05,
  "TradeCountStatus": "matched",
  "TradeRemainCount": 2,
  "NetCostGold": 65000,
  "NetGoldPerOnePercentCombatPower": 43333,
  "Caveat": ""
}
```

Low-confidence response keeps existing fields and adds the new fields when possible:

```json
{
  "Status": "lowConfidence",
  "Confidence": "low",
  "EvidenceCount": 1,
  "EstimatedGrossRecoveryGold": 100000,
  "EstimatedFeeGold": 5000,
  "EstimatedRecoveryGold": 95000,
  "FeeRate": 0.05,
  "TradeCountStatus": "unknown",
  "TradeRemainCount": null,
  "NetCostGold": null,
  "NetGoldPerOnePercentCombatPower": null,
  "Caveat": "현재 악세 거래 가능 횟수를 확인하지 못해 거래횟수별 시세 차이는 반영하지 못했어."
}
```

Backward compatibility:

- `EstimatedRecoveryGold` remains present and now means net proceeds after fee.
- `NetCostGold` remains present and uses net proceeds.
- Existing UI can keep displaying `EstimatedRecoveryGold`.

## Fee Rule

Use a fixed fee rate:

```text
SALE_FEE_RATE = 0.05
EstimatedFeeGold = ceil(EstimatedGrossRecoveryGold * SALE_FEE_RATE)
EstimatedRecoveryGold = max(0, EstimatedGrossRecoveryGold - EstimatedFeeGold)
```

Rounding uses ceiling because seller proceeds should not overstate recovery after fee.

## Trade Count Rule

Trade count status values:

- `matched`: current accessory has known `TradeRemainCount`, and evidence was filtered to that same count.
- `unknown`: current accessory has no known `TradeRemainCount`, so evidence used fingerprint only.

Evidence filtering:

```text
if current.TradeRemainCount is known:
  keep candidate when fingerprint matches and candidate.TradeRemainCount == current.TradeRemainCount
else:
  keep candidate when fingerprint matches
```

This avoids comparing a 3-trade accessory against a 1-trade listing when the current item count is known.

## Equipped Trade Count Parsing

`EquipmentNormalizer` should parse trade count for necklace, earring, and ring items when the value appears in tooltip text.

Supported line patterns:

- `거래 가능 횟수 2회`
- `거래가능 횟수 2회`
- `거래 가능 2회`
- `거래 가능 횟수 : 2`

Implementation approach:

- Search all stripped tooltip detail-section lines and indent-string lines.
- Use a conservative regex containing `거래` and `가능`.
- Extract the first integer from the matched line.
- Set `TradeRemainCount` only when a non-negative integer is found.

If no value is found, leave `TradeRemainCount` absent/null.

## UI Behavior

The existing recovery box can keep its current main sentence:

```text
예상 회수가 {EstimatedRecoveryGold} · 순비용 기준 +1%당 {NetGoldPerOnePercentCombatPower}
```

Add a compact fee/trade hint only when data exists:

- If `EstimatedGrossRecoveryGold` and `EstimatedFeeGold` exist: show `수수료 {EstimatedFeeGold} 차감`.
- If `TradeCountStatus == "unknown"`: show caveat text.
- If `TradeCountStatus == "matched"` and `TradeRemainCount` exists: show `거래 {TradeRemainCount}회 기준`.

No layout redesign is required.

## Testing Strategy

Backend tests:

- `AccessoryRecoveryEstimateServiceTest`
  - high confidence subtracts 5% fee and calculates net cost from net recovery.
  - low confidence still reports gross, fee, and net recovery when median exists.
  - known current trade count filters out candidates with different `TradeRemainCount`.
  - unknown current trade count keeps fingerprint-only behavior and returns `TradeCountStatus: "unknown"`.
- `EquipmentNormalizerTest`
  - parses `TradeRemainCount` from an accessory tooltip line.
  - leaves `TradeRemainCount` absent when the tooltip has no trade count.
- `AccessoryRecoveryControllerTest`
  - response includes fee/trade fields through the existing endpoint.

Frontend tests:

- `accessoryDisplay` or panel-level test if an existing test covers recovery text.
- If no panel test exists, keep this as backend-only plus build verification.

Verification:

```bash
cd backend && ./mvnw -Dtest=AccessoryRecoveryEstimateServiceTest,EquipmentNormalizerTest,AccessoryRecoveryControllerTest test
cd backend && ./mvnw test
npm test
npm run lint
npm run build
git diff --check
```

## Risks

- Tooltip trade-count text can differ from the supported patterns.
  - Mitigation: fallback to `TradeCountStatus: "unknown"` instead of failing recovery.
- Fee rounding may differ from exact in-game display on very small prices.
  - Mitigation: use ceiling to avoid overstating seller proceeds.
- Trade count filtering can reduce evidence below 3 and lower confidence.
  - Mitigation: this is intended when known trade-count price data is sparse.
