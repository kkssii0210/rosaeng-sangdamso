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
        assertThat(estimate.get("EstimatedGrossRecoveryGold").asInt()).isEqualTo(100000);
        assertThat(estimate.get("EstimatedFeeGold").asInt()).isEqualTo(5000);
        assertThat(estimate.get("EstimatedRecoveryGold").asInt()).isEqualTo(95000);
        assertThat(estimate.get("FeeRate").asDouble()).isEqualTo(0.05);
        assertThat(estimate.get("TradeCountStatus").asString()).isEqualTo("unknown");
        assertThat(estimate.get("TradeRemainCount").isNull()).isTrue();
        assertThat(estimate.get("Caveat").asString()).contains("거래 가능 횟수");
        assertThat(estimate.get("NetCostGold").asInt()).isEqualTo(65000);
        assertThat(estimate.get("NetGoldPerOnePercentCombatPower").asInt()).isEqualTo(43333);
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
        assertThat(estimate.get("EstimatedGrossRecoveryGold").asInt()).isEqualTo(100000);
        assertThat(estimate.get("EstimatedFeeGold").asInt()).isEqualTo(5000);
        assertThat(estimate.get("EstimatedRecoveryGold").asInt()).isEqualTo(95000);
        assertThat(estimate.get("NetCostGold").isNull()).isTrue();
    }

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
        assertThat(estimate.get("Confidence").asString()).isEqualTo("high");
        assertThat(estimate.get("EvidenceCount").asInt()).isEqualTo(3);
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
                matchingCandidate(110000, 2),
                matchingCandidate(50000, 1),
                matchingCandidate(60000, 1)
            )),
            toJsonNode(orderedMap("BuyPrice", 160000, "CombatPowerGainPercent", 1.5))
        );

        assertThat(estimate.get("Status").asString()).isEqualTo("lowConfidence");
        assertThat(estimate.get("Confidence").asString()).isEqualTo("low");
        assertThat(estimate.get("EvidenceCount").asInt()).isEqualTo(2);
        assertThat(estimate.get("TradeCountStatus").asString()).isEqualTo("matched");
        assertThat(estimate.get("TradeRemainCount").asInt()).isEqualTo(2);
    }

    @Test
    void returnsZeroRecoveryWhenCurrentTradeRemainCountIsZero() {
        JsonNode estimate = service.build(
            currentAccessoryWithTradeCount(0),
            toJsonNode(List.of(matchingCandidate(100000, 1))),
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

    @Test
    void returnsLowConfidenceWhenZeroTradeRecommendationNumbersAreInvalid() {
        JsonNode estimate = service.build(
            currentAccessoryWithTradeCount(0),
            toJsonNode(List.of(matchingCandidate(100000, 1))),
            toJsonNode(orderedMap("BuyPrice", 0, "CombatPowerGainPercent", 1.5))
        );

        assertThat(estimate.get("Status").asString()).isEqualTo("lowConfidence");
        assertThat(estimate.get("Confidence").asString()).isEqualTo("low");
        assertThat(estimate.get("EvidenceCount").asInt()).isEqualTo(0);
        assertThat(estimate.get("EstimatedGrossRecoveryGold").asInt()).isEqualTo(0);
        assertThat(estimate.get("EstimatedFeeGold").asInt()).isEqualTo(0);
        assertThat(estimate.get("EstimatedRecoveryGold").asInt()).isEqualTo(0);
        assertThat(estimate.get("TradeCountStatus").asString()).isEqualTo("untradable");
        assertThat(estimate.get("NetCostGold").isNull()).isTrue();
        assertThat(estimate.get("NetGoldPerOnePercentCombatPower").isNull()).isTrue();
    }

    @Test
    void roundsRecoveryFeeUp() {
        JsonNode estimate = service.build(
            currentAccessory(),
            toJsonNode(List.of(
                matchingCandidate(99901),
                matchingCandidate(100001),
                matchingCandidate(100101)
            )),
            toJsonNode(orderedMap("BuyPrice", 160000, "CombatPowerGainPercent", 1.5))
        );

        assertThat(estimate.get("EstimatedGrossRecoveryGold").asInt()).isEqualTo(100001);
        assertThat(estimate.get("EstimatedFeeGold").asInt()).isEqualTo(5001);
        assertThat(estimate.get("EstimatedRecoveryGold").asInt()).isEqualTo(95000);
        assertThat(estimate.get("NetCostGold").asInt()).isEqualTo(65000);
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

    private JsonNode matchingCandidate(int buyPrice) {
        return matchingCandidate(buyPrice, null);
    }

    private JsonNode matchingCandidate(int buyPrice, Integer tradeRemainCount) {
        return toJsonNode(orderedMap(
            "Type", "목걸이",
            "Name", "고대 목걸이",
            "Quality", 91,
            "MainStatValue", 12000,
            "EnlightenmentPoint", 13,
            "BuyPrice", buyPrice,
            "TradeRemainCount", tradeRemainCount,
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
