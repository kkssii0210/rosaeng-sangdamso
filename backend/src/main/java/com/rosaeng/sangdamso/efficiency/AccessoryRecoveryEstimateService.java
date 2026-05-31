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

    private static final double SALE_FEE_RATE = 0.05;
    private static final String TRADE_COUNT_UNKNOWN_CAVEAT = "현재 악세 거래 가능 횟수를 확인하지 못해 거래횟수별 시세 차이는 반영하지 못했어.";
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

        if (!highConfidence) {
            return lowConfidenceEstimate(summary, tradeContext);
        }

        Double buyPrice = positiveNumber(recommendation, "BuyPrice", "buyPrice");
        Double gainPercent = positiveNumber(recommendation, "CombatPowerGainPercent", "combatPowerGainPercent");

        if (buyPrice == null || gainPercent == null) {
            return lowConfidenceEstimate(summary, tradeContext);
        }

        Recovery recovery = recovery(summary.medianPrice());
        long netCost = Math.max(0L, Math.round(buyPrice) - recovery.netRecoveryGold());

        return toJsonNode(orderedMap(
            "Status", "ready",
            "Confidence", "high",
            "EvidenceCount", summary.count(),
            "EstimatedGrossRecoveryGold", recovery.grossRecoveryGold(),
            "EstimatedFeeGold", recovery.feeGold(),
            "EstimatedRecoveryGold", recovery.netRecoveryGold(),
            "FeeRate", SALE_FEE_RATE,
            "TradeCountStatus", tradeContext.status(),
            "TradeRemainCount", tradeContext.tradeRemainCount(),
            "Caveat", tradeContext.caveat(),
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

    private Summary summarizeExactMatchPrices(
        JsonNode currentAccessory,
        JsonNode auctionCandidates,
        Integer currentTradeRemainCount
    ) {
        if (currentAccessory == null || currentAccessory.isNull()) {
            return new Summary(0, null, null);
        }

        String currentFingerprint = normalizer.fingerprint(currentAccessory);
        List<Integer> prices = new ArrayList<>();

        for (JsonNode candidate : arrayItems(auctionCandidates)) {
            if (!currentFingerprint.equals(normalizer.fingerprint(candidate))) {
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

        return new Summary(prices.size(), medianPrice, interquartileRange);
    }

    private JsonNode lowConfidenceEstimate(Summary summary, TradeContext tradeContext) {
        Recovery recovery = recovery(summary.medianPrice());

        return toJsonNode(orderedMap(
            "Status", "lowConfidence",
            "Confidence", "low",
            "EvidenceCount", summary.count(),
            "EstimatedGrossRecoveryGold", recovery.grossRecoveryGold(),
            "EstimatedFeeGold", recovery.feeGold(),
            "EstimatedRecoveryGold", recovery.netRecoveryGold(),
            "FeeRate", SALE_FEE_RATE,
            "TradeCountStatus", tradeContext.status(),
            "TradeRemainCount", tradeContext.tradeRemainCount(),
            "Caveat", tradeContext.caveat(),
            "NetCostGold", null,
            "NetGoldPerOnePercentCombatPower", null
        ));
    }

    private JsonNode untradableEstimate(JsonNode recommendation) {
        Double buyPrice = positiveNumber(recommendation, "BuyPrice", "buyPrice");
        Double gainPercent = positiveNumber(recommendation, "CombatPowerGainPercent", "combatPowerGainPercent");
        Long netCost = buyPrice == null ? null : Math.max(0L, Math.round(buyPrice));
        Long netGoldPerOnePercentCombatPower = netCost == null || gainPercent == null
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
            "TradeRemainCount", 0,
            "Caveat", UNTRADABLE_CAVEAT,
            "NetCostGold", netCost,
            "NetGoldPerOnePercentCombatPower", netGoldPerOnePercentCombatPower
        ));
    }

    private Recovery recovery(Integer grossRecoveryGold) {
        if (grossRecoveryGold == null) {
            return new Recovery(null, null, null);
        }

        int feeGold = Math.toIntExact((long) Math.ceil(grossRecoveryGold * SALE_FEE_RATE));
        return new Recovery(grossRecoveryGold, feeGold, Math.max(0, grossRecoveryGold - feeGold));
    }

    private TradeContext tradeContext(Integer currentTradeRemainCount) {
        if (currentTradeRemainCount == null) {
            return new TradeContext("unknown", null, TRADE_COUNT_UNKNOWN_CAVEAT);
        }

        return new TradeContext("matched", currentTradeRemainCount, "");
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

    private record Summary(int count, Integer medianPrice, Integer interquartileRange) {
    }

    private record Recovery(Integer grossRecoveryGold, Integer feeGold, Integer netRecoveryGold) {
    }

    private record TradeContext(String status, Integer tradeRemainCount, String caveat) {
    }
}
