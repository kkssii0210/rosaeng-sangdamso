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
                differentCandidate(1000),
                approximateCandidate(1000, 12000, null, "추가 피해 +1.50%")
            )),
            toJsonNode(orderedMap("BuyPrice", 160000, "CombatPowerGainPercent", 1.5))
        );

        assertThat(estimate.get("Status").asString()).isEqualTo("ready");
        assertThat(estimate.get("Method").asString()).isEqualTo("exact");
        assertThat(estimate.get("Confidence").asString()).isEqualTo("high");
        assertThat(estimate.get("EvidenceCount").asInt()).isEqualTo(3);
        assertThat(estimate.get("EstimatedGrossRecoveryGold").asInt()).isEqualTo(100000);
        assertThat(estimate.get("EstimatedFeeGold").asInt()).isEqualTo(5000);
        assertThat(estimate.get("EstimatedRecoveryGold").asInt()).isEqualTo(95000);
        assertThat(estimate.get("FeeRate").asDouble()).isEqualTo(0.05);
        assertThat(estimate.get("TradeCountStatus").asString()).isEqualTo("unknown");
        assertThat(estimate.get("TradeRemainCount").isNull()).isTrue();
        assertThat(estimate.get("Caveat").asString()).contains("거래 가능 횟수");
        assertThat(estimate.get("CaveatCode").isNull()).isTrue();
        assertThat(estimate.get("Facts").get("pricePolicy").asString()).isEqualTo("exactMedianActiveAuction");
        assertThat(estimate.get("Facts").get("feeRate").asDouble()).isEqualTo(0.05);
        assertThat(estimate.get("NetCostGold").asInt()).isEqualTo(65000);
        assertThat(estimate.get("NetGoldPerOnePercentCombatPower").asInt()).isEqualTo(43333);
    }

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

    @Test
    void returnsZeroRecoveryWhenCurrentTradeRemainCountIsZero() {
        JsonNode estimate = service.build(
            currentAccessoryWithTradeCount(0),
            toJsonNode(List.of(matchingCandidate(100000, 1))),
            toJsonNode(orderedMap("BuyPrice", 160000, "CombatPowerGainPercent", 1.5))
        );

        assertThat(estimate.get("Status").asString()).isEqualTo("ready");
        assertThat(estimate.get("Method").asString()).isEqualTo("untradable");
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
        assertThat(estimate.get("CaveatCode").asString()).isEqualTo("UNTRADABLE");
        assertThat(estimate.get("Facts").get("pricePolicy").asString()).isEqualTo("none");
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
        assertThat(estimate.get("Method").asString()).isEqualTo("exact");
        assertThat(estimate.get("EvidenceCount").asInt()).isEqualTo(3);
        assertThat(estimate.get("Facts").get("pricePolicy").asString()).isEqualTo("exactMedianActiveAuction");
        assertThat(estimate.get("NetCostGold").isNull()).isTrue();
    }

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
        assertThat(estimate.get("TradeCountStatus").asString()).isEqualTo("unknown");
        assertThat(estimate.get("Facts").get("tradeCountMatched").asBoolean()).isFalse();
        assertThat(estimate.get("Caveat").asString()).contains("거래 가능 횟수");
        assertThat(estimate.get("Caveat").asString()).doesNotContain("거래횟수가 같은");
    }

    @Test
    void approximateRecoveryReportsZeroMainStatDeltaWhenSparseExactCeilingWins() {
        JsonNode estimate = service.build(
            currentAccessoryWithRefinementLines("추가 피해 +1.50%"),
            toJsonNode(List.of(
                exactFingerprintCandidateWithGrade(70000, "고대"),
                approximateCandidate(90000, 12080, null, "추가 피해 +1.50%")
            )),
            toJsonNode(orderedMap("BuyPrice", 160000, "CombatPowerGainPercent", 1.5))
        );

        assertThat(estimate.get("Method").asString()).isEqualTo("approximateImpactRefinement");
        assertThat(estimate.get("EstimatedGrossRecoveryGold").asInt()).isEqualTo(70000);
        assertThat(estimate.get("Facts").get("usedExactSparseCeiling").asBoolean()).isTrue();
        assertThat(estimate.get("Facts").get("exactSparseEvidenceCount").asInt()).isEqualTo(1);
        assertThat(estimate.get("Facts").get("mainStatDelta").asInt()).isEqualTo(0);
    }

    @Test
    void approximateRecoveryDoesNotUseSparseExactCeilingFromWrongKnownGrade() {
        JsonNode estimate = service.build(
            currentAccessoryWithRefinementLines("추가 피해 +1.50%"),
            toJsonNode(List.of(
                exactFingerprintCandidateWithGrade(70000, "유물"),
                approximateCandidate(90000, 12080, null, "추가 피해 +1.50%")
            )),
            toJsonNode(orderedMap("BuyPrice", 160000, "CombatPowerGainPercent", 1.5))
        );

        assertThat(estimate.get("Method").asString()).isEqualTo("approximateImpactRefinement");
        assertThat(estimate.get("EstimatedGrossRecoveryGold").asInt()).isEqualTo(90000);
        assertThat(estimate.get("Facts").get("usedExactSparseCeiling").asBoolean()).isFalse();
        assertThat(estimate.get("Facts").get("exactSparseEvidenceCount").asInt()).isEqualTo(0);
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
        assertThat(estimate.get("Caveat").asString()).contains("거래횟수");
    }

    @Test
    void returnsUnavailableWhenCurrentTypeIsMissingForApproximation() {
        JsonNode current = toJsonNode(orderedMap(
            "Name", "고대 목걸이",
            "MainStatValue", 12000,
            "DetailSections", List.of(
                orderedMap("title", "기본 효과", "lines", List.of("힘 +12000")),
                orderedMap("title", "연마 효과", "lines", List.of("공격력 +390"))
            )
        ));
        JsonNode candidate = toJsonNode(orderedMap(
            "Name", "고대 목걸이",
            "MainStatValue", 12000,
            "BuyPrice", 90000,
            "DetailSections", List.of(
                orderedMap("title", "연마 효과", "lines", List.of("공격력 +390"))
            )
        ));

        JsonNode estimate = service.build(
            current,
            toJsonNode(List.of(candidate)),
            toJsonNode(orderedMap("BuyPrice", 160000, "CombatPowerGainPercent", 1.5))
        );

        assertThat(estimate.get("Method").asString()).isEqualTo("unavailable");
        assertThat(estimate.get("EstimatedRecoveryGold").isNull()).isTrue();
        assertThat(estimate.get("CaveatCode").asString()).isEqualTo("NO_APPROXIMATE_EVIDENCE");
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

    private JsonNode exactFingerprintCandidateWithGrade(int buyPrice, String grade) {
        return toJsonNode(orderedMap(
            "Type", "목걸이",
            "Name", "고대 목걸이",
            "Grade", grade,
            "Tier", 4,
            "Quality", 91,
            "MainStatValue", 12000,
            "EnlightenmentPoint", 13,
            "BuyPrice", buyPrice,
            "DetailSections", List.of(
                orderedMap("title", "연마 효과", "lines", List.of("추가 피해 +1.50%"))
            )
        ));
    }

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

    private JsonNode toJsonNode(Object value) {
        return objectMapper.convertValue(value, JsonNode.class);
    }
}
