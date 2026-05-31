# Spring API Ownership Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the remaining efficiency API behavior from Next.js API routes to Spring Boot, delete stale Next API routes, and update docs/proxy defaults so Next.js is UI-only.

**Architecture:** Spring Boot remains the API and domain engine. The existing Java accessory auction search and normalizer services are extended for recovery estimation, and a new Spring controller preserves the current browser-facing recovery contract. Next.js keeps same-origin fetch paths and proxies migrated paths to Spring in local development.

**Tech Stack:** Java 21, Spring Boot 4 WebMVC, Jackson `JsonNode`, JUnit 5, AssertJ, MockMvc, Next.js rewrites, Node test runner.

---

## File Structure

- Create `backend/src/main/java/com/rosaeng/sangdamso/efficiency/AccessoryRecoveryEstimateService.java`
  - Ports JavaScript recovery estimate logic into focused Java service.
- Create `backend/src/test/java/com/rosaeng/sangdamso/efficiency/AccessoryRecoveryEstimateServiceTest.java`
  - Covers percentile, exact-match median/IQR, high confidence, and low confidence behavior.
- Modify `backend/src/main/java/com/rosaeng/sangdamso/efficiency/AccessoryNormalizer.java`
  - Adds fingerprint fallback from `DetailSections` for equipped accessories that do not have explicit numeric fields.
- Modify `backend/src/test/java/com/rosaeng/sangdamso/efficiency/AccessoryNormalizerTest.java`
  - Locks fingerprint parity between explicit numeric fields and detail-section-only fields.
- Modify `backend/src/main/java/com/rosaeng/sangdamso/efficiency/AccessoryAuctionSearchService.java`
  - Adds `eligibleOnly` overload so spec-up recommendations keep filtering while recovery can use broader auction evidence.
- Modify `backend/src/test/java/com/rosaeng/sangdamso/efficiency/AccessoryAuctionSearchServiceTest.java`
  - Covers default eligible filtering and recovery evidence search.
- Create `backend/src/main/java/com/rosaeng/sangdamso/efficiency/AccessoryRecoveryController.java`
  - Owns `POST /api/efficiency/accessories/recovery`.
- Create `backend/src/test/java/com/rosaeng/sangdamso/efficiency/AccessoryRecoveryControllerTest.java`
  - Covers validation, success, auth error mapping, and upstream error mapping.
- Delete `app/api/efficiency/accessories/[name]/route.js`
  - Stale Next.js route for accessory-only recommendation.
- Delete `app/api/efficiency/accessories/recovery/route.js`
  - Replaced by Spring recovery controller.
- Delete `tests/accessoryEfficiencyApi.test.js`
  - It imports the deleted Next route file.
- Modify `next.config.mjs`
  - Adds default Spring rewrite paths for all migrated APIs.
- Modify `README.md`
  - Updates architecture and local dev commands.
- Modify `docs/backend-api-ownership.md`
  - Marks all active app APIs as Spring-owned.

## Task 1: Port Recovery Estimate Service

**Files:**
- Create: `backend/src/test/java/com/rosaeng/sangdamso/efficiency/AccessoryRecoveryEstimateServiceTest.java`
- Create: `backend/src/main/java/com/rosaeng/sangdamso/efficiency/AccessoryRecoveryEstimateService.java`

- [ ] **Step 1: Write the failing recovery estimate tests**

Create `backend/src/test/java/com/rosaeng/sangdamso/efficiency/AccessoryRecoveryEstimateServiceTest.java`:

```java
package com.rosaeng.sangdamso.efficiency;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.orderedMap;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class AccessoryRecoveryEstimateServiceTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final AccessoryRecoveryEstimateService service = new AccessoryRecoveryEstimateService(new AccessoryNormalizer());

    @Test
    void interpolatesPercentiles() {
        assertThat(service.percentile(List.of(100, 200, 300, 400), 0.5)).isEqualTo(250.0);
        assertThat(service.percentile(List.of(100, 200, 300, 400), 0.25)).isEqualTo(175.0);
        assertThat(service.percentile(List.of(100, 200, 300, 400), 0.75)).isEqualTo(325.0);
        assertThat(service.percentile(List.of(), 0.5)).isNull();
    }

    @Test
    void buildsHighConfidenceEstimateFromStableExactMatches() {
        JsonNode estimate = service.build(
            currentAccessory(),
            toJsonNode(List.of(
                matchingCandidate(90000),
                matchingCandidate(100000),
                matchingCandidate(110000),
                differentCandidate(1000)
            )),
            toJsonNode(orderedMap("BuyPrice", 160000, "CombatPowerGainPercent", 1.5))
        );

        assertThat(estimate.get("Status").asString()).isEqualTo("ready");
        assertThat(estimate.get("Confidence").asString()).isEqualTo("high");
        assertThat(estimate.get("EvidenceCount").asInt()).isEqualTo(3);
        assertThat(estimate.get("EstimatedRecoveryGold").asInt()).isEqualTo(100000);
        assertThat(estimate.get("NetCostGold").asInt()).isEqualTo(60000);
        assertThat(estimate.get("NetGoldPerOnePercentCombatPower").asInt()).isEqualTo(40000);
    }

    @Test
    void returnsLowConfidenceWhenExactMatchEvidenceIsInsufficient() {
        JsonNode estimate = service.build(
            currentAccessory(),
            toJsonNode(List.of(matchingCandidate(100000), differentCandidate(90000))),
            toJsonNode(orderedMap("BuyPrice", 160000, "CombatPowerGainPercent", 1.5))
        );

        assertThat(estimate.get("Status").asString()).isEqualTo("lowConfidence");
        assertThat(estimate.get("Confidence").asString()).isEqualTo("low");
        assertThat(estimate.get("EvidenceCount").asInt()).isEqualTo(1);
        assertThat(estimate.get("EstimatedRecoveryGold").asInt()).isEqualTo(100000);
        assertThat(estimate.get("NetCostGold").isNull()).isTrue();
    }

    @Test
    void returnsLowConfidenceWhenPriceSpreadIsWide() {
        JsonNode estimate = service.build(
            currentAccessory(),
            toJsonNode(List.of(
                matchingCandidate(10000),
                matchingCandidate(100000),
                matchingCandidate(200000)
            )),
            toJsonNode(orderedMap("BuyPrice", 250000, "CombatPowerGainPercent", 2.0))
        );

        assertThat(estimate.get("Status").asString()).isEqualTo("lowConfidence");
        assertThat(estimate.get("Confidence").asString()).isEqualTo("low");
        assertThat(estimate.get("EvidenceCount").asInt()).isEqualTo(3);
        assertThat(estimate.get("NetGoldPerOnePercentCombatPower").isNull()).isTrue();
    }

    @Test
    void returnsLowConfidenceWhenRecommendationNumbersAreInvalid() {
        JsonNode estimate = service.build(
            currentAccessory(),
            toJsonNode(List.of(
                matchingCandidate(90000),
                matchingCandidate(100000),
                matchingCandidate(110000)
            )),
            toJsonNode(orderedMap("BuyPrice", 0, "CombatPowerGainPercent", 1.5))
        );

        assertThat(estimate.get("Status").asString()).isEqualTo("lowConfidence");
        assertThat(estimate.get("EvidenceCount").asInt()).isEqualTo(3);
        assertThat(estimate.get("NetCostGold").isNull()).isTrue();
    }

    private JsonNode currentAccessory() {
        return toJsonNode(orderedMap(
            "Type", "목걸이",
            "Name", "고대 목걸이",
            "Quality", 91,
            "MainStatValue", 12000,
            "EnlightenmentPoint", 13,
            "DetailSections", List.of(
                orderedMap("title", "기본 효과", "lines", List.of("힘 +12000")),
                orderedMap("title", "연마 효과", "lines", List.of("추가 피해 +1.50%")),
                orderedMap("title", "아크 패시브 포인트 효과", "lines", List.of("깨달음 +13"))
            )
        ));
    }

    private JsonNode matchingCandidate(int buyPrice) {
        return toJsonNode(orderedMap(
            "Type", "목걸이",
            "Name", "고대 목걸이",
            "Quality", 91,
            "MainStatValue", 12000,
            "EnlightenmentPoint", 13,
            "BuyPrice", buyPrice,
            "DetailSections", List.of(
                orderedMap("title", "연마 효과", "lines", List.of("추가 피해 +1.50%"))
            )
        ));
    }

    private JsonNode differentCandidate(int buyPrice) {
        return toJsonNode(orderedMap(
            "Type", "목걸이",
            "Name", "고대 목걸이",
            "Quality", 91,
            "MainStatValue", 12000,
            "EnlightenmentPoint", 13,
            "BuyPrice", buyPrice,
            "DetailSections", List.of(
                orderedMap("title", "연마 효과", "lines", List.of("추가 피해 +2.60%"))
            )
        ));
    }

    private JsonNode toJsonNode(Object value) {
        return objectMapper.convertValue(value, JsonNode.class);
    }
}
```

- [ ] **Step 2: Run RED**

Run:

```bash
cd backend && ./mvnw -Dtest=AccessoryRecoveryEstimateServiceTest test
```

Expected: FAIL at compile time because `AccessoryRecoveryEstimateService` does not exist.

- [ ] **Step 3: Implement the recovery estimate service**

Create `backend/src/main/java/com/rosaeng/sangdamso/efficiency/AccessoryRecoveryEstimateService.java`:

```java
package com.rosaeng.sangdamso.efficiency;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.arrayItems;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.child;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.orderedMap;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.toJsonNode;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

@Service
public class AccessoryRecoveryEstimateService {

    private final AccessoryNormalizer normalizer;

    public AccessoryRecoveryEstimateService(AccessoryNormalizer normalizer) {
        this.normalizer = normalizer;
    }

    public JsonNode build(JsonNode currentAccessory, JsonNode auctionCandidates, JsonNode recommendation) {
        Summary summary = summarizeExactMatchPrices(currentAccessory, auctionCandidates);
        boolean stableSpread = summary.medianPrice() != null
            && summary.medianPrice() > 0
            && summary.interquartileRange() != null
            && summary.interquartileRange() / (double) summary.medianPrice() <= 0.35;
        boolean highConfidence = summary.count() >= 3 && stableSpread;

        if (!highConfidence) {
            return lowConfidenceEstimate(summary);
        }

        Double buyPrice = positiveNumber(recommendation, "BuyPrice", "buyPrice");
        Double gainPercent = positiveNumber(recommendation, "CombatPowerGainPercent", "combatPowerGainPercent");

        if (buyPrice == null || gainPercent == null) {
            return lowConfidenceEstimate(summary);
        }

        long netCost = Math.max(0L, Math.round(buyPrice) - summary.medianPrice());

        return toJsonNode(orderedMap(
            "Status", "ready",
            "Confidence", "high",
            "EvidenceCount", summary.count(),
            "EstimatedRecoveryGold", summary.medianPrice(),
            "NetCostGold", netCost,
            "NetGoldPerOnePercentCombatPower", Math.round(netCost / gainPercent)
        ));
    }

    Double percentile(List<Integer> sortedValues, double ratio) {
        if (sortedValues == null || sortedValues.isEmpty()) {
            return null;
        }

        double index = (sortedValues.size() - 1) * ratio;
        int lowerIndex = (int) Math.floor(index);
        int upperIndex = (int) Math.ceil(index);

        if (lowerIndex == upperIndex) {
            return sortedValues.get(lowerIndex).doubleValue();
        }

        double lowerValue = sortedValues.get(lowerIndex);
        double upperValue = sortedValues.get(upperIndex);
        return lowerValue + (upperValue - lowerValue) * (index - lowerIndex);
    }

    private Summary summarizeExactMatchPrices(JsonNode currentAccessory, JsonNode auctionCandidates) {
        if (currentAccessory == null || currentAccessory.isNull()) {
            return new Summary(0, null, null);
        }

        String currentFingerprint = normalizer.fingerprint(currentAccessory);
        List<Integer> prices = new ArrayList<>();

        for (JsonNode candidate : arrayItems(auctionCandidates)) {
            if (!currentFingerprint.equals(normalizer.fingerprint(candidate))) {
                continue;
            }

            Integer buyPrice = positiveInteger(candidate, "BuyPrice", "buyPrice");

            if (buyPrice != null) {
                prices.add(buyPrice);
            }
        }

        Collections.sort(prices);

        Double median = percentile(prices, 0.5);
        Double firstQuartile = percentile(prices, 0.25);
        Double thirdQuartile = percentile(prices, 0.75);
        Integer medianPrice = median == null ? null : Math.toIntExact(Math.round(median));
        Integer interquartileRange = firstQuartile == null || thirdQuartile == null
            ? null
            : Math.toIntExact(Math.round(thirdQuartile - firstQuartile));

        return new Summary(prices.size(), medianPrice, interquartileRange);
    }

    private JsonNode lowConfidenceEstimate(Summary summary) {
        return toJsonNode(orderedMap(
            "Status", "lowConfidence",
            "Confidence", "low",
            "EvidenceCount", summary.count(),
            "EstimatedRecoveryGold", summary.medianPrice(),
            "NetCostGold", null,
            "NetGoldPerOnePercentCombatPower", null
        ));
    }

    private Integer positiveInteger(JsonNode node, String... keys) {
        Double value = positiveNumber(node, keys);

        return value == null ? null : Math.toIntExact(Math.round(value));
    }

    private Double positiveNumber(JsonNode node, String... keys) {
        if (node == null || node.isNull()) {
            return null;
        }

        for (String key : keys) {
            JsonNode value = child(node, key);

            if (value == null || value.isNull()) {
                continue;
            }

            Double number = null;

            if (value.isNumber()) {
                number = value.asDouble();
            } else {
                try {
                    number = Double.parseDouble(value.asString().replace(",", "").trim());
                } catch (NumberFormatException exception) {
                    number = null;
                }
            }

            if (number != null && Double.isFinite(number) && number > 0) {
                return number;
            }
        }

        return null;
    }

    private record Summary(int count, Integer medianPrice, Integer interquartileRange) {
    }
}
```

- [ ] **Step 4: Run GREEN for recovery estimate service**

Run:

```bash
cd backend && ./mvnw -Dtest=AccessoryRecoveryEstimateServiceTest test
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add backend/src/main/java/com/rosaeng/sangdamso/efficiency/AccessoryRecoveryEstimateService.java backend/src/test/java/com/rosaeng/sangdamso/efficiency/AccessoryRecoveryEstimateServiceTest.java
git commit -m "feat: port accessory recovery estimate"
```

## Task 2: Add Fingerprint Detail-Section Fallback

**Files:**
- Modify: `backend/src/test/java/com/rosaeng/sangdamso/efficiency/AccessoryNormalizerTest.java`
- Modify: `backend/src/main/java/com/rosaeng/sangdamso/efficiency/AccessoryNormalizer.java`

- [ ] **Step 1: Add failing fingerprint parity test**

Append this test to `backend/src/test/java/com/rosaeng/sangdamso/efficiency/AccessoryNormalizerTest.java`:

```java
    @Test
    void fingerprintFallsBackToDetailSectionValues() {
        JsonNode explicit = toJsonNode(orderedMap(
            "Type", "목걸이",
            "Name", "고대 목걸이",
            "Quality", 91,
            "MainStatValue", 12000,
            "EnlightenmentPoint", 13,
            "DetailSections", List.of(
                orderedMap("title", "연마 효과", "lines", List.of("추가 피해 +1.50%"))
            )
        ));
        JsonNode detailOnly = toJsonNode(orderedMap(
            "Type", "목걸이",
            "Name", "고대 목걸이",
            "Quality", 91,
            "DetailSections", List.of(
                orderedMap("title", "기본 효과", "lines", List.of("힘 +12,000")),
                orderedMap("title", "연마 효과", "lines", List.of("추가 피해 +1.50%")),
                orderedMap("title", "아크 패시브 포인트 효과", "lines", List.of("깨달음 +13"))
            )
        ));

        assertThat(normalizer.fingerprint(detailOnly)).isEqualTo(normalizer.fingerprint(explicit));
    }
```

- [ ] **Step 2: Run RED**

Run:

```bash
cd backend && ./mvnw -Dtest=AccessoryNormalizerTest test
```

Expected: FAIL because detail-only fingerprint uses `0` for missing `MainStatValue` and `EnlightenmentPoint`.

- [ ] **Step 3: Update `AccessoryNormalizer` fingerprint fallback**

Modify `backend/src/main/java/com/rosaeng/sangdamso/efficiency/AccessoryNormalizer.java`.

Add this import:

```java
import java.util.Optional;
```

Add this field near the existing `Pattern` constants:

```java
    private static final Pattern SECTION_VALUE_PATTERN = Pattern.compile("\\+\\s*(?<value>\\d+(?:,\\d{3})*(?:\\.\\d+)?)");
```

Replace the existing `fingerprint` method with:

```java
    public String fingerprint(JsonNode accessory) {
        return String.join("|",
            text(accessory, "Type", "type"),
            text(accessory, "Name", "name"),
            String.valueOf(intValue(accessory, "Quality", "quality")),
            String.valueOf(resolvedMainStatValue(accessory)),
            String.valueOf(resolvedEnlightenmentPoint(accessory)),
            refinementLinesOf(accessory).toString()
        );
    }
```

Add these helper methods below `fingerprint`:

```java
    private int resolvedMainStatValue(JsonNode accessory) {
        int value = intValue(accessory, "MainStatValue", "mainStatValue");

        return value > 0 ? value : sectionValue(accessory, "기본 효과").orElse(0);
    }

    private int resolvedEnlightenmentPoint(JsonNode accessory) {
        int value = intValue(accessory, "EnlightenmentPoint", "enlightenmentPoint");

        return value > 0 ? value : sectionValue(accessory, "아크 패시브 포인트 효과").orElse(0);
    }

    private Optional<Integer> sectionValue(JsonNode accessory, String sectionTitle) {
        for (JsonNode section : arrayItems(child(accessory, "DetailSections"))) {
            String title = text(section, "title", "Title");

            if (!sectionTitle.equals(title)) {
                continue;
            }

            Optional<Integer> value = firstLineValue(section, "lines");

            if (value.isPresent()) {
                return value;
            }

            return firstLineValue(section, "Lines");
        }

        return Optional.empty();
    }

    private Optional<Integer> firstLineValue(JsonNode section, String field) {
        List<JsonNode> lines = arrayItems(child(section, field));

        if (lines.isEmpty()) {
            return Optional.empty();
        }

        Matcher matcher = SECTION_VALUE_PATTERN.matcher(lines.get(0).asString());

        if (!matcher.find()) {
            return Optional.empty();
        }

        return Optional.of((int) Math.round(Double.parseDouble(matcher.group("value").replace(",", ""))));
    }
```

- [ ] **Step 4: Run GREEN for normalizer tests**

Run:

```bash
cd backend && ./mvnw -Dtest=AccessoryNormalizerTest test
```

Expected: PASS.

- [ ] **Step 5: Run recovery estimate tests again**

Run:

```bash
cd backend && ./mvnw -Dtest=AccessoryRecoveryEstimateServiceTest test
```

Expected: PASS, including exact-match tests that depend on fingerprint fallback.

- [ ] **Step 6: Commit**

Run:

```bash
git add backend/src/main/java/com/rosaeng/sangdamso/efficiency/AccessoryNormalizer.java backend/src/test/java/com/rosaeng/sangdamso/efficiency/AccessoryNormalizerTest.java
git commit -m "fix: match accessory recovery fingerprints"
```

## Task 3: Add Recovery Auction Search Mode

**Files:**
- Modify: `backend/src/test/java/com/rosaeng/sangdamso/efficiency/AccessoryAuctionSearchServiceTest.java`
- Modify: `backend/src/main/java/com/rosaeng/sangdamso/efficiency/AccessoryAuctionSearchService.java`

- [ ] **Step 1: Add failing eligible-only tests**

Append this test to `backend/src/test/java/com/rosaeng/sangdamso/efficiency/AccessoryAuctionSearchServiceTest.java`:

```java
    @Test
    void recoverySearchCanKeepIneligibleAuctionEvidence() {
        LostarkApiClient client = new LostarkApiClient(
            new LostarkProperties("token", "", "https://example.com", 5, 0),
            (method, path, authorization, body) -> ineligibleAuctionPage()
        );
        AccessoryAuctionSearchService service = new AccessoryAuctionSearchService(client, new AccessoryNormalizer());
        JsonNode currentAccessory = toJsonNode(orderedMap(
            "Type", "목걸이",
            "DetailSections", List.of(orderedMap("title", "연마 효과", "lines", List.of("추가 피해 +1.50%")))
        ));

        AccessoryAuctionSearchService.SearchResult defaultResult = service.searchAccessoryCandidates("목걸이", currentAccessory, 6, false);
        AccessoryAuctionSearchService.SearchResult recoveryResult = service.searchAccessoryCandidates(
            "목걸이",
            currentAccessory,
            6,
            false,
            false
        );

        assertThat(defaultResult.items()).isEmpty();
        assertThat(recoveryResult.items()).hasSize(1);
        assertThat(recoveryResult.items().get(0).get("BuyPrice").asInt()).isEqualTo(7777);
    }
```

Append this helper to the same test class:

```java
    private JsonNode ineligibleAuctionPage() {
        return toJsonNode(orderedMap(
            "TotalCount", 1,
            "Items", List.of(orderedMap(
                "Name", "저품질 목걸이",
                "Icon", "https://example.com/icon.png",
                "Grade", "고대",
                "GradeQuality", 70,
                "Tier", 4,
                "Level", 1700,
                "AuctionInfo", orderedMap(
                    "BuyPrice", 7777,
                    "UpgradeLevel", 3,
                    "TradeAllowCount", 2,
                    "EndDate", "2026-05-29T00:00:00Z"
                ),
                "Options", List.of(
                    orderedMap("Type", "STAT", "OptionName", "힘", "Value", 12000, "IsValuePercentage", false),
                    orderedMap("Type", "ACCESSORY_UPGRADE", "OptionName", "추가 피해", "Value", 1.5, "IsValuePercentage", true),
                    orderedMap("Type", "ARK_PASSIVE", "OptionName", "깨달음", "Value", 13, "IsValuePercentage", false)
                )
            ))
        ));
    }
```

- [ ] **Step 2: Run RED**

Run:

```bash
cd backend && ./mvnw -Dtest=AccessoryAuctionSearchServiceTest test
```

Expected: FAIL at compile time because the five-argument overload does not exist.

- [ ] **Step 3: Add the `eligibleOnly` overload**

Modify `backend/src/main/java/com/rosaeng/sangdamso/efficiency/AccessoryAuctionSearchService.java`.

Replace the current method signature:

```java
    public SearchResult searchAccessoryCandidates(String type, JsonNode currentAccessory, int equipmentIndex, boolean forceRefresh) {
```

with:

```java
    public SearchResult searchAccessoryCandidates(String type, JsonNode currentAccessory, int equipmentIndex, boolean forceRefresh) {
        return searchAccessoryCandidates(type, currentAccessory, equipmentIndex, forceRefresh, true);
    }

    public SearchResult searchAccessoryCandidates(
        String type,
        JsonNode currentAccessory,
        int equipmentIndex,
        boolean forceRefresh,
        boolean eligibleOnly
    ) {
```

Inside the candidate loop, replace:

```java
                if (!normalizer.isEligibleAccessoryCandidate(candidate).eligible()) {
                    continue;
                }
```

with:

```java
                if (eligibleOnly && !normalizer.isEligibleAccessoryCandidate(candidate).eligible()) {
                    continue;
                }
```

The rest of the method body remains the existing implementation.

- [ ] **Step 4: Run GREEN for auction search tests**

Run:

```bash
cd backend && ./mvnw -Dtest=AccessoryAuctionSearchServiceTest test
```

Expected: PASS.

- [ ] **Step 5: Run spec-up service test**

Run:

```bash
cd backend && ./mvnw -Dtest=SpecUpEfficiencyServiceTest test
```

Expected: PASS. This confirms the existing four-argument spec-up call still uses eligible filtering.

- [ ] **Step 6: Commit**

Run:

```bash
git add backend/src/main/java/com/rosaeng/sangdamso/efficiency/AccessoryAuctionSearchService.java backend/src/test/java/com/rosaeng/sangdamso/efficiency/AccessoryAuctionSearchServiceTest.java
git commit -m "feat: add accessory recovery auction mode"
```

## Task 4: Add Spring Recovery Controller

**Files:**
- Create: `backend/src/test/java/com/rosaeng/sangdamso/efficiency/AccessoryRecoveryControllerTest.java`
- Create: `backend/src/main/java/com/rosaeng/sangdamso/efficiency/AccessoryRecoveryController.java`

- [ ] **Step 1: Write the failing controller tests**

Create `backend/src/test/java/com/rosaeng/sangdamso/efficiency/AccessoryRecoveryControllerTest.java`:

```java
package com.rosaeng.sangdamso.efficiency;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.orderedMap;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.rosaeng.sangdamso.common.GlobalExceptionHandler;
import com.rosaeng.sangdamso.lostark.LostarkApiErrorCode;
import com.rosaeng.sangdamso.lostark.LostarkApiException;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@WebMvcTest(AccessoryRecoveryController.class)
@Import({GlobalExceptionHandler.class, AccessoryRecoveryControllerTest.TestConfig.class})
class AccessoryRecoveryControllerTest {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private FakeAccessoryAuctionSearchService auctionSearchService;

    @BeforeEach
    void reset() {
        auctionSearchService.reset();
    }

    @Test
    void rejectsInvalidRecoveryRequest() throws Exception {
        mockMvc.perform(post("/api/efficiency/accessories/recovery")
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(orderedMap(
                    "CurrentAccessory", orderedMap("Type", "팔찌"),
                    "Recommendation", orderedMap("BuyPrice", 1000, "CombatPowerGainPercent", 1.2)
                ))))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_RECOVERY_REQUEST"));
    }

    @Test
    void returnsRecoveryEstimate() throws Exception {
        mockMvc.perform(post("/api/efficiency/accessories/recovery")
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(validRequest(true))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.UpdatedAt").value("2026-05-31T00:00:00Z"))
            .andExpect(jsonPath("$.SearchSummary.Type").value("목걸이"))
            .andExpect(jsonPath("$.SearchSummary.CandidateCount").value(3))
            .andExpect(jsonPath("$.RecoveryEstimate.Status").value("ready"))
            .andExpect(jsonPath("$.RecoveryEstimate.EstimatedRecoveryGold").value(100000));

        assertThat(auctionSearchService.type).isEqualTo("목걸이");
        assertThat(auctionSearchService.forceRefresh).isTrue();
        assertThat(auctionSearchService.eligibleOnly).isFalse();
    }

    @Test
    void mapsMissingApiKey() throws Exception {
        auctionSearchService.exception = new LostarkApiException(
            LostarkApiErrorCode.AUTH_ERROR,
            null,
            "Missing authorization."
        );

        mockMvc.perform(post("/api/efficiency/accessories/recovery")
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(validRequest(false))))
            .andExpect(status().isInternalServerError())
            .andExpect(jsonPath("$.code").value("MISSING_API_KEY"));
    }

    @Test
    void mapsLostarkAuctionFailure() throws Exception {
        auctionSearchService.exception = new LostarkApiException(
            LostarkApiErrorCode.UPSTREAM_ERROR,
            502,
            "Lostark failed."
        );

        mockMvc.perform(post("/api/efficiency/accessories/recovery")
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(validRequest(false))))
            .andExpect(status().isBadGateway())
            .andExpect(jsonPath("$.code").value("LOSTARK_API_ERROR"));
    }

    private static Object validRequest(boolean forceRefresh) {
        return orderedMap(
            "CurrentAccessory", orderedMap(
                "Type", "목걸이",
                "Name", "고대 목걸이",
                "Quality", 91,
                "DetailSections", List.of(
                    orderedMap("title", "기본 효과", "lines", List.of("힘 +12000")),
                    orderedMap("title", "연마 효과", "lines", List.of("추가 피해 +1.50%")),
                    orderedMap("title", "아크 패시브 포인트 효과", "lines", List.of("깨달음 +13"))
                )
            ),
            "Recommendation", orderedMap("BuyPrice", 160000, "CombatPowerGainPercent", 1.5),
            "ForceRefresh", forceRefresh
        );
    }

    private static String toJson(Object value) throws Exception {
        return OBJECT_MAPPER.writeValueAsString(value);
    }

    private static JsonNode toJsonNode(Object value) {
        return OBJECT_MAPPER.convertValue(value, JsonNode.class);
    }

    @TestConfiguration
    static class TestConfig {

        @Bean
        FakeAccessoryAuctionSearchService accessoryAuctionSearchService() {
            return new FakeAccessoryAuctionSearchService();
        }

        @Bean
        AccessoryRecoveryEstimateService accessoryRecoveryEstimateService() {
            return new AccessoryRecoveryEstimateService(new AccessoryNormalizer());
        }
    }

    static class FakeAccessoryAuctionSearchService extends AccessoryAuctionSearchService {

        private RuntimeException exception;
        private String type;
        private boolean forceRefresh;
        private boolean eligibleOnly = true;

        FakeAccessoryAuctionSearchService() {
            super(null, null);
        }

        @Override
        public SearchResult searchAccessoryCandidates(
            String type,
            JsonNode currentAccessory,
            int equipmentIndex,
            boolean forceRefresh,
            boolean eligibleOnly
        ) {
            this.type = type;
            this.forceRefresh = forceRefresh;
            this.eligibleOnly = eligibleOnly;

            if (exception != null) {
                throw exception;
            }

            return new SearchResult(
                type,
                List.of(
                    matchingCandidate(90000),
                    matchingCandidate(100000),
                    matchingCandidate(110000)
                ),
                List.of("추가 피해 1.50% 이상"),
                3,
                "2026-05-31T00:00:00Z"
            );
        }

        void reset() {
            exception = null;
            type = "";
            forceRefresh = false;
            eligibleOnly = true;
        }

        private JsonNode matchingCandidate(int buyPrice) {
            return toJsonNode(orderedMap(
                "Type", "목걸이",
                "Name", "고대 목걸이",
                "Quality", 91,
                "MainStatValue", 12000,
                "EnlightenmentPoint", 13,
                "BuyPrice", buyPrice,
                "DetailSections", List.of(
                    orderedMap("title", "연마 효과", "lines", List.of("추가 피해 +1.50%"))
                )
            ));
        }
    }
}
```

- [ ] **Step 2: Run RED**

Run:

```bash
cd backend && ./mvnw -Dtest=AccessoryRecoveryControllerTest test
```

Expected: FAIL at compile time because `AccessoryRecoveryController` does not exist.

- [ ] **Step 3: Implement the Spring recovery controller**

Create `backend/src/main/java/com/rosaeng/sangdamso/efficiency/AccessoryRecoveryController.java`:

```java
package com.rosaeng.sangdamso.efficiency;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.child;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.orderedMap;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.toJsonNode;

import com.rosaeng.sangdamso.common.BffException;
import com.rosaeng.sangdamso.lostark.LostarkApiErrorCode;
import com.rosaeng.sangdamso.lostark.LostarkApiException;
import java.util.List;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/api/efficiency/accessories")
public class AccessoryRecoveryController {

    private static final Set<String> SUPPORTED_ACCESSORY_TYPES = Set.of("목걸이", "귀걸이", "반지");

    private final AccessoryAuctionSearchService auctionSearchService;
    private final AccessoryRecoveryEstimateService recoveryEstimateService;

    public AccessoryRecoveryController(
        AccessoryAuctionSearchService auctionSearchService,
        AccessoryRecoveryEstimateService recoveryEstimateService
    ) {
        this.auctionSearchService = auctionSearchService;
        this.recoveryEstimateService = recoveryEstimateService;
    }

    @PostMapping("/recovery")
    public JsonNode recover(@RequestBody(required = false) JsonNode body) {
        JsonNode currentAccessory = child(body, "CurrentAccessory");
        JsonNode recommendation = child(body, "Recommendation");
        String type = text(currentAccessory, "Type", "type");

        if (
            !SUPPORTED_ACCESSORY_TYPES.contains(type)
                || positiveNumber(recommendation, "BuyPrice", "buyPrice") == null
                || positiveNumber(recommendation, "CombatPowerGainPercent", "combatPowerGainPercent") == null
        ) {
            throw invalidRecoveryRequest();
        }

        try {
            AccessoryAuctionSearchService.SearchResult searchResult = auctionSearchService.searchAccessoryCandidates(
                type,
                currentAccessory,
                -1,
                bool(body, "ForceRefresh", "forceRefresh"),
                false
            );
            JsonNode recoveryEstimate = recoveryEstimateService.build(
                currentAccessory,
                toJsonNode(searchResult.items()),
                recommendation
            );

            return toJsonNode(orderedMap(
                "UpdatedAt", searchResult.updatedAt(),
                "SearchSummary", orderedMap(
                    "Type", searchResult.type(),
                    "SearchOptions", searchResult.searchOptions(),
                    "CandidateCount", searchResult.items().size(),
                    "PagesFetched", searchResult.pagesFetched()
                ),
                "RecoveryEstimate", recoveryEstimate
            ));
        } catch (LostarkApiException exception) {
            if (exception.getCode() == LostarkApiErrorCode.AUTH_ERROR) {
                throw new BffException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "MISSING_API_KEY",
                    "공식 Lostark Open API 키가 필요해."
                );
            }

            throw new BffException(
                HttpStatus.BAD_GATEWAY,
                "LOSTARK_API_ERROR",
                "현재 악세 예상 회수가를 계산하지 못했어."
            );
        }
    }

    private BffException invalidRecoveryRequest() {
        return new BffException(
            HttpStatus.BAD_REQUEST,
            "INVALID_RECOVERY_REQUEST",
            "회수가 추정에 필요한 추천 결과가 없어."
        );
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

    private boolean bool(JsonNode node, String... keys) {
        if (node == null || node.isNull()) {
            return false;
        }

        for (String key : keys) {
            JsonNode value = child(node, key);

            if (value == null || value.isNull()) {
                continue;
            }

            if (value.isBoolean()) {
                return value.asBoolean();
            }

            if ("true".equalsIgnoreCase(value.asString()) || "1".equals(value.asString())) {
                return true;
            }
        }

        return false;
    }

    private Double positiveNumber(JsonNode node, String... keys) {
        if (node == null || node.isNull()) {
            return null;
        }

        for (String key : keys) {
            JsonNode value = child(node, key);

            if (value == null || value.isNull()) {
                continue;
            }

            Double number = null;

            if (value.isNumber()) {
                number = value.asDouble();
            } else {
                try {
                    number = Double.parseDouble(value.asString().replace(",", "").trim());
                } catch (NumberFormatException exception) {
                    number = null;
                }
            }

            if (number != null && Double.isFinite(number) && number > 0) {
                return number;
            }
        }

        return null;
    }
}
```

- [ ] **Step 4: Run GREEN for controller tests**

Run:

```bash
cd backend && ./mvnw -Dtest=AccessoryRecoveryControllerTest test
```

Expected: PASS.

- [ ] **Step 5: Run focused backend efficiency tests**

Run:

```bash
cd backend && ./mvnw -Dtest=AccessoryRecoveryControllerTest,AccessoryRecoveryEstimateServiceTest,AccessoryAuctionSearchServiceTest,AccessoryNormalizerTest,SpecUpEfficiencyServiceTest test
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add backend/src/main/java/com/rosaeng/sangdamso/efficiency/AccessoryRecoveryController.java backend/src/test/java/com/rosaeng/sangdamso/efficiency/AccessoryRecoveryControllerTest.java
git commit -m "feat: add spring accessory recovery api"
```

## Task 5: Delete Remaining Next.js API Routes

**Files:**
- Delete: `app/api/efficiency/accessories/[name]/route.js`
- Delete: `app/api/efficiency/accessories/recovery/route.js`
- Delete: `tests/accessoryEfficiencyApi.test.js`

- [ ] **Step 1: Remove the stale route files and direct route import test**

Delete:

```bash
app/api/efficiency/accessories/[name]/route.js
app/api/efficiency/accessories/recovery/route.js
tests/accessoryEfficiencyApi.test.js
```

- [ ] **Step 2: Confirm no code imports the deleted route files**

Run:

```bash
rg -n "app/api/efficiency/accessories|accessoryEfficiencyApi|getRecommendation|postRecovery" app components lib tests
```

Expected: No output.

- [ ] **Step 3: Confirm UI still calls same-origin API paths**

Run:

```bash
rg -n "/api/efficiency/(spec-up|accessories/recovery)" components app
```

Expected: output includes:

```text
components/CombatPowerEfficiencyPage.jsx:...fetch("/api/efficiency/accessories/recovery"...
components/CombatPowerEfficiencyPage.jsx:...fetch(`/api/efficiency/spec-up/${encodeURIComponent(normalizedName)}`...
```

- [ ] **Step 4: Run frontend tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add app/api/efficiency/accessories/[name]/route.js app/api/efficiency/accessories/recovery/route.js tests/accessoryEfficiencyApi.test.js
git commit -m "chore: remove next efficiency api routes"
```

## Task 6: Update Proxy Defaults and Documentation

**Files:**
- Modify: `next.config.mjs`
- Modify: `README.md`
- Modify: `docs/backend-api-ownership.md`

- [ ] **Step 1: Update `next.config.mjs` default migrated paths**

Replace the top of `next.config.mjs`:

```js
const springApiBaseUrl = process.env.SPRING_API_BASE_URL || "http://127.0.0.1:8080";

const migratedApiPaths = (process.env.SPRING_API_PATHS || "")
  .split(",")
  .map((path) => path.trim())
  .filter(Boolean);
```

with:

```js
const springApiBaseUrl = process.env.SPRING_API_BASE_URL || "http://127.0.0.1:8080";

const defaultMigratedApiPaths = [
  "/api/characters/:path*",
  "/api/market/snapshot",
  "/api/consult/sggu",
  "/api/efficiency/spec-up/:path*",
  "/api/efficiency/accessories/recovery"
];

const configuredApiPaths = process.env.SPRING_API_PATHS;
const migratedApiPaths = (configuredApiPaths ? configuredApiPaths.split(",") : defaultMigratedApiPaths)
  .map((path) => path.trim())
  .filter(Boolean);
```

- [ ] **Step 2: Update README architecture wording and commands**

In `README.md`, replace this paragraph:

```markdown
현재는 Spring Boot가 캐릭터 조회, 거래소 스냅샷, 슥구 상담 BFF를 담당하고 Next.js는 화면 렌더링과 아직 이관 전인 효율 계산 API Route를 담당한다. 앞으로는 BFF, 캐시, 분석 엔진, 로컬 LLM 런타임을 분리한 모듈러 모놀리스 구조로 확장한다.
```

with:

```markdown
현재는 Next.js가 화면 렌더링을 담당하고, Spring Boot가 브라우저-facing API, 공식 Lostark API 연동, 시장 데이터, 전투력/스펙업 계산, 슥구 상담 BFF를 담당한다. 앞으로는 Spring Boot 안에서 캐시, 저장소, 분석 엔진, 로컬 LLM 런타임을 분리한 모듈러 모놀리스 구조로 확장한다.
```

In the development command block, replace:

```markdown
SPRING_API_PATHS=/api/characters/:path*,/api/market/snapshot,/api/consult/sggu npm run dev
```

with:

```markdown
npm run dev
```

In the local LLM smoke test block, replace:

```markdown
SPRING_API_PATHS=/api/characters/:path*,/api/market/snapshot,/api/consult/sggu npm run dev
```

with:

```markdown
npm run dev
```

In the Spring Boot backend section, replace the migrated path list:

```markdown
- `GET /api/characters/{name}`
- `GET /api/market/snapshot`
- `POST /api/consult/sggu`
```

with:

```markdown
- `GET /api/characters/{name}`
- `GET /api/market/snapshot`
- `POST /api/consult/sggu`
- `GET /api/efficiency/spec-up/{name}`
- `POST /api/efficiency/accessories/recovery`
```

Replace the proxy paragraph:

````markdown
Next.js renders UI and proxies migrated `/api/*` paths to Spring Boot in local development:

```bash
SPRING_API_PATHS=/api/characters/:path*,/api/market/snapshot,/api/consult/sggu npm run dev
```
````

with:

````markdown
Next.js renders UI and proxies migrated `/api/*` paths to Spring Boot in local development. The default rewrite list already includes all Spring-owned API paths:

```bash
npm run dev
```

Use `SPRING_API_PATHS` only when temporarily overriding the default proxy list.
````

- [ ] **Step 3: Update ownership documentation**

Replace the content of `docs/backend-api-ownership.md` with:

```markdown
# Backend API Ownership

Date: 2026-05-31

| Browser Path | Active Owner | Target Owner | Migration State |
| --- | --- | --- | --- |
| `/api/characters/{name}` | Spring Boot | Spring Boot | Spring owner active |
| `/api/market/snapshot` | Spring Boot | Spring Boot | Spring owner active |
| `/api/consult/sggu` | Spring Boot | Spring Boot | Spring owner active |
| `/api/efficiency/spec-up/{name}` | Spring Boot | Spring Boot | Spring owner active; Next route removed |
| `/api/efficiency/accessories/recovery` | Spring Boot | Spring Boot | Spring owner active; Next route removed |

Rules:

- UI code calls browser-facing same-origin paths only.
- One active owner per path.
- Spring Boot becomes active owner only after parity tests and smoke checks pass.
- Replaced Next.js API route files are deleted after Spring Boot ownership is active.
- Next.js currently owns no API route behavior; it renders the UI and proxies Spring-owned API paths in local development.
```

- [ ] **Step 4: Run docs/proxy checks**

Run:

```bash
rg -n "SPRING_API_PATHS=/api/characters|아직 이관 전|Next.js API Route|Next.js.*효율 계산" README.md docs next.config.mjs
```

Expected: No outdated references.

Run:

```bash
node -e "import('./next.config.mjs').then(({default:c})=>c.rewrites().then((r)=>console.log(r.beforeFiles.map((x)=>x.source).join('\\n'))))"
```

Expected output includes:

```text
/api/characters/:path*
/api/market/snapshot
/api/consult/sggu
/api/efficiency/spec-up/:path*
/api/efficiency/accessories/recovery
```

- [ ] **Step 5: Commit**

Run:

```bash
git add next.config.mjs README.md docs/backend-api-ownership.md
git commit -m "docs: finalize spring api ownership"
```

## Task 7: Full Verification

**Files:**
- No file changes unless verification exposes a bug.

- [ ] **Step 1: Run backend test suite**

Run:

```bash
cd backend && ./mvnw test
```

Expected: PASS.

- [ ] **Step 2: Run frontend test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 4: Run production build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Check whitespace and final diff**

Run:

```bash
git diff --check
git status --short
```

Expected:

- `git diff --check` prints no output.
- `git status --short` shows no unstaged files after all task commits.

- [ ] **Step 6: Optional local smoke check without real Lostark API calls**

Run:

```bash
cd backend && ./mvnw spring-boot:run
```

In a second terminal, run:

```bash
npm run dev
```

Visit:

```text
http://127.0.0.1:3000/efficiency
```

Expected:

- Page renders.
- API calls route through Next rewrites to Spring.
- Without `LOSTARK_API_KEY`, API responses return JSON error contracts rather than HTML 404s.

Stop both dev servers before finishing the task.
