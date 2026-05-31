# Accessory Recovery Approximation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a conservative dealer-only approximate accessory recovery estimate when exact active-auction evidence is unavailable or unstable.

**Architecture:** Keep exact recovery as the first path in `AccessoryRecoveryEstimateService`. Add a focused dealer-impact refinement signature helper to `AccessoryNormalizer`, then add an approximate path that filters by same impact signature and nearest main-stat band, uses the lowest active buy price, subtracts the existing 5% fee, and returns stable structured `Method`/`CaveatCode`/`Facts` fields. UI remains deterministic; richer natural-language variation stays in the future Sggu LLM layer.

**Tech Stack:** Java 21, Spring Boot 4 WebMVC, Jackson `JsonNode`, JUnit 5, AssertJ, MockMvc, React/Next.js, Node test runner.

---

## File Structure

- Modify `backend/src/main/java/com/rosaeng/sangdamso/efficiency/AccessoryNormalizer.java`
  - Add a public dealer-impact refinement signature helper used by recovery approximation.
- Modify `backend/src/test/java/com/rosaeng/sangdamso/efficiency/AccessoryNormalizerTest.java`
  - Cover dealer-impact signature extraction and ignored non-impact refinement lines.
- Modify `backend/src/main/java/com/rosaeng/sangdamso/efficiency/AccessoryRecoveryEstimateService.java`
  - Add `Method`, `CaveatCode`, and `Facts` metadata.
  - Add conservative approximate recovery path.
- Modify `backend/src/test/java/com/rosaeng/sangdamso/efficiency/AccessoryRecoveryEstimateServiceTest.java`
  - Cover exact metadata, approximate matching, ignored non-impact lines, trade count filtering, unavailable cases, and main-stat proximity.
- Modify `backend/src/test/java/com/rosaeng/sangdamso/efficiency/AccessoryRecoveryControllerTest.java`
  - Confirm endpoint exposes method/facts contract.
- Modify `components/AccessoryRecommendationPanel.jsx`
  - Show deterministic approximate caveat from `CaveatCode` while preserving existing recovery text.

## Task 1: Dealer Impact Refinement Signature

**Files:**
- Modify: `backend/src/test/java/com/rosaeng/sangdamso/efficiency/AccessoryNormalizerTest.java`
- Modify: `backend/src/main/java/com/rosaeng/sangdamso/efficiency/AccessoryNormalizer.java`

- [ ] **Step 1: Add failing signature tests**

Append these tests before `private JsonNode toJsonNode` in `AccessoryNormalizerTest`:

```java
    @Test
    void buildsDealerImpactRefinementSignatureAndIgnoresNonImpactLines() {
        JsonNode accessory = toJsonNode(orderedMap(
            "Type", "목걸이",
            "DetailSections", List.of(orderedMap(
                "title", "연마 효과",
                "lines", List.of(
                    "최대 생명력 +4000",
                    "추가 피해 +1.50%",
                    "적에게 주는 피해 +0.90%"
                )
            ))
        ));

        List<String> signature = normalizer.dealerImpactRefinementSignature(accessory);

        assertThat(signature).containsExactly("적에게 주는 피해 +0.90%", "추가 피해 +1.50%");
    }

    @Test
    void buildsDealerImpactRefinementSignatureForFlatAttackLines() {
        JsonNode accessory = toJsonNode(orderedMap(
            "Type", "귀걸이",
            "DetailSections", List.of(orderedMap(
                "title", "연마 효과",
                "lines", List.of(
                    "무기 공격력 +300",
                    "공격력 +1.55%",
                    "최대 생명력 +4000"
                )
            ))
        ));

        List<String> signature = normalizer.dealerImpactRefinementSignature(accessory);

        assertThat(signature).containsExactly("공격력 +1.55%", "무기 공격력 +300");
    }

    @Test
    void returnsEmptyDealerImpactSignatureWhenOnlyNonImpactLinesExist() {
        JsonNode accessory = toJsonNode(orderedMap(
            "Type", "반지",
            "DetailSections", List.of(orderedMap(
                "title", "연마 효과",
                "lines", List.of("최대 생명력 +4000", "방어력 +1200")
            ))
        ));

        assertThat(normalizer.dealerImpactRefinementSignature(accessory)).isEmpty();
    }
```

- [ ] **Step 2: Run RED**

Run:

```bash
cd backend && ./mvnw -Dtest=AccessoryNormalizerTest test
```

Expected: FAIL because `dealerImpactRefinementSignature` does not exist.

- [ ] **Step 3: Implement dealer-impact signature helper**

In `AccessoryNormalizer`, add this public method below `fingerprint`:

```java
    public List<String> dealerImpactRefinementSignature(JsonNode accessory) {
        String type = text(accessory, "Type", "type");
        List<String> signature = new ArrayList<>();

        for (String line : refinementLinesOf(accessory)) {
            String signatureLine = dealerImpactRefinementSignatureLine(type, line);

            if (!signatureLine.isBlank() && !signature.contains(signatureLine)) {
                signature.add(signatureLine);
            }
        }

        Collections.sort(signature);
        return signature;
    }
```

Add `java.util.Collections` import.

Add this private helper near `searchOptionForLine`:

```java
    private String dealerImpactRefinementSignatureLine(String type, String line) {
        String normalizedLine = line.replaceFirst("^(상|중|하)\\s+", "").replaceAll("\\s+", " ").trim();

        for (Rule rule : REFINEMENT_RULES) {
            if (!rule.type().isBlank() && !rule.type().equals(type)) {
                continue;
            }

            Matcher matcher = rule.pattern().matcher(normalizedLine);

            if (!matcher.find()) {
                continue;
            }

            double parsedValue = Double.parseDouble(matcher.group("value"));
            int normalizedValue = rule.percentage() ? (int) Math.round(parsedValue * 100) : (int) Math.round(parsedValue);
            String labelValue = rule.percentage() ? formatPercent(normalizedValue / 100.0) : formatWhole(normalizedValue);
            return rule.name() + " +" + labelValue;
        }

        return "";
    }
```

Do not add max HP, defense, recovery, shield, or supporter-only effects to `REFINEMENT_RULES`.

- [ ] **Step 4: Run GREEN**

Run:

```bash
cd backend && ./mvnw -Dtest=AccessoryNormalizerTest test
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add backend/src/main/java/com/rosaeng/sangdamso/efficiency/AccessoryNormalizer.java backend/src/test/java/com/rosaeng/sangdamso/efficiency/AccessoryNormalizerTest.java
git commit -m "feat: add dealer impact refinement signature"
```

## Task 2: Add Recovery Method Metadata

**Files:**
- Modify: `backend/src/test/java/com/rosaeng/sangdamso/efficiency/AccessoryRecoveryEstimateServiceTest.java`
- Modify: `backend/src/main/java/com/rosaeng/sangdamso/efficiency/AccessoryRecoveryEstimateService.java`

- [ ] **Step 1: Add failing metadata assertions**

In `buildsHighConfidenceEstimateFromStableExactMatches`, add:

```java
        assertThat(estimate.get("Method").asString()).isEqualTo("exact");
        assertThat(estimate.get("CaveatCode").isNull()).isTrue();
        assertThat(estimate.get("Facts").get("pricePolicy").asString()).isEqualTo("exactMedianActiveAuction");
        assertThat(estimate.get("Facts").get("feeRate").asDouble()).isEqualTo(0.05);
```

In `returnsZeroRecoveryWhenCurrentTradeRemainCountIsZero`, add:

```java
        assertThat(estimate.get("Method").asString()).isEqualTo("untradable");
        assertThat(estimate.get("CaveatCode").asString()).isEqualTo("UNTRADABLE");
        assertThat(estimate.get("Facts").get("pricePolicy").asString()).isEqualTo("none");
```

In `returnsLowConfidenceWhenRecommendationNumbersAreInvalid`, add:

```java
        assertThat(estimate.get("Method").asString()).isEqualTo("exact");
        assertThat(estimate.get("Facts").get("pricePolicy").asString()).isEqualTo("exactMedianActiveAuction");
```

- [ ] **Step 2: Run RED**

Run:

```bash
cd backend && ./mvnw -Dtest=AccessoryRecoveryEstimateServiceTest test
```

Expected: FAIL because metadata fields are missing.

- [ ] **Step 3: Add metadata constants and helper maps**

In `AccessoryRecoveryEstimateService`, add constants:

```java
    private static final String METHOD_EXACT = "exact";
    private static final String METHOD_UNTRADABLE = "untradable";
    private static final String CAVEAT_CODE_UNTRADABLE = "UNTRADABLE";
```

Add helper methods before `positiveInteger`:

```java
    private Map<String, Object> exactFacts() {
        return orderedMap(
            "pricePolicy", "exactMedianActiveAuction",
            "feeRate", SALE_FEE_RATE
        );
    }

    private Map<String, Object> untradableFacts() {
        return orderedMap(
            "role", "dealer",
            "pricePolicy", "none",
            "feeRate", SALE_FEE_RATE
        );
    }
```

Add `java.util.Map` import.

- [ ] **Step 4: Add metadata to exact, low-confidence, and untradable responses**

In the high-confidence exact response map, add after `"Status", "ready"`:

```java
            "Method", METHOD_EXACT,
```

Add before `"NetCostGold", netCost`:

```java
            "CaveatCode", null,
            "Facts", exactFacts(),
```

In `lowConfidenceEstimate`, add:

```java
            "Method", METHOD_EXACT,
```

and:

```java
            "CaveatCode", null,
            "Facts", exactFacts(),
```

In `untradableEstimate`, add:

```java
            "Method", METHOD_UNTRADABLE,
```

and:

```java
            "CaveatCode", CAVEAT_CODE_UNTRADABLE,
            "Facts", untradableFacts(),
```

Keep the existing `Caveat` string for deterministic UI compatibility.

- [ ] **Step 5: Run GREEN**

Run:

```bash
cd backend && ./mvnw -Dtest=AccessoryRecoveryEstimateServiceTest test
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add backend/src/main/java/com/rosaeng/sangdamso/efficiency/AccessoryRecoveryEstimateService.java backend/src/test/java/com/rosaeng/sangdamso/efficiency/AccessoryRecoveryEstimateServiceTest.java
git commit -m "feat: add recovery method metadata"
```

## Task 3: Conservative Approximate Recovery

**Files:**
- Modify: `backend/src/test/java/com/rosaeng/sangdamso/efficiency/AccessoryRecoveryEstimateServiceTest.java`
- Modify: `backend/src/main/java/com/rosaeng/sangdamso/efficiency/AccessoryRecoveryEstimateService.java`

- [ ] **Step 1: Add helper methods for approximate test fixtures**

In `AccessoryRecoveryEstimateServiceTest`, add these helpers before `private JsonNode toJsonNode`:

```java
    private JsonNode currentAccessoryWithRefinementLines(String... refinementLines) {
        return toJsonNode(orderedMap(
            "Type", "목걸이",
            "Name", "고대 목걸이",
            "Grade", "고대",
            "Tier", 4,
            "Quality", 91,
            "MainStatValue", 12000,
            "EnlightenmentPoint", 13,
            "DetailSections", List.of(
                orderedMap("title", "기본 효과", "lines", List.of("힘 +12000")),
                orderedMap("title", "연마 효과", "lines", List.of(refinementLines)),
                orderedMap("title", "아크 패시브 포인트 효과", "lines", List.of("깨달음 +13"))
            )
        ));
    }

    private JsonNode approximateCandidate(
        int buyPrice,
        int mainStatValue,
        Integer tradeRemainCount,
        String... refinementLines
    ) {
        return approximateCandidateWithGradeTier(
            buyPrice,
            mainStatValue,
            tradeRemainCount,
            "고대",
            4,
            refinementLines
        );
    }

    private JsonNode approximateCandidateWithGradeTier(
        int buyPrice,
        int mainStatValue,
        Integer tradeRemainCount,
        String grade,
        int tier,
        String... refinementLines
    ) {
        return toJsonNode(orderedMap(
            "Type", "목걸이",
            "Name", "고대 목걸이",
            "Grade", grade,
            "Tier", tier,
            "Quality", 80,
            "MainStatValue", mainStatValue,
            "EnlightenmentPoint", 12,
            "BuyPrice", buyPrice,
            "TradeRemainCount", tradeRemainCount,
            "DetailSections", List.of(
                orderedMap("title", "연마 효과", "lines", List.of(refinementLines))
            )
        ));
    }

    private JsonNode approximateCandidateWithoutMainStat(int buyPrice, String... refinementLines) {
        return toJsonNode(orderedMap(
            "Type", "목걸이",
            "Name", "고대 목걸이",
            "Grade", "고대",
            "Tier", 4,
            "Quality", 80,
            "EnlightenmentPoint", 12,
            "BuyPrice", buyPrice,
            "DetailSections", List.of(
                orderedMap("title", "연마 효과", "lines", List.of(refinementLines))
            )
        ));
    }
```

- [ ] **Step 2: Add failing approximate recovery tests and update changed expectations**

In `buildsHighConfidenceEstimateFromStableExactMatches`, add one low-priced approximate-only candidate to prove stable exact evidence still wins:

```java
                matchingCandidate(110000),
                differentCandidate(1000),
                approximateCandidate(1000, 12000, null, "추가 피해 +1.50%")
```

Replace `returnsLowConfidenceWhenExactMatchEvidenceIsInsufficient` with:

```java
    @Test
    void approximatesWhenExactMatchEvidenceIsInsufficient() {
        JsonNode estimate = service.build(
            currentAccessory(),
            toJsonNode(List.of(matchingCandidate(100000), differentCandidate(90000))),
            toJsonNode(orderedMap("BuyPrice", 160000, "CombatPowerGainPercent", 1.5))
        );

        assertThat(estimate.get("Status").asString()).isEqualTo("ready");
        assertThat(estimate.get("Method").asString()).isEqualTo("approximateImpactRefinement");
        assertThat(estimate.get("Confidence").asString()).isEqualTo("low");
        assertThat(estimate.get("EvidenceCount").asInt()).isEqualTo(1);
        assertThat(estimate.get("EstimatedGrossRecoveryGold").asInt()).isEqualTo(100000);
        assertThat(estimate.get("EstimatedFeeGold").asInt()).isEqualTo(5000);
        assertThat(estimate.get("EstimatedRecoveryGold").asInt()).isEqualTo(95000);
        assertThat(estimate.get("NetCostGold").asInt()).isEqualTo(65000);
        assertThat(estimate.get("Facts").get("pricePolicy").asString()).isEqualTo("minimumNearMainStatActiveAuction");
    }
```

Replace `knownTradeRemainCountCanLowerConfidenceWhenEvidenceIsSparse` with:

```java
    @Test
    void approximatesKnownTradeRemainCountWhenExactEvidenceIsSparse() {
        JsonNode estimate = service.build(
            currentAccessoryWithTradeCount(2),
            toJsonNode(List.of(
                matchingCandidate(90000, 2),
                matchingCandidate(110000, 2),
                matchingCandidate(50000, 1),
                matchingCandidate(60000, 1)
            )),
            toJsonNode(orderedMap("BuyPrice", 160000, "CombatPowerGainPercent", 1.5))
        );

        assertThat(estimate.get("Status").asString()).isEqualTo("ready");
        assertThat(estimate.get("Method").asString()).isEqualTo("approximateImpactRefinement");
        assertThat(estimate.get("Confidence").asString()).isEqualTo("low");
        assertThat(estimate.get("EvidenceCount").asInt()).isEqualTo(2);
        assertThat(estimate.get("EstimatedGrossRecoveryGold").asInt()).isEqualTo(90000);
        assertThat(estimate.get("EstimatedRecoveryGold").asInt()).isEqualTo(85500);
        assertThat(estimate.get("NetCostGold").asInt()).isEqualTo(74500);
        assertThat(estimate.get("TradeCountStatus").asString()).isEqualTo("matched");
        assertThat(estimate.get("TradeRemainCount").asInt()).isEqualTo(2);
    }
```

Replace `returnsLowConfidenceWhenPriceSpreadIsWide` with:

```java
    @Test
    void approximatesWhenExactMatchPriceSpreadIsWide() {
        JsonNode estimate = service.build(
            currentAccessory(),
            toJsonNode(List.of(
                matchingCandidate(10000),
                matchingCandidate(100000),
                matchingCandidate(200000)
            )),
            toJsonNode(orderedMap("BuyPrice", 250000, "CombatPowerGainPercent", 2.0))
        );

        assertThat(estimate.get("Status").asString()).isEqualTo("ready");
        assertThat(estimate.get("Method").asString()).isEqualTo("approximateImpactRefinement");
        assertThat(estimate.get("Confidence").asString()).isEqualTo("conservative");
        assertThat(estimate.get("EvidenceCount").asInt()).isEqualTo(3);
        assertThat(estimate.get("EstimatedGrossRecoveryGold").asInt()).isEqualTo(10000);
        assertThat(estimate.get("EstimatedRecoveryGold").asInt()).isEqualTo(9500);
        assertThat(estimate.get("NetGoldPerOnePercentCombatPower").asInt()).isEqualTo(120250);
    }
```

Append these new tests before helper methods:

```java
    @Test
    void approximatesRecoveryFromSameDealerImpactSignatureAndNearestMainStatBand() {
        JsonNode estimate = service.build(
            currentAccessoryWithRefinementLines("추가 피해 +1.50%", "최대 생명력 +4000"),
            toJsonNode(List.of(
                approximateCandidate(86000, 12100, null, "최대 생명력 +5000", "추가 피해 +1.50%"),
                approximateCandidate(79000, 12080, null, "추가 피해 +1.50%"),
                approximateCandidate(83000, 12120, null, "추가 피해 +1.50%", "방어력 +1200"),
                approximateCandidate(1000, 14000, null, "추가 피해 +1.50%"),
                approximateCandidate(5000, 12000, null, "추가 피해 +2.60%")
            )),
            toJsonNode(orderedMap("BuyPrice", 160000, "CombatPowerGainPercent", 1.5))
        );

        assertThat(estimate.get("Status").asString()).isEqualTo("ready");
        assertThat(estimate.get("Method").asString()).isEqualTo("approximateImpactRefinement");
        assertThat(estimate.get("Confidence").asString()).isEqualTo("conservative");
        assertThat(estimate.get("EvidenceCount").asInt()).isEqualTo(3);
        assertThat(estimate.get("EstimatedGrossRecoveryGold").asInt()).isEqualTo(79000);
        assertThat(estimate.get("EstimatedFeeGold").asInt()).isEqualTo(3950);
        assertThat(estimate.get("EstimatedRecoveryGold").asInt()).isEqualTo(75050);
        assertThat(estimate.get("CaveatCode").asString()).isEqualTo("APPROXIMATE_IMPACT_REFINEMENT");
        assertThat(estimate.get("Facts").get("pricePolicy").asString()).isEqualTo("minimumNearMainStatActiveAuction");
        assertThat(estimate.get("Facts").get("impactRefinementSignature").get(0).asString()).isEqualTo("추가 피해 +1.50%");
        assertThat(estimate.get("Facts").get("mainStatDelta").asInt()).isEqualTo(80);
        assertThat(estimate.get("Facts").get("nearMainStatThreshold").asInt()).isEqualTo(120);
    }

    @Test
    void approximateRecoveryUsesLowConfidenceWhenOnlyOneNearCandidateExists() {
        JsonNode estimate = service.build(
            currentAccessoryWithRefinementLines("추가 피해 +1.50%"),
            toJsonNode(List.of(
                approximateCandidate(82000, 12100, null, "추가 피해 +1.50%"),
                approximateCandidate(1000, 14000, null, "추가 피해 +1.50%")
            )),
            toJsonNode(orderedMap("BuyPrice", 160000, "CombatPowerGainPercent", 1.5))
        );

        assertThat(estimate.get("Status").asString()).isEqualTo("ready");
        assertThat(estimate.get("Method").asString()).isEqualTo("approximateImpactRefinement");
        assertThat(estimate.get("Confidence").asString()).isEqualTo("low");
        assertThat(estimate.get("EvidenceCount").asInt()).isEqualTo(1);
        assertThat(estimate.get("EstimatedGrossRecoveryGold").asInt()).isEqualTo(82000);
    }

    @Test
    void approximateRecoveryExcludesCandidatesWithoutMainStat() {
        JsonNode estimate = service.build(
            currentAccessoryWithRefinementLines("추가 피해 +1.50%"),
            toJsonNode(List.of(
                approximateCandidateWithoutMainStat(1000, "추가 피해 +1.50%"),
                approximateCandidate(90000, 12080, null, "추가 피해 +1.50%")
            )),
            toJsonNode(orderedMap("BuyPrice", 160000, "CombatPowerGainPercent", 1.5))
        );

        assertThat(estimate.get("Method").asString()).isEqualTo("approximateImpactRefinement");
        assertThat(estimate.get("EvidenceCount").asInt()).isEqualTo(1);
        assertThat(estimate.get("EstimatedGrossRecoveryGold").asInt()).isEqualTo(90000);
    }

    @Test
    void approximateRecoveryFiltersByKnownGradeAndTier() {
        JsonNode estimate = service.build(
            currentAccessoryWithRefinementLines("추가 피해 +1.50%"),
            toJsonNode(List.of(
                approximateCandidateWithGradeTier(1000, 12080, null, "유물", 4, "추가 피해 +1.50%"),
                approximateCandidateWithGradeTier(2000, 12080, null, "고대", 3, "추가 피해 +1.50%"),
                approximateCandidate(90000, 12080, null, "추가 피해 +1.50%")
            )),
            toJsonNode(orderedMap("BuyPrice", 160000, "CombatPowerGainPercent", 1.5))
        );

        assertThat(estimate.get("Method").asString()).isEqualTo("approximateImpactRefinement");
        assertThat(estimate.get("EvidenceCount").asInt()).isEqualTo(1);
        assertThat(estimate.get("EstimatedGrossRecoveryGold").asInt()).isEqualTo(90000);
    }

    @Test
    void approximateRecoveryFiltersByKnownTradeRemainCount() {
        JsonNode estimate = service.build(
            currentAccessoryWithTradeCount(2),
            toJsonNode(List.of(
                approximateCandidate(50000, 12080, 1, "추가 피해 +1.50%"),
                approximateCandidate(90000, 12080, 2, "추가 피해 +1.50%")
            )),
            toJsonNode(orderedMap("BuyPrice", 160000, "CombatPowerGainPercent", 1.5))
        );

        assertThat(estimate.get("Method").asString()).isEqualTo("approximateImpactRefinement");
        assertThat(estimate.get("EstimatedGrossRecoveryGold").asInt()).isEqualTo(90000);
        assertThat(estimate.get("TradeCountStatus").asString()).isEqualTo("matched");
        assertThat(estimate.get("Facts").get("tradeCountMatched").asBoolean()).isTrue();
    }

    @Test
    void returnsUnavailableWhenCurrentImpactSignatureIsEmpty() {
        JsonNode estimate = service.build(
            currentAccessoryWithRefinementLines("최대 생명력 +4000"),
            toJsonNode(List.of(approximateCandidate(90000, 12080, null, "최대 생명력 +5000"))),
            toJsonNode(orderedMap("BuyPrice", 160000, "CombatPowerGainPercent", 1.5))
        );

        assertThat(estimate.get("Status").asString()).isEqualTo("lowConfidence");
        assertThat(estimate.get("Method").asString()).isEqualTo("unavailable");
        assertThat(estimate.get("EstimatedRecoveryGold").isNull()).isTrue();
        assertThat(estimate.get("CaveatCode").asString()).isEqualTo("NO_APPROXIMATE_EVIDENCE");
    }

    @Test
    void returnsUnavailableWhenCurrentMainStatIsMissingForApproximation() {
        JsonNode current = toJsonNode(orderedMap(
            "Type", "목걸이",
            "Name", "고대 목걸이",
            "Quality", 91,
            "DetailSections", List.of(
                orderedMap("title", "연마 효과", "lines", List.of("추가 피해 +1.50%"))
            )
        ));

        JsonNode estimate = service.build(
            current,
            toJsonNode(List.of(approximateCandidate(90000, 12080, null, "추가 피해 +1.50%"))),
            toJsonNode(orderedMap("BuyPrice", 160000, "CombatPowerGainPercent", 1.5))
        );

        assertThat(estimate.get("Method").asString()).isEqualTo("unavailable");
        assertThat(estimate.get("EstimatedRecoveryGold").isNull()).isTrue();
    }
```

Exact stable, untradable, invalid-recommendation, and fee-rounding tests should still pass; the sparse and unstable exact-evidence tests now expect approximate estimates.

- [ ] **Step 3: Run RED**

Run:

```bash
cd backend && ./mvnw -Dtest=AccessoryRecoveryEstimateServiceTest test
```

Expected: FAIL because approximate method/facts are not implemented.

- [ ] **Step 4: Add approximate constants and records**

In `AccessoryRecoveryEstimateService`, add constants:

```java
    private static final String METHOD_APPROXIMATE = "approximateImpactRefinement";
    private static final String METHOD_UNAVAILABLE = "unavailable";
    private static final String CAVEAT_CODE_APPROXIMATE = "APPROXIMATE_IMPACT_REFINEMENT";
    private static final String CAVEAT_CODE_NO_APPROXIMATE_EVIDENCE = "NO_APPROXIMATE_EVIDENCE";
    private static final String APPROXIMATE_CAVEAT = "완전 동일 매물이 없어 딜러 전투력 영향 연마효과와 거래횟수가 같은 유사 주스탯 매물의 최저가로 보수 추정했어.";
```

Add records near existing records:

```java
    private record EstimateBasis(
        String method,
        String confidence,
        int evidenceCount,
        Integer grossRecoveryGold,
        String caveatCode,
        String caveat,
        Map<String, Object> facts
    ) {
    }

    private record ApproximateCandidate(int buyPrice, int mainStatDelta) {
    }
```

- [ ] **Step 5: Refactor exact summary to retain prices**

Change `Summary` record to:

```java
    private record Summary(int count, Integer medianPrice, Integer interquartileRange, List<Integer> prices) {
    }
```

Update every `new Summary(...)` call:

```java
return new Summary(0, null, null, List.of());
```

and:

```java
return new Summary(prices.size(), medianPrice, interquartileRange, List.copyOf(prices));
```

- [ ] **Step 6: Add main-stat and unavailable helpers**

Add helpers before `positiveInteger`:

```java
    private JsonNode unavailableEstimate(TradeContext tradeContext) {
        return toJsonNode(orderedMap(
            "Status", "lowConfidence",
            "Method", METHOD_UNAVAILABLE,
            "Confidence", "low",
            "EvidenceCount", 0,
            "EstimatedGrossRecoveryGold", null,
            "EstimatedFeeGold", null,
            "EstimatedRecoveryGold", null,
            "FeeRate", SALE_FEE_RATE,
            "TradeCountStatus", tradeContext.status(),
            "TradeRemainCount", tradeContext.tradeRemainCount(),
            "CaveatCode", CAVEAT_CODE_NO_APPROXIMATE_EVIDENCE,
            "Caveat", tradeContext.caveat(),
            "NetCostGold", null,
            "NetGoldPerOnePercentCombatPower", null,
            "Facts", orderedMap(
                "role", "dealer",
                "pricePolicy", "none",
                "feeRate", SALE_FEE_RATE
            )
        ));
    }

    private Integer mainStatValue(JsonNode accessory) {
        Integer value = positiveInteger(accessory, "MainStatValue", "mainStatValue");
        return value == null ? sectionValue(accessory, "기본 효과") : value;
    }

    private boolean matchesKnownGradeAndTier(JsonNode currentAccessory, JsonNode candidate) {
        String currentGrade = text(currentAccessory, "Grade", "grade");

        if (!currentGrade.isBlank() && !currentGrade.equals(text(candidate, "Grade", "grade"))) {
            return false;
        }

        Integer currentTier = nonNegativeInteger(currentAccessory, "Tier", "tier");

        if (currentTier != null && !currentTier.equals(nonNegativeInteger(candidate, "Tier", "tier"))) {
            return false;
        }

        return true;
    }

    private Integer sectionValue(JsonNode accessory, String sectionTitle) {
        for (JsonNode section : arrayItems(child(accessory, "DetailSections"))) {
            String title = text(section, "title", "Title");

            if (!sectionTitle.equals(title)) {
                continue;
            }

            Integer value = firstLineValue(section, "lines");

            if (value != null) {
                return value;
            }

            return firstLineValue(section, "Lines");
        }

        return null;
    }

    private Integer firstLineValue(JsonNode section, String field) {
        List<JsonNode> lines = arrayItems(child(section, field));

        if (lines.isEmpty()) {
            return null;
        }

        return positiveIntegerFromText(lines.get(0).asString());
    }

    private Integer positiveIntegerFromText(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        Matcher matcher = Pattern.compile("\\+\\s*(?<value>\\d+(?:,\\d{3})*)").matcher(value);

        if (!matcher.find()) {
            return null;
        }

        try {
            return Integer.parseInt(matcher.group("value").replace(",", ""));
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private String text(JsonNode node, String... keys) {
        if (node == null || node.isNull()) {
            return "";
        }

        for (String key : keys) {
            JsonNode value = child(node, key);

            if (value != null && !value.isNull() && !value.asString().isBlank()) {
                return value.asString();
            }
        }

        return "";
    }
```

Add imports:

```java
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
```

- [ ] **Step 7: Implement approximate basis**

Add this helper before numeric parsing methods:

```java
    private EstimateBasis approximateBasis(
        JsonNode currentAccessory,
        JsonNode auctionCandidates,
        Integer currentTradeRemainCount,
        TradeContext tradeContext,
        Summary exactSummary
    ) {
        List<String> currentSignature = normalizer.dealerImpactRefinementSignature(currentAccessory);
        Integer currentMainStat = mainStatValue(currentAccessory);

        if (currentSignature.isEmpty() || currentMainStat == null) {
            return null;
        }

        List<ApproximateCandidate> candidates = new ArrayList<>();

        for (JsonNode candidate : arrayItems(auctionCandidates)) {
            Integer buyPrice = positiveInteger(candidate, "BuyPrice", "buyPrice");
            Integer candidateMainStat = mainStatValue(candidate);

            if (buyPrice == null || candidateMainStat == null) {
                continue;
            }

            if (!text(currentAccessory, "Type", "type").equals(text(candidate, "Type", "type"))) {
                continue;
            }

            if (!matchesKnownGradeAndTier(currentAccessory, candidate)) {
                continue;
            }

            if (currentTradeRemainCount != null) {
                Integer candidateTradeRemainCount = nonNegativeInteger(candidate, "TradeRemainCount", "tradeRemainCount");

                if (!currentTradeRemainCount.equals(candidateTradeRemainCount)) {
                    continue;
                }
            }

            if (!currentSignature.equals(normalizer.dealerImpactRefinementSignature(candidate))) {
                continue;
            }

            candidates.add(new ApproximateCandidate(buyPrice, Math.abs(candidateMainStat - currentMainStat)));
        }

        if (candidates.isEmpty()) {
            return null;
        }

        int minDelta = candidates.stream().mapToInt(ApproximateCandidate::mainStatDelta).min().orElse(0);
        int nearThreshold = Math.max(minDelta, Math.toIntExact(Math.round(currentMainStat * 0.01)));
        List<ApproximateCandidate> nearCandidates = candidates.stream()
            .filter(candidate -> candidate.mainStatDelta() <= nearThreshold)
            .toList();

        if (nearCandidates.isEmpty()) {
            return null;
        }

        int approxGross = nearCandidates.stream().mapToInt(ApproximateCandidate::buyPrice).min().orElse(0);
        Integer exactSparseGross = exactSummary.prices().isEmpty()
            ? null
            : exactSummary.prices().stream().mapToInt(Integer::intValue).min().orElse(approxGross);
        boolean usedExactSparseCeiling = exactSparseGross != null && exactSparseGross < approxGross;
        int grossRecoveryGold = usedExactSparseCeiling ? exactSparseGross : approxGross;
        int selectedMainStatDelta = nearCandidates.stream()
            .filter(candidate -> candidate.buyPrice() == approxGross)
            .mapToInt(ApproximateCandidate::mainStatDelta)
            .min()
            .orElse(minDelta);

        return new EstimateBasis(
            METHOD_APPROXIMATE,
            nearCandidates.size() >= 3 ? "conservative" : "low",
            nearCandidates.size(),
            grossRecoveryGold,
            CAVEAT_CODE_APPROXIMATE,
            APPROXIMATE_CAVEAT,
            orderedMap(
                "role", "dealer",
                "pricePolicy", "minimumNearMainStatActiveAuction",
                "impactRefinementSignature", currentSignature,
                "exactSparseEvidenceCount", exactSummary.count(),
                "usedExactSparseCeiling", usedExactSparseCeiling,
                "mainStatDelta", selectedMainStatDelta,
                "nearMainStatThreshold", nearThreshold,
                "tradeCountMatched", currentTradeRemainCount != null,
                "feeRate", SALE_FEE_RATE
            )
        );
    }
```

- [ ] **Step 8: Wire basis selection into `build`**

In `build`, replace the current `stableSpread` / `highConfidence` block through the old `if (!highConfidence) { return lowConfidenceEstimate(summary, tradeContext); }` branch with:

```java
        boolean stableSpread = summary.medianPrice() != null
            && summary.medianPrice() > 0
            && summary.interquartileRange() != null
            && summary.interquartileRange() / (double) summary.medianPrice() <= 0.35;
        boolean highConfidence = summary.count() >= 3 && stableSpread;
        EstimateBasis basis = highConfidence
            ? new EstimateBasis(METHOD_EXACT, "high", summary.count(), summary.medianPrice(), null, tradeContext.caveat(), exactFacts())
            : approximateBasis(currentAccessory, auctionCandidates, currentTradeRemainCount, tradeContext, summary);

        if (basis == null) {
            return unavailableEstimate(tradeContext);
        }
```

Then replace direct exact `Recovery recovery = recovery(summary.medianPrice())` usage with `basis.grossRecoveryGold()`.

For invalid recommendation numbers, return a low-confidence response for the selected basis:

```java
        if (buyPrice == null || gainPercent == null) {
            return estimateWithoutNetCost(basis, tradeContext);
        }
```

Add `estimateWithoutNetCost`:

```java
    private JsonNode estimateWithoutNetCost(EstimateBasis basis, TradeContext tradeContext) {
        Recovery recovery = recovery(basis.grossRecoveryGold());

        return toJsonNode(orderedMap(
            "Status", "lowConfidence",
            "Method", basis.method(),
            "Confidence", "low",
            "EvidenceCount", basis.evidenceCount(),
            "EstimatedGrossRecoveryGold", recovery.grossRecoveryGold(),
            "EstimatedFeeGold", recovery.feeGold(),
            "EstimatedRecoveryGold", recovery.netRecoveryGold(),
            "FeeRate", SALE_FEE_RATE,
            "TradeCountStatus", tradeContext.status(),
            "TradeRemainCount", tradeContext.tradeRemainCount(),
            "CaveatCode", basis.caveatCode(),
            "Caveat", basis.caveat(),
            "NetCostGold", null,
            "NetGoldPerOnePercentCombatPower", null,
            "Facts", basis.facts()
        ));
    }
```

For valid recommendation numbers, return:

```java
        Recovery recovery = recovery(basis.grossRecoveryGold());
        long netCost = Math.max(0L, Math.round(buyPrice) - recovery.netRecoveryGold());

        return toJsonNode(orderedMap(
            "Status", "ready",
            "Method", basis.method(),
            "Confidence", basis.confidence(),
            "EvidenceCount", basis.evidenceCount(),
            "EstimatedGrossRecoveryGold", recovery.grossRecoveryGold(),
            "EstimatedFeeGold", recovery.feeGold(),
            "EstimatedRecoveryGold", recovery.netRecoveryGold(),
            "FeeRate", SALE_FEE_RATE,
            "TradeCountStatus", tradeContext.status(),
            "TradeRemainCount", tradeContext.tradeRemainCount(),
            "CaveatCode", basis.caveatCode(),
            "Caveat", basis.caveat(),
            "NetCostGold", netCost,
            "NetGoldPerOnePercentCombatPower", Math.round(netCost / gainPercent),
            "Facts", basis.facts()
        ));
```

Keep `untradableEstimate` separate.

- [ ] **Step 9: Run GREEN**

Run:

```bash
cd backend && ./mvnw -Dtest=AccessoryRecoveryEstimateServiceTest test
```

Expected: PASS.

- [ ] **Step 10: Commit**

Run:

```bash
git add backend/src/main/java/com/rosaeng/sangdamso/efficiency/AccessoryRecoveryEstimateService.java backend/src/test/java/com/rosaeng/sangdamso/efficiency/AccessoryRecoveryEstimateServiceTest.java
git commit -m "feat: estimate approximate accessory recovery"
```

## Task 4: Controller And UI Contract

**Files:**
- Modify: `backend/src/test/java/com/rosaeng/sangdamso/efficiency/AccessoryRecoveryControllerTest.java`
- Modify: `components/AccessoryRecommendationPanel.jsx`

- [ ] **Step 1: Add controller metadata assertions**

In `returnsRecoveryEstimate`, after `RecoveryEstimate.Status`, add:

```java
            .andExpect(jsonPath("$.RecoveryEstimate.Method").value("exact"))
            .andExpect(jsonPath("$.RecoveryEstimate.Facts.pricePolicy").value("exactMedianActiveAuction"))
```

After `RecoveryEstimate.Caveat`, add:

```java
            .andExpect(jsonPath("$.RecoveryEstimate.CaveatCode").value(nullValue()));
```

Add this static import:

```java
import static org.hamcrest.Matchers.nullValue;
```

- [ ] **Step 2: Run controller RED**

Run:

```bash
cd backend && ./mvnw -Dtest=AccessoryRecoveryControllerTest test
```

Expected: FAIL until Task 3 implementation is present. If Task 3 is already complete, this may pass immediately.

- [ ] **Step 3: Update deterministic UI hint**

In `components/AccessoryRecommendationPanel.jsx`, update `recoveryHint` to read `CaveatCode`:

```jsx
  const caveatCode = valueOf(recoveryEstimate, ["CaveatCode", "caveatCode"], "");
```

Add this before the existing `if (caveat)` block:

```jsx
  if (caveatCode === "APPROXIMATE_IMPACT_REFINEMENT" && !caveat) {
    parts.push("유사 조건 매물 최저가 기준");
  }
```

Keep the existing `Caveat` display path so backend-provided deterministic caveats still render.

- [ ] **Step 4: Run frontend checks**

Run:

```bash
npm test
npm run lint
```

Expected: PASS.

- [ ] **Step 5: Run controller GREEN**

Run:

```bash
cd backend && ./mvnw -Dtest=AccessoryRecoveryControllerTest test
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add backend/src/test/java/com/rosaeng/sangdamso/efficiency/AccessoryRecoveryControllerTest.java components/AccessoryRecommendationPanel.jsx
git commit -m "feat: surface recovery method metadata"
```

## Task 5: Full Verification

**Files:**
- No planned file changes.

- [ ] **Step 1: Run focused backend tests**

Run:

```bash
cd backend && ./mvnw -Dtest=AccessoryNormalizerTest,AccessoryRecoveryEstimateServiceTest,AccessoryRecoveryControllerTest test
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
