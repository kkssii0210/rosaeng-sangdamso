package com.rosaeng.sangdamso.efficiency;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.arrayItems;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.child;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.orderedMap;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.toJsonNode;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

@Service
public class AccessoryRecoveryEstimateService {

    private static final double SALE_FEE_RATE = 0.05;
    private static final String METHOD_EXACT = "exact";
    private static final String METHOD_APPROXIMATE = "approximateImpactRefinement";
    private static final String METHOD_UNAVAILABLE = "unavailable";
    private static final String METHOD_UNTRADABLE = "untradable";
    private static final String CAVEAT_CODE_APPROXIMATE = "APPROXIMATE_IMPACT_REFINEMENT";
    private static final String CAVEAT_CODE_NO_APPROXIMATE_EVIDENCE = "NO_APPROXIMATE_EVIDENCE";
    private static final String CAVEAT_CODE_UNTRADABLE = "UNTRADABLE";
    private static final String TRADE_COUNT_UNKNOWN_CAVEAT = "현재 악세 거래 가능 횟수를 확인하지 못해 거래횟수별 시세 차이는 반영하지 못했어.";
    private static final String APPROXIMATE_CAVEAT = "완전 동일 매물이 없어 딜러 전투력 영향 연마효과와 거래횟수가 같은 유사 주스탯 매물의 최저가로 보수 추정했어.";
    private static final String APPROXIMATE_UNKNOWN_TRADE_COUNT_CAVEAT = "완전 동일 매물이 없어 딜러 전투력 영향 연마효과와 유사 주스탯 매물의 최저가로 보수 추정했어.";
    private static final String UNTRADABLE_CAVEAT = "현재 악세 거래 가능 횟수가 0회라 회수금을 0으로 계산했어.";

    private final AccessoryNormalizer normalizer;

    public AccessoryRecoveryEstimateService(AccessoryNormalizer normalizer) {
        this.normalizer = normalizer;
    }

    public JsonNode build(JsonNode currentAccessory, JsonNode auctionCandidates, JsonNode recommendation) {
        Integer currentTradeRemainCount = nonNegativeInteger(currentAccessory, "TradeRemainCount", "tradeRemainCount");
        TradeContext tradeContext = tradeContext(currentTradeRemainCount);

        if (Integer.valueOf(0).equals(currentTradeRemainCount)) {
            return untradableEstimate(recommendation);
        }

        Summary summary = summarizeExactMatchPrices(currentAccessory, auctionCandidates, currentTradeRemainCount);
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

        Double buyPrice = positiveNumber(recommendation, "BuyPrice", "buyPrice");
        Double gainPercent = positiveNumber(recommendation, "CombatPowerGainPercent", "combatPowerGainPercent");

        if (buyPrice == null || gainPercent == null) {
            return estimateWithoutNetCost(basis, tradeContext);
        }

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

    private Summary summarizeExactMatchPrices(
        JsonNode currentAccessory,
        JsonNode auctionCandidates,
        Integer currentTradeRemainCount
    ) {
        if (currentAccessory == null || currentAccessory.isNull()) {
            return new Summary(0, null, null, List.of());
        }

        String currentFingerprint = normalizer.fingerprint(currentAccessory);
        List<Integer> prices = new ArrayList<>();

        for (JsonNode candidate : arrayItems(auctionCandidates)) {
            if (!currentFingerprint.equals(normalizer.fingerprint(candidate))) {
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

        return new Summary(prices.size(), medianPrice, interquartileRange, List.copyOf(prices));
    }

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

    private JsonNode untradableEstimate(JsonNode recommendation) {
        Double buyPrice = positiveNumber(recommendation, "BuyPrice", "buyPrice");
        Double gainPercent = positiveNumber(recommendation, "CombatPowerGainPercent", "combatPowerGainPercent");
        Long netCost = buyPrice == null ? null : Math.max(0L, Math.round(buyPrice));
        Long netGoldPerOnePercentCombatPower = netCost == null || gainPercent == null
            ? null
            : Math.round(netCost / gainPercent);
        boolean actionable = netCost != null && netGoldPerOnePercentCombatPower != null;

        return toJsonNode(orderedMap(
            "Status", actionable ? "ready" : "lowConfidence",
            "Method", METHOD_UNTRADABLE,
            "Confidence", actionable ? "high" : "low",
            "EvidenceCount", 0,
            "EstimatedGrossRecoveryGold", 0,
            "EstimatedFeeGold", 0,
            "EstimatedRecoveryGold", 0,
            "FeeRate", SALE_FEE_RATE,
            "TradeCountStatus", "untradable",
            "TradeRemainCount", 0,
            "Caveat", UNTRADABLE_CAVEAT,
            "CaveatCode", CAVEAT_CODE_UNTRADABLE,
            "Facts", untradableFacts(),
            "NetCostGold", netCost,
            "NetGoldPerOnePercentCombatPower", netGoldPerOnePercentCombatPower
        ));
    }

    private Recovery recovery(Integer grossRecoveryGold) {
        if (grossRecoveryGold == null) {
            return new Recovery(null, null, null);
        }

        int feeGold = Math.toIntExact((grossRecoveryGold * 5L + 99L) / 100L);
        return new Recovery(grossRecoveryGold, feeGold, Math.max(0, grossRecoveryGold - feeGold));
    }

    private TradeContext tradeContext(Integer currentTradeRemainCount) {
        if (currentTradeRemainCount == null) {
            return new TradeContext("unknown", null, TRADE_COUNT_UNKNOWN_CAVEAT);
        }

        return new TradeContext("matched", currentTradeRemainCount, "");
    }

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

    private EstimateBasis approximateBasis(
        JsonNode currentAccessory,
        JsonNode auctionCandidates,
        Integer currentTradeRemainCount,
        TradeContext tradeContext,
        Summary exactSummary
    ) {
        String currentType = text(currentAccessory, "Type", "type");
        List<String> currentSignature = normalizer.dealerImpactRefinementSignature(currentAccessory);
        Integer currentMainStat = mainStatValue(currentAccessory);

        if (currentType.isBlank() || currentSignature.isEmpty() || currentMainStat == null) {
            return null;
        }

        List<ApproximateCandidate> candidates = new ArrayList<>();

        for (JsonNode candidate : arrayItems(auctionCandidates)) {
            Integer buyPrice = positiveInteger(candidate, "BuyPrice", "buyPrice");
            Integer candidateMainStat = mainStatValue(candidate);

            if (buyPrice == null || candidateMainStat == null) {
                continue;
            }

            if (!currentType.equals(text(candidate, "Type", "type"))) {
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
        boolean usedExactSparseCeiling = exactSparseGross != null && exactSparseGross <= approxGross;
        int grossRecoveryGold = usedExactSparseCeiling ? exactSparseGross : approxGross;
        int selectedMainStatDelta = usedExactSparseCeiling
            ? 0
            : nearCandidates.stream()
                .filter(candidate -> candidate.buyPrice() == approxGross)
                .mapToInt(ApproximateCandidate::mainStatDelta)
                .min()
                .orElse(minDelta);
        String caveat = currentTradeRemainCount == null
            ? APPROXIMATE_UNKNOWN_TRADE_COUNT_CAVEAT + " " + tradeContext.caveat()
            : APPROXIMATE_CAVEAT;

        return new EstimateBasis(
            METHOD_APPROXIMATE,
            nearCandidates.size() >= 3 ? "conservative" : "low",
            nearCandidates.size(),
            grossRecoveryGold,
            CAVEAT_CODE_APPROXIMATE,
            caveat,
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

    private Integer positiveInteger(JsonNode node, String... keys) {
        Double value = positiveNumber(node, keys);

        return value == null ? null : Math.toIntExact(Math.round(value));
    }

    private Double positiveNumber(JsonNode node, String... keys) {
        if (node == null || node.isNull()) {
            return null;
        }

        for (String key : keys) {
            Double value = number(child(node, key));

            if (value != null && value > 0) {
                return value;
            }
        }

        return null;
    }

    private Integer nonNegativeInteger(JsonNode node, String... keys) {
        if (node == null || node.isNull()) {
            return null;
        }

        for (String key : keys) {
            Double value = number(child(node, key));

            if (value != null && value >= 0) {
                return Math.toIntExact(Math.round(value));
            }
        }

        return null;
    }

    private Double number(JsonNode value) {
        if (value == null || value.isNull()) {
            return null;
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

        return number != null && Double.isFinite(number) ? number : null;
    }

    private record Summary(int count, Integer medianPrice, Integer interquartileRange, List<Integer> prices) {
    }

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

    private record Recovery(Integer grossRecoveryGold, Integer feeGold, Integer netRecoveryGold) {
    }

    private record TradeContext(String status, Integer tradeRemainCount, String caveat) {
    }
}
