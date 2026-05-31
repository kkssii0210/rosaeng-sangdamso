# Accessory Recovery Fee And Trade Count Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adjust accessory recovery estimates to subtract Lost Ark's 5% sales fee, use trade-remaining count when the current accessory exposes it, and treat 0 remaining trades as zero recovery.

**Architecture:** Keep recovery estimation in Spring Boot. Add trade-count parsing to the character equipment normalizer, extend the recovery estimate service to filter evidence by known trade count and apply fee math, and surface compact fee/trade hints in the existing recovery UI.

**Tech Stack:** Java 21, Spring Boot 4 WebMVC, Jackson `JsonNode`, JUnit 5, AssertJ, MockMvc, React/Next.js, Node test runner.

---

## File Structure

- Modify `backend/src/main/java/com/rosaeng/sangdamso/character/equipment/EquipmentNormalizer.java`
  - Parses equipped accessory `TradeRemainCount` from tooltip lines when present.
- Modify `backend/src/test/java/com/rosaeng/sangdamso/character/equipment/EquipmentNormalizerTest.java`
  - Covers trade-count extraction and absence behavior.
- Modify `backend/src/main/java/com/rosaeng/sangdamso/efficiency/AccessoryRecoveryEstimateService.java`
  - Applies 5% fee, exposes gross/fee/net fields, filters by positive `TradeRemainCount` when known, and returns zero recovery for 0 remaining trades.
- Modify `backend/src/test/java/com/rosaeng/sangdamso/efficiency/AccessoryRecoveryEstimateServiceTest.java`
  - Updates expected net recovery values and adds trade-count filtering tests.
- Modify `backend/src/test/java/com/rosaeng/sangdamso/efficiency/AccessoryRecoveryControllerTest.java`
  - Confirms endpoint response includes fee/trade fields.
- Modify `components/AccessoryRecommendationPanel.jsx`
  - Displays fee and trade-count caveat/hint without changing layout.

## Task 1: Parse Equipped Accessory Trade Count

**Files:**
- Modify: `backend/src/test/java/com/rosaeng/sangdamso/character/equipment/EquipmentNormalizerTest.java`
- Modify: `backend/src/main/java/com/rosaeng/sangdamso/character/equipment/EquipmentNormalizer.java`

- [ ] **Step 1: Add failing tests for equipped trade count parsing**

In `backend/src/test/java/com/rosaeng/sangdamso/character/equipment/EquipmentNormalizerTest.java`, append these tests before the helper methods:

```java
    @Test
    void extractsAccessoryTradeRemainCountFromTooltipLines() throws Exception {
        JsonNode equipment = equipment(
            item("목걸이", "새벽의 목걸이", "https://cdn-lostark.game.onstove.com/sample-necklace.png", "고대",
                tooltip(83, sections(
                    section("기본 효과", "힘 +17831", "치명 +420", "특화 +420"),
                    section("거래 정보", "거래 가능 횟수 : 2회"),
                    section("연마 효과", "추가 피해 +2.60%"),
                    section("아크 패시브 포인트 효과", "깨달음 +13")
                )))
        );

        JsonNode normalized = normalizer.normalize(equipment);

        assertThat(normalized.get(0).get("TradeRemainCount").asInt()).isEqualTo(2);
    }

    @Test
    void omitsAccessoryTradeRemainCountWhenTooltipDoesNotExposeIt() throws Exception {
        JsonNode equipment = equipment(
            item("반지", "새벽의 반지", "https://cdn-lostark.game.onstove.com/sample-ring.png", "고대",
                tooltip(90, sections(
                    section("기본 효과", "힘 +12000", "치명 +200"),
                    section("연마 효과", "치명타 피해 +2.40%"),
                    section("아크 패시브 포인트 효과", "깨달음 +9")
                )))
        );

        JsonNode normalized = normalizer.normalize(equipment);

        assertThat(normalized.get(0).get("TradeRemainCount")).isNull();
    }

    @Test
    void extractsZeroAccessoryTradeRemainCountFromTooltipLines() throws Exception {
        JsonNode equipment = equipment(
            item("귀걸이", "새벽의 귀걸이", "https://cdn-lostark.game.onstove.com/sample-earring.png", "고대",
                tooltip(78, sections(
                    section("기본 효과", "민첩 +12000", "특화 +300"),
                    section("거래 정보", "거래 가능 횟수 : 0회"),
                    section("연마 효과", "공격력 +1.55%"),
                    section("아크 패시브 포인트 효과", "깨달음 +10")
                )))
        );

        JsonNode normalized = normalizer.normalize(equipment);

        assertThat(normalized.get(0).get("TradeRemainCount").asInt()).isEqualTo(0);
    }
```

- [ ] **Step 2: Run RED**

Run:

```bash
cd backend && ./mvnw -Dtest=EquipmentNormalizerTest test
```

Expected: FAIL because `TradeRemainCount` is missing from normalized accessories.

- [ ] **Step 3: Implement trade-count parsing in `EquipmentNormalizer`**

Modify `backend/src/main/java/com/rosaeng/sangdamso/character/equipment/EquipmentNormalizer.java`.

Add this pattern near existing patterns:

```java
    private static final Pattern TRADE_REMAIN_COUNT_PATTERN = Pattern.compile("거래\\s*가능(?:\\s*횟수)?\\s*[:：]?\\s*(?<count>\\d+)");
```

In `normalizeItem`, after `detailSections` is created and before `return normalized;`, add:

```java
        Integer tradeRemainCount = DETAILED_EQUIPMENT_TYPES.contains(type)
            ? extractTradeRemainCount(detailSections, extractIndentStringSections(tooltip))
            : null;

        if (tradeRemainCount != null) {
            normalized.put("TradeRemainCount", tradeRemainCount);
        }
```

Add these helper methods below `extractParadiseOrb` or near other extraction helpers:

```java
    private Integer extractTradeRemainCount(List<Map<String, Object>> detailSections, List<Map<String, Object>> indentSections) {
        List<Map<String, Object>> sections = new ArrayList<>();
        sections.addAll(detailSections);
        sections.addAll(indentSections);

        for (Map<String, Object> section : sections) {
            for (String line : lines(section.get("lines"))) {
                Matcher matcher = TRADE_REMAIN_COUNT_PATTERN.matcher(line);

                if (matcher.find()) {
                    return parseInteger(matcher.group("count"));
                }
            }
        }

        return null;
    }
```

Do not include `TradeRemainCount` for weapons, armor, ability stones, or accessories where no count is found. Do include `TradeRemainCount: 0` when the tooltip explicitly exposes zero remaining trades.

- [ ] **Step 4: Run GREEN**

Run:

```bash
cd backend && ./mvnw -Dtest=EquipmentNormalizerTest test
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add backend/src/main/java/com/rosaeng/sangdamso/character/equipment/EquipmentNormalizer.java backend/src/test/java/com/rosaeng/sangdamso/character/equipment/EquipmentNormalizerTest.java
git commit -m "feat: parse accessory trade count"
```

## Task 2: Apply Recovery Fee And Trade Count Filtering

**Files:**
- Modify: `backend/src/test/java/com/rosaeng/sangdamso/efficiency/AccessoryRecoveryEstimateServiceTest.java`
- Modify: `backend/src/main/java/com/rosaeng/sangdamso/efficiency/AccessoryRecoveryEstimateService.java`

- [ ] **Step 1: Update and add failing recovery estimate tests**

Modify `backend/src/test/java/com/rosaeng/sangdamso/efficiency/AccessoryRecoveryEstimateServiceTest.java`.

In `buildsHighConfidenceEstimateFromStableExactMatches`, change assertions to:

```java
        assertThat(estimate.get("EstimatedGrossRecoveryGold").asInt()).isEqualTo(100000);
        assertThat(estimate.get("EstimatedFeeGold").asInt()).isEqualTo(5000);
        assertThat(estimate.get("EstimatedRecoveryGold").asInt()).isEqualTo(95000);
        assertThat(estimate.get("FeeRate").asDouble()).isEqualTo(0.05);
        assertThat(estimate.get("TradeCountStatus").asString()).isEqualTo("unknown");
        assertThat(estimate.get("TradeRemainCount").isNull()).isTrue();
        assertThat(estimate.get("Caveat").asString()).contains("거래 가능 횟수");
        assertThat(estimate.get("NetCostGold").asInt()).isEqualTo(65000);
        assertThat(estimate.get("NetGoldPerOnePercentCombatPower").asInt()).isEqualTo(43333);
```

In `returnsLowConfidenceWhenExactMatchEvidenceIsInsufficient`, change recovery assertion to:

```java
        assertThat(estimate.get("EstimatedGrossRecoveryGold").asInt()).isEqualTo(100000);
        assertThat(estimate.get("EstimatedFeeGold").asInt()).isEqualTo(5000);
        assertThat(estimate.get("EstimatedRecoveryGold").asInt()).isEqualTo(95000);
```

Append these two tests:

```java
    @Test
    void filtersExactMatchesByKnownTradeRemainCount() {
        JsonNode estimate = service.build(
            currentAccessoryWithTradeCount(2),
            toJsonNode(List.of(
                matchingCandidate(90000, 2),
                matchingCandidate(100000, 2),
                matchingCandidate(110000, 2),
                matchingCandidate(50000, 1)
            )),
            toJsonNode(orderedMap("BuyPrice", 160000, "CombatPowerGainPercent", 1.5))
        );

        assertThat(estimate.get("Status").asString()).isEqualTo("ready");
        assertThat(estimate.get("EstimatedGrossRecoveryGold").asInt()).isEqualTo(100000);
        assertThat(estimate.get("EstimatedRecoveryGold").asInt()).isEqualTo(95000);
        assertThat(estimate.get("TradeCountStatus").asString()).isEqualTo("matched");
        assertThat(estimate.get("TradeRemainCount").asInt()).isEqualTo(2);
        assertThat(estimate.get("Caveat").asString()).isBlank();
    }

    @Test
    void knownTradeRemainCountCanLowerConfidenceWhenEvidenceIsSparse() {
        JsonNode estimate = service.build(
            currentAccessoryWithTradeCount(2),
            toJsonNode(List.of(
                matchingCandidate(90000, 2),
                matchingCandidate(100000, 2),
                matchingCandidate(110000, 1),
                matchingCandidate(120000, 1)
            )),
            toJsonNode(orderedMap("BuyPrice", 160000, "CombatPowerGainPercent", 1.5))
        );

        assertThat(estimate.get("Status").asString()).isEqualTo("lowConfidence");
        assertThat(estimate.get("EvidenceCount").asInt()).isEqualTo(2);
        assertThat(estimate.get("TradeCountStatus").asString()).isEqualTo("matched");
        assertThat(estimate.get("TradeRemainCount").asInt()).isEqualTo(2);
    }

    @Test
    void returnsZeroRecoveryWhenCurrentTradeRemainCountIsZero() {
        JsonNode estimate = service.build(
            currentAccessoryWithTradeCount(0),
            toJsonNode(List.of(
                matchingCandidate(90000, 1),
                matchingCandidate(100000, 1),
                matchingCandidate(110000, 1)
            )),
            toJsonNode(orderedMap("BuyPrice", 160000, "CombatPowerGainPercent", 1.5))
        );

        assertThat(estimate.get("Status").asString()).isEqualTo("ready");
        assertThat(estimate.get("Confidence").asString()).isEqualTo("high");
        assertThat(estimate.get("EvidenceCount").asInt()).isEqualTo(0);
        assertThat(estimate.get("EstimatedGrossRecoveryGold").asInt()).isEqualTo(0);
        assertThat(estimate.get("EstimatedFeeGold").asInt()).isEqualTo(0);
        assertThat(estimate.get("EstimatedRecoveryGold").asInt()).isEqualTo(0);
        assertThat(estimate.get("TradeCountStatus").asString()).isEqualTo("untradable");
        assertThat(estimate.get("TradeRemainCount").asInt()).isEqualTo(0);
        assertThat(estimate.get("NetCostGold").asInt()).isEqualTo(160000);
        assertThat(estimate.get("NetGoldPerOnePercentCombatPower").asInt()).isEqualTo(106667);
        assertThat(estimate.get("Caveat").asString()).contains("0회");
    }
```

Add helper overloads:

```java
    private JsonNode currentAccessoryWithTradeCount(int tradeRemainCount) {
        return toJsonNode(orderedMap(
            "Type", "목걸이",
            "Name", "고대 목걸이",
            "Quality", 91,
            "MainStatValue", 12000,
            "EnlightenmentPoint", 13,
            "TradeRemainCount", tradeRemainCount,
            "DetailSections", List.of(
                orderedMap("title", "기본 효과", "lines", List.of("힘 +12000")),
                orderedMap("title", "연마 효과", "lines", List.of("추가 피해 +1.50%")),
                orderedMap("title", "아크 패시브 포인트 효과", "lines", List.of("깨달음 +13"))
            )
        ));
    }

    private JsonNode matchingCandidate(int buyPrice, int tradeRemainCount) {
        return toJsonNode(orderedMap(
            "Type", "목걸이",
            "Name", "고대 목걸이",
            "Quality", 91,
            "MainStatValue", 12000,
            "EnlightenmentPoint", 13,
            "TradeRemainCount", tradeRemainCount,
            "BuyPrice", buyPrice,
            "DetailSections", List.of(
                orderedMap("title", "연마 효과", "lines", List.of("추가 피해 +1.50%"))
            )
        ));
    }
```

Keep the existing `matchingCandidate(int buyPrice)` helper; it should still build a candidate without trade count for unknown-count tests.

- [ ] **Step 2: Run RED**

Run:

```bash
cd backend && ./mvnw -Dtest=AccessoryRecoveryEstimateServiceTest test
```

Expected: FAIL because fee/trade fields and trade-count filtering are not implemented yet.

- [ ] **Step 3: Implement fee and trade-count filtering**

Modify `backend/src/main/java/com/rosaeng/sangdamso/efficiency/AccessoryRecoveryEstimateService.java`.

Add constants inside the class:

```java
    private static final double SALE_FEE_RATE = 0.05;
    private static final String TRADE_COUNT_UNKNOWN_CAVEAT = "현재 악세 거래 가능 횟수를 확인하지 못해 거래횟수별 시세 차이는 반영하지 못했어.";
    private static final String UNTRADABLE_CAVEAT = "현재 악세 거래 가능 횟수가 0회라 회수금을 0으로 계산했어.";
```

Change `build` to calculate gross, fee, and net:

```java
    public JsonNode build(JsonNode currentAccessory, JsonNode auctionCandidates, JsonNode recommendation) {
        Integer currentTradeRemainCount = nonNegativeInteger(currentAccessory, "TradeRemainCount", "tradeRemainCount");

        if (Integer.valueOf(0).equals(currentTradeRemainCount)) {
            return untradableEstimate(recommendation, currentTradeRemainCount);
        }

        Summary summary = summarizeExactMatchPrices(currentAccessory, auctionCandidates, currentTradeRemainCount);
        RecoveryAmounts amounts = recoveryAmounts(summary.medianPrice());
        String tradeCountStatus = currentTradeRemainCount == null ? "unknown" : "matched";
        String caveat = currentTradeRemainCount == null ? TRADE_COUNT_UNKNOWN_CAVEAT : "";
        boolean stableSpread = summary.medianPrice() != null
            && summary.medianPrice() > 0
            && summary.interquartileRange() != null
            && summary.interquartileRange() / (double) summary.medianPrice() <= 0.35;
        boolean highConfidence = summary.count() >= 3 && stableSpread;

        if (!highConfidence) {
            return lowConfidenceEstimate(summary, amounts, tradeCountStatus, currentTradeRemainCount, caveat);
        }

        Double buyPrice = positiveNumber(recommendation, "BuyPrice", "buyPrice");
        Double gainPercent = positiveNumber(recommendation, "CombatPowerGainPercent", "combatPowerGainPercent");

        if (buyPrice == null || gainPercent == null) {
            return lowConfidenceEstimate(summary, amounts, tradeCountStatus, currentTradeRemainCount, caveat);
        }

        long netCost = Math.max(0L, Math.round(buyPrice) - amounts.netRecoveryGold());

        return toJsonNode(orderedMap(
            "Status", "ready",
            "Confidence", "high",
            "EvidenceCount", summary.count(),
            "EstimatedGrossRecoveryGold", amounts.grossRecoveryGold(),
            "EstimatedFeeGold", amounts.feeGold(),
            "EstimatedRecoveryGold", amounts.netRecoveryGold(),
            "FeeRate", SALE_FEE_RATE,
            "TradeCountStatus", tradeCountStatus,
            "TradeRemainCount", currentTradeRemainCount,
            "NetCostGold", netCost,
            "NetGoldPerOnePercentCombatPower", Math.round(netCost / gainPercent),
            "Caveat", caveat
        ));
    }
```

Change `summarizeExactMatchPrices` signature and filter:

```java
    private Summary summarizeExactMatchPrices(JsonNode currentAccessory, JsonNode auctionCandidates, Integer currentTradeRemainCount) {
```

Inside the candidate loop, after fingerprint match, add:

```java
            if (currentTradeRemainCount != null) {
                Integer candidateTradeRemainCount = nonNegativeInteger(candidate, "TradeRemainCount", "tradeRemainCount");

                if (!currentTradeRemainCount.equals(candidateTradeRemainCount)) {
                    continue;
                }
            }
```

Replace `lowConfidenceEstimate(Summary summary)` with:

```java
    private JsonNode lowConfidenceEstimate(
        Summary summary,
        RecoveryAmounts amounts,
        String tradeCountStatus,
        Integer tradeRemainCount,
        String caveat
    ) {
        return toJsonNode(orderedMap(
            "Status", "lowConfidence",
            "Confidence", "low",
            "EvidenceCount", summary.count(),
            "EstimatedGrossRecoveryGold", amounts.grossRecoveryGold(),
            "EstimatedFeeGold", amounts.feeGold(),
            "EstimatedRecoveryGold", amounts.netRecoveryGold(),
            "FeeRate", SALE_FEE_RATE,
            "TradeCountStatus", tradeCountStatus,
            "TradeRemainCount", tradeRemainCount,
            "NetCostGold", null,
            "NetGoldPerOnePercentCombatPower", null,
            "Caveat", caveat
        ));
    }
```

Add an untradable response helper:

```java
    private JsonNode untradableEstimate(JsonNode recommendation, Integer tradeRemainCount) {
        Double buyPrice = positiveNumber(recommendation, "BuyPrice", "buyPrice");
        Double gainPercent = positiveNumber(recommendation, "CombatPowerGainPercent", "combatPowerGainPercent");
        Long netCost = buyPrice == null ? null : Math.round(buyPrice);
        Long netGoldPerOnePercent = netCost == null || gainPercent == null
            ? null
            : Math.round(netCost / gainPercent);

        return toJsonNode(orderedMap(
            "Status", "ready",
            "Confidence", "high",
            "EvidenceCount", 0,
            "EstimatedGrossRecoveryGold", 0,
            "EstimatedFeeGold", 0,
            "EstimatedRecoveryGold", 0,
            "FeeRate", SALE_FEE_RATE,
            "TradeCountStatus", "untradable",
            "TradeRemainCount", tradeRemainCount,
            "NetCostGold", netCost,
            "NetGoldPerOnePercentCombatPower", netGoldPerOnePercent,
            "Caveat", UNTRADABLE_CAVEAT
        ));
    }
```

Add amount helper and record:

```java
    private RecoveryAmounts recoveryAmounts(Integer grossRecoveryGold) {
        if (grossRecoveryGold == null) {
            return new RecoveryAmounts(null, null, null);
        }

        int feeGold = Math.toIntExact((long) Math.ceil(grossRecoveryGold * SALE_FEE_RATE));
        int netRecoveryGold = Math.max(0, grossRecoveryGold - feeGold);
        return new RecoveryAmounts(grossRecoveryGold, feeGold, netRecoveryGold);
    }

    private record RecoveryAmounts(Integer grossRecoveryGold, Integer feeGold, Integer netRecoveryGold) {
    }
```

Add a non-negative integer helper for trade counts. Keep `positiveInteger` for prices:

```java
    private Integer nonNegativeInteger(JsonNode node, String... keys) {
        Double value = number(node, keys);

        return value == null || value < 0 ? null : Math.toIntExact(Math.round(value));
    }
```

Extract the shared parsing body from `positiveNumber` into `number`, then let `positiveNumber` return only finite values greater than 0. This preserves existing price behavior while allowing `TradeRemainCount: 0`.

Keep existing `Summary` record.

- [ ] **Step 4: Run GREEN**

Run:

```bash
cd backend && ./mvnw -Dtest=AccessoryRecoveryEstimateServiceTest test
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add backend/src/main/java/com/rosaeng/sangdamso/efficiency/AccessoryRecoveryEstimateService.java backend/src/test/java/com/rosaeng/sangdamso/efficiency/AccessoryRecoveryEstimateServiceTest.java
git commit -m "feat: apply accessory recovery fee"
```

## Task 3: Update Recovery Controller Contract Tests

**Files:**
- Modify: `backend/src/test/java/com/rosaeng/sangdamso/efficiency/AccessoryRecoveryControllerTest.java`

- [ ] **Step 1: Add failing controller response assertions**

In `returnsRecoveryEstimate`, replace:

```java
            .andExpect(jsonPath("$.RecoveryEstimate.EstimatedRecoveryGold").value(100000));
```

with:

```java
            .andExpect(jsonPath("$.RecoveryEstimate.EstimatedGrossRecoveryGold").value(100000))
            .andExpect(jsonPath("$.RecoveryEstimate.EstimatedFeeGold").value(5000))
            .andExpect(jsonPath("$.RecoveryEstimate.EstimatedRecoveryGold").value(95000))
            .andExpect(jsonPath("$.RecoveryEstimate.FeeRate").value(0.05))
            .andExpect(jsonPath("$.RecoveryEstimate.TradeCountStatus").value("unknown"))
            .andExpect(jsonPath("$.RecoveryEstimate.Caveat").isNotEmpty());
```

- [ ] **Step 2: Run RED**

Run:

```bash
cd backend && ./mvnw -Dtest=AccessoryRecoveryControllerTest test
```

Expected: FAIL until Task 2 implementation exists. If Task 2 is already complete, this may pass immediately; record that in task notes.

- [ ] **Step 3: Run GREEN**

Run:

```bash
cd backend && ./mvnw -Dtest=AccessoryRecoveryControllerTest test
```

Expected: PASS.

- [ ] **Step 4: Commit**

Run:

```bash
git add backend/src/test/java/com/rosaeng/sangdamso/efficiency/AccessoryRecoveryControllerTest.java
git commit -m "test: cover recovery fee response"
```

## Task 4: Surface Fee And Trade Count Hints In UI

**Files:**
- Modify: `components/AccessoryRecommendationPanel.jsx`

- [ ] **Step 1: Add UI formatting helpers**

Modify `components/AccessoryRecommendationPanel.jsx`.

Add helper function after `formatPercent`:

```jsx
function recoveryHint(recoveryEstimate) {
  const parts = [];
  const feeGold = valueOf(recoveryEstimate, ["EstimatedFeeGold", "estimatedFeeGold"], null);
  const tradeCountStatus = valueOf(recoveryEstimate, ["TradeCountStatus", "tradeCountStatus"], "");
  const tradeRemainCount = valueOf(recoveryEstimate, ["TradeRemainCount", "tradeRemainCount"], null);
  const caveat = valueOf(recoveryEstimate, ["Caveat", "caveat"], "");

  if (Number.isFinite(Number(feeGold)) && Number(feeGold) > 0) {
    parts.push(`수수료 ${formatGold(feeGold)} 차감`);
  }

  if (tradeCountStatus === "matched" && Number.isFinite(Number(tradeRemainCount))) {
    parts.push(`거래 ${tradeRemainCount}회 기준`);
  }

  if (caveat) {
    parts.push(caveat);
  }

  return parts.join(" · ");
}
```

- [ ] **Step 2: Update recovery box render**

Inside the ready recovery branch, replace:

```jsx
          <span>
            예상 회수가 {formatGold(recovery.RecoveryEstimate.EstimatedRecoveryGold)} · 순비용 기준 +1%당{" "}
            {formatGold(recovery.RecoveryEstimate.NetGoldPerOnePercentCombatPower)}
          </span>
```

with:

```jsx
          <span>
            예상 회수가 {formatGold(recovery.RecoveryEstimate.EstimatedRecoveryGold)} · 순비용 기준 +1%당{" "}
            {formatGold(recovery.RecoveryEstimate.NetGoldPerOnePercentCombatPower)}
            {recoveryHint(recovery.RecoveryEstimate) ? ` · ${recoveryHint(recovery.RecoveryEstimate)}` : ""}
          </span>
```

- [ ] **Step 3: Run frontend checks**

Run:

```bash
npm test
npm run lint
```

Expected: PASS.

- [ ] **Step 4: Commit**

Run:

```bash
git add components/AccessoryRecommendationPanel.jsx
git commit -m "feat: show recovery fee caveat"
```

## Task 5: Full Verification

**Files:**
- No file changes unless verification exposes a bug.

- [ ] **Step 1: Run focused backend tests**

Run:

```bash
cd backend && ./mvnw -Dtest=AccessoryRecoveryEstimateServiceTest,EquipmentNormalizerTest,AccessoryRecoveryControllerTest test
```

Expected: PASS.

- [ ] **Step 2: Run full backend tests**

Run:

```bash
cd backend && ./mvnw test
```

Expected: PASS.

- [ ] **Step 3: Run frontend tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 4: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 5: Run production build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 6: Final cleanliness checks**

Run:

```bash
git diff --check
git status --short
```

Expected:

- `git diff --check` prints no output.
- `git status --short` prints no output after all commits.
